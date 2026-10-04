/* ================================================================
   情绪宝 - qx2 情绪调节（v19）
   日期：2026-09-29
   改动：
   - initMirrorBefore 传 thermometerSide: 'right'
   - initMirrorAfter 传 thermometerSide: 'left'
   - 其余同 v18
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://lmmnwmueppkdbzvufxar.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const MUSIC_LEVELS = [
        { code: 1,  cn: '壮丽' }, { code: 2,  cn: '激昂' },
        { code: 3,  cn: '热烈' }, { code: 4,  cn: '欢快' },
        { code: 5,  cn: '轻快' }, { code: 6,  cn: '明朗' },
        { code: 7,  cn: '平静' }, { code: 8,  cn: '沉思' },
        { code: 9,  cn: '忧伤' }, { code: 10, cn: '压抑' },
        { code: 11, cn: '悲伤' }, { code: 12, cn: '空灵' },
    ];

    function getMusicLevelName(code) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        const m = MUSIC_LEVELS.find(x => x.code === code);
        if (!m) return String(code);
        return lang === 2 ? (m.en || m.cn) : m.cn;
    }

    let state = {
        step: 1,
        isGuest: false,
        inputEmotionCode: 0,
        outputEmotionCode: 0,
        feedback: null,
        playlist: [],
        currentIndex: 0,
        audio: null,
        hrvResult: null,
        hrvAborted: false,
        started: false,
        finished: false,
        initialized: false,
        pickedRule: null,
        hrvSeries: [],
        hfSeries: [],
        latestHint: '',
        latestQuality: 'unknown',
    };

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
    function getUserId() { return window.mQxb && window.mQxb.user_id; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getUserName() { return (window.mQxb && window.mQxb.Username) || ''; }

    let _toastTimer = null;
    function toast(text, type) {
        type = type || 'info';
        let bar = document.getElementById('qx2_toast_bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'qx2_toast_bar';
            bar.className = 'qx2-toast-bar';
            document.body.appendChild(bar);
        }
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        bar.className = 'qx2-toast-bar qx2-toast-' + type;
        bar.innerText = text;
        requestAnimationFrame(() => bar.classList.add('show'));
        _toastTimer = setTimeout(() => bar.classList.remove('show'), 3500);
    }

    async function rpc(fnName, params) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify(params),
        });
        if (!res.ok) { const txt = await res.text(); throw new Error(`RPC ${fnName}: ${res.status} ${txt}`); }
        return res.json();
    }
    async function restGet(path) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        if (!res.ok) { const txt = await res.text(); throw new Error(`REST ${path}: ${res.status} ${txt}`); }
        return res.json();
    }

    function renderFlowBar() {
        const bar = document.getElementById('qx2_flow_bar');
        if (!bar) return;
        const steps = bar.querySelectorAll('.qx2-flow-step');
        steps.forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.remove('pending', 'active', 'done', 'disabled');
            if (s < state.step) el.classList.add('done');
            else if (s === state.step) el.classList.add('active');
            else el.classList.add('pending');
            if (s !== state.step + 1) el.classList.add('disabled');
        });
    }
    function setStep(n) {
        state.step = n;
        renderFlowBar();
        updateAllButtonsState();
    }

    function updateAllButtonsState() {
        const btnStart = document.getElementById('qx2_btn_start');
        const btnCollect = document.getElementById('qx2_btn_collect');
        const btnCollection = document.getElementById('qx2_btn_collection');
        const inStep1 = (state.step === 1);
        const inStep3 = (state.step === 3);
        if (btnStart) btnStart.disabled = !inStep1 || !state.inputEmotionCode;
        if (btnCollection) btnCollection.disabled = !inStep1;
        if (btnCollect) {
            const ready = inStep3 && state.outputEmotionCode && state.feedback
                          && state.playlist.length > 0 && !state.pickedRule;
            btnCollect.disabled = !ready;
        }
    }

    let mirrorBeforeId = null;
    let mirrorAfterId = null;
    function initMirrorBefore(initialCode) {
        mirrorBeforeId = qxMoodMirror.create('qx2_wheel_before', {
            mode: '听前情绪',
            initialCode: initialCode || 0,
            doIt: '做',
            thermometerSide: 'right',
            onChange: (code) => {
                state.inputEmotionCode = (code == null) ? 0 : code;
                updateAllButtonsState();
                clearPickedRule();
            }
        });
    }
    function initMirrorAfter() {
        mirrorAfterId = qxMoodMirror.create('qx2_wheel_after', {
            mode: '听后情绪',
            initialCode: 0,
            doIt: '不做',
            thermometerSide: 'left',
            onChange: (code) => {
                state.outputEmotionCode = (code == null) ? 0 : code;
                updateAllButtonsState();
            }
        });
    }

    async function loadSystemRule(emotionCode) {
        try {
            const rules = await restGet(`emobao_regulationrule?emotioncode=eq.${emotionCode}&isactive=eq.true&ruletype=eq.system&limit=1`);
            if (!rules || rules.length === 0) return { ok: false, error: 'NO_RULE' };
            return { ok: true, rule: rules[0] };
        } catch (e) { return { ok: false, error: 'NETWORK_RULE' }; }
    }
    async function loadCollectedRules(emotionCode) {
        try {
            const rules = await restGet(`emobao_regulationrule?emotioncode=eq.${emotionCode}&isactive=eq.true&ruletype=eq.user_collected&order=createdat.desc`);
            return rules || [];
        } catch (e) { return []; }
    }
    async function generatePlaylist(rule) {
        if (!rule || !rule.sequence || !Array.isArray(rule.sequence)) return { ok: false, error: 'BROKEN_RULE' };
        const playlist = [];
        for (let i = 0; i < rule.sequence.length; i++) {
            const item = rule.sequence[i];
            if (!item || !item.musictypecode) return { ok: false, error: 'BROKEN_RULE' };
            if (item.mode === 'random') {
                let tracks;
                try { tracks = await restGet(`emobao_musictrack?musictypecode=eq.${item.musictypecode}&isactive=eq.true`); }
                catch (e) { return { ok: false, error: 'NETWORK' }; }
                if (!tracks || tracks.length === 0) return { ok: false, error: 'NO_TRACK:' + item.musictypecode };
                const pick = tracks[Math.floor(Math.random() * tracks.length)];
                playlist.push({ trackid: pick.trackid, title_cn: pick.title_cn, title_en: pick.title_en, musictypecode: pick.musictypecode, fileurl: pick.fileurl });
            } else if (item.mode === 'fixed' && item.trackid) {
                let tracks;
                try { tracks = await restGet(`emobao_musictrack?trackid=eq.${item.trackid}`); }
                catch (e) { return { ok: false, error: 'NETWORK' }; }
                if (!tracks || tracks.length === 0) return { ok: false, error: 'NO_TRACK:' + (item.musictypecode || '?') };
                const pick = tracks[0];
                playlist.push({ trackid: pick.trackid, title_cn: pick.title_cn, title_en: pick.title_en, musictypecode: pick.musictypecode, fileurl: pick.fileurl });
            } else return { ok: false, error: 'BROKEN_RULE' };
        }
        if (playlist.length === 0) return { ok: false, error: 'EMPTY' };
        return { ok: true, playlist: playlist };
    }
    function errorToToast(errCode) {
        if (errCode === 'NETWORK_RULE') return t('组曲失败：无法读取系统规则', 'Playlist failed: network');
        if (errCode === 'NO_RULE') return t('组曲失败：该情绪没有配置系统规则', 'No system rule');
        if (errCode === 'NETWORK') return t('组曲失败：网络不通', 'Network error');
        if (errCode === 'BROKEN_RULE') return t('组曲失败：系统规则损坏', 'Broken rule');
        if (errCode === 'EMPTY') return t('组曲失败：无法生成任何曲子', 'No track');
        if (errCode && errCode.indexOf('NO_TRACK:') === 0) {
            const name = getMusicLevelName(parseInt(errCode.split(':')[1]));
            return t(`组曲失败：曲库里没有「${name}」`, `No track for "${name}"`);
        }
        return t('组曲失败：未知错误', 'Unknown error');
    }

    function renderTrendMini() {
        const el = document.getElementById('qx2_trend_mini');
        if (!el) return;
        const videoWrap = el.querySelector('.qx2-trend-video-wrap');
        el.innerHTML = '';
        if (videoWrap) el.appendChild(videoWrap);
        const pl = state.playlist;
        if (pl.length === 0) return;
        const score = document.createElement('span');
        score.className = 'qx2-trend-score';
        const cur = Math.min(state.currentIndex + 1, pl.length);
        score.innerText = `${cur}/${pl.length}`;
        el.insertBefore(score, videoWrap || null);
        for (let i = 0; i < pl.length - 1; i++) {
            if (state.currentIndex < i + 1) break;
            const a = MUSIC_LEVELS.find(m => m.code === pl[i].musictypecode);
            const b = MUSIC_LEVELS.find(m => m.code === pl[i + 1].musictypecode);
            const na = a ? a.code : 7, nb = b ? b.code : 7;
            const SEG_W = 24, SEG_H = 24, MID_Y = 12, DELTA = 3, PAD_X = 6;
            let y1, y2, cls;
            if (nb < na)      { y1 = MID_Y + DELTA; y2 = MID_Y - DELTA; cls = 'qx2-trend-up'; }
            else if (nb > na) { y1 = MID_Y - DELTA; y2 = MID_Y + DELTA; cls = 'qx2-trend-down'; }
            else              { y1 = MID_Y;         y2 = MID_Y;         cls = 'qx2-trend-flat'; }
            const svg = `<svg viewBox="0 0 ${SEG_W} ${SEG_H}" xmlns="http://www.w3.org/2000/svg"><line class="qx2-trend-line ${cls}" x1="${PAD_X}" y1="${y1}" x2="${SEG_W - PAD_X}" y2="${y2}"/></svg>`;
            el.insertBefore(document.createRange().createContextualFragment(svg), videoWrap || null);
        }
    }

    function initAudio() {
        if (!state.audio) {
            state.audio = new Audio();
            state.audio.addEventListener('ended', onTrackEnded);
            state.audio.addEventListener('error', (e) => {
                console.error('音频播放失败', e);
                toast(t('音频播放失败', 'Audio error'), 'error');
            });
        }
    }
    function isFastMode() {
        try {
            return new URLSearchParams(window.location.search).get('fast') === '1';
        } catch (e) { return false; }
    }

    let _fastTimer = null;

    function playCurrentTrack() {
        if (state.currentIndex >= state.playlist.length) { onPlaylistFinished(); return; }
        const track = state.playlist[state.currentIndex];
        if (!track || !track.fileurl) { toast(t('曲目文件缺失', 'Track missing'), 'error'); return; }
        initAudio();
        state.audio.src = track.fileurl;
        state.audio.play().then(() => {
            renderTrendMini();
            if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
            if (isFastMode()) {
                _fastTimer = setTimeout(() => {
                    try { state.audio.pause(); } catch (e) {}
                    onTrackEnded();
                }, 30000);
            }
        }).catch(err => {
            console.error('播放失败', err);
            toast(t('播放失败，请检查文件', 'Play failed'), 'error');
        });
    }
    function onTrackEnded() {
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        state.currentIndex++;
        if (state.currentIndex < state.playlist.length) playCurrentTrack();
        else onPlaylistFinished();
    }
    function onPlaylistFinished() {
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        state.finished = true;
        try { qxHrvCapture.stop(); } catch (e) {}
        setStep(3);
        if (mirrorAfterId) qxMoodMirror.setDoIt('qx2_wheel_after', '做');
        if (window.qxHealChart) { try { qxHealChart.finish(); } catch (e) {} }
        toast(t('音乐播放完成，请填写听后评价并选择听后情绪', 'Music done.'), 'success');
    }

    function onFlowStepClick(step) {
        if (step === state.step + 1) {
            if (step === 2) {
                if (!state.inputEmotionCode || state.inputEmotionCode === 0) {
                    toast(t('请先用魔镜选出情绪，情绪调节无法进行', 'Please pick emotion first'), 'warning');
                    return;
                }
                enterAdjustStep();
                return;
            }
            if (step === 3) {
                if (!state.finished) { toast(t('请先等音乐播放完成', 'Please wait'), 'warning'); return; }
                setStep(3);
                if (mirrorAfterId) qxMoodMirror.setDoIt('qx2_wheel_after', '做');
                return;
            }
            if (step === 4) {
                if (!state.outputEmotionCode || !state.feedback) {
                    toast(t('请先选择听后情绪和主观评价', 'Please fill output emotion and feedback'), 'warning');
                    return;
                }
                setStep(4);
                renderAnalysis();
                if (window.qxHealChart) { try { qxHealChart.showAnalysis(); } catch (e) {} }
                return;
            }
        }
    }

    function renderAnalysisLive() {
        const body = document.getElementById('qx2_analysis_body');
        if (!body) return;
        const series = state.hrvSeries;
        const quality = state.latestQuality;

        if (series.length < 2) {
            let tip = '';
            if (quality === 'no_press')      tip = t('请把手指放到摄像头上', 'Place finger on camera');
            else if (quality === 'too_hard') tip = t('手指放松一点，不要压太重', 'Press lighter');
            else if (quality === 'lost')     tip = t('信号丢失，请保持不动', 'Signal lost');
            else if (quality === 'weak')     tip = t('手指稳住，保持不动', 'Hold still');
            else if (quality === 'noisy')    tip = t('信号不稳，请保持不动', 'Signal noisy');
            else                             tip = t('等待采样…', 'Waiting for samples…');
            body.innerHTML = `<div class="qx2-analysis-placeholder">${tip}</div>`;
            return;
        }
        renderAnalysis();
    }

    function avg(arr, key) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + (b[key] || 0), 0) / arr.length;
    }

    function renderAnalysis() {
        const body = document.getElementById('qx2_analysis_body');
        if (!body) return;
        const series = state.hrvSeries;
        const hfSeries = state.hfSeries;
        const html = [];

        const cov = (state.hrvResult && state.hrvResult.coverage != null)
                    ? state.hrvResult.coverage
                    : (series.length >= 2 ? 1 : 0);

        if (series.length < 2 || cov < 0.30) {
            const fbMap = {
                better: t('更好', 'Better'),
                same:   t('一样', 'Same'),
                worse:  t('更差', 'Worse'),
            };
            const fb = state.feedback ? fbMap[state.feedback] : t('未填', 'N/A');
            const covPct = Math.round(cov * 100);
            html.push(`<div class="qx2-analysis-conclusion">${t('本次 HRV 有效数据不足 30%，仅记录主观评价', 'HRV coverage < 30%, subjective only')}</div>`);
            html.push(`<div class="qx2-analysis-item"><b>${t('有效数据占比', 'Coverage')}</b><br>${covPct}%</div>`);
            html.push(`<div class="qx2-analysis-item"><b>${t('主观评价', 'Subjective')}</b><br>${fb}</div>`);
            body.innerHTML = html.join('');
            return;
        }

        const first = series.slice(0, Math.min(3, series.length));
        const last  = series.slice(-Math.min(3, series.length));
        const r0 = avg(first, 'rmssd'), r1 = avg(last, 'rmssd');
        const h0 = avg(first, 'bpm'),   h1 = avg(last, 'bpm');
        const diffR = r1 - r0;
        const diffH = h1 - h0;

        const hfOk = hfSeries.length >= 3;
        let hfFirst = 0, hfLast = 0, hfDiff = 0;
        if (hfOk) {
            hfFirst = avg(hfSeries.slice(0, 3), 'hf');
            hfLast  = avg(hfSeries.slice(-3), 'hf');
            hfDiff  = hfLast - hfFirst;
        }

        let conclusion;
        if (diffR > 5 && (!hfOk || hfDiff >= 0))      conclusion = t('本次放松度上升，调整有效', 'Relaxation increased, effective');
        else if (diffR > 5 && hfOk && hfDiff < 0)      conclusion = t('放松度上升，呼吸性心率略降', 'Relaxation up, HF slightly down');
        else if (diffR < -5)                           conclusion = t('本次放松度下降，建议再听一段', 'Relaxation decreased');
        else                                           conclusion = t('本次放松度平稳，效果不明显', 'Relaxation stable');
        html.push(`<div class="qx2-analysis-conclusion">${conclusion}</div>`);

        html.push(`<div class="qx2-analysis-row">
            ${t('开始时', 'Start')}：${t('放松度', 'Relax')} ${Math.round(r0)} · ${t('心率', 'HR')} ${Math.round(h0)}<br>
            ${t('结束时', 'End')}：${t('放松度', 'Relax')} ${Math.round(r1)} · ${t('心率', 'HR')} ${Math.round(h1)}
        </div>`);

        let hfText;
        if (!hfOk) {
            hfText = t('本次 HF 数据不够，未能分析', 'HF data insufficient');
        } else if (hfDiff > 0.5) {
            hfText = t('本次情绪调节过程从呼吸性心率看有效', 'Effective per HF');
        } else if (hfDiff < -0.5) {
            hfText = t('本次呼吸性心率下降，放松效果不明显', 'HF decreased, weak effect');
        } else {
            hfText = t('本次呼吸性心率变化不大', 'HF stable');
        }
        html.push(`<div class="qx2-analysis-item"><b>${t('呼吸性心率', 'Respiratory HR')}</b><br>${hfText}</div>`);

        let trend;
        if (diffR > 3) trend = t('放松度整体上升', 'Overall rising');
        else if (diffR < -3) trend = t('放松度整体下降', 'Overall falling');
        else trend = t('放松度整体平稳', 'Overall stable');
        html.push(`<div class="qx2-analysis-item"><b>${t('过程变化', 'Progress')}</b><br>${trend}</div>`);

        const avgH = avg(series, 'bpm'), avgR = avg(series, 'rmssd');
        let st;
        if (avgH >= 75 && avgR < 45) st = t('紧张·压力', 'Tense·Stress');
        else if (avgH < 75 && avgR >= 45) st = t('放松·恢复', 'Relaxed·Recovery');
        else if (avgH >= 75 && avgR >= 45) st = t('兴奋·调节好', 'Excited·Well');
        else st = t('疲劳·耗竭', 'Fatigue·Burnout');
        html.push(`<div class="qx2-analysis-item"><b>${t('整体状态', 'Overall')}</b><br>${st}</div>`);

        let consistent;
        const fb = state.feedback;
        if ((fb === 'better' && diffR > 0) || (fb === 'worse' && diffR < 0) || (fb === 'same' && Math.abs(diffR) < 5)) {
            consistent = t('数据与您的感受一致', 'Consistent with your feeling');
        } else {
            consistent = t('数据与您的感受不一致', 'Inconsistent with your feeling');
        }
        html.push(`<div class="qx2-analysis-item"><b>${t('与自评', 'Self-report')}</b><br>${consistent}</div>`);

        let advice;
        if (diffR > 5) advice = t('保持这种调节节奏', 'Keep this rhythm');
        else if (diffR < -5) advice = t('下次可换一组曲', 'Try another playlist');
        else advice = t('建议有时间多用情绪宝', 'Use Emo Treasure more often');
        html.push(`<div class="qx2-analysis-item"><b>${t('建议', 'Advice')}</b><br>${advice}</div>`);

        let maxIdx = 0;
        series.forEach((p, i) => { if ((p.rmssd || 0) > (series[maxIdx].rmssd || 0)) maxIdx = i; });
        const maxP = series[maxIdx];
        const mmin = Math.floor((maxP.t || 0) / 60);
        const msec = (maxP.t || 0) % 60;
        html.push(`<div class="qx2-analysis-item"><b>${t('最放松时刻', 'Best moment')}</b><br>${t('第', 'at')} ${mmin}:${String(msec).padStart(2, '0')} · ${t('放松度', 'Relax')} ${maxP.rmssd}</div>`);

        const hrHint = diffH < -3 ? t(`您的心率下降 ${Math.abs(Math.round(diffH))}，说明身心在放松`, `HR dropped ${Math.abs(Math.round(diffH))}`)
                    : diffH > 3 ? t(`您的心率上升 ${Math.round(diffH)}，请留意`, `HR rose ${Math.round(diffH)}`)
                    : t('心率变化不大，状态平稳', 'HR stable');
        html.push(`<div class="qx2-analysis-item"><b>${t('身体信号', 'Body signal')}</b><br>${hrHint}</div>`);

        body.innerHTML = html.join('');
    }

    function paintCameraStatus(rt) {
        const hintEl = document.getElementById('qx2_camera_hint');
        if (!hintEl) return;

        const q = rt && rt.quality ? rt.quality : 'unknown';
        const h = rt && rt.hint ? rt.hint : '';

        let text = t('等待采样…', 'Waiting…');
        let color = '#5A6B87';

        if (q === 'good') {
            text = t('采集中，很好', 'Capturing, good');
            color = '#1E8449';
        } else if (q === 'too_light') {
            text = t('手指压太轻，请稍微用力', 'Press a bit harder');
            color = '#B9770E';
        } else if (q === 'too_hard') {
            text = t('手指压太重，请放松一点', 'Press lighter');
            color = '#B9770E';
        } else if (q === 'weak') {
            text = t('信号太弱，请稳住手指', 'Hold still');
            color = '#B9770E';
        } else if (q === 'noisy') {
            text = t('信号不太稳定，请保持不动', 'Signal noisy');
            color = '#B9770E';
        } else if (q === 'no_press') {
            text = t('手指离开，请放回', 'Finger removed');
            color = '#C0392B';
        } else if (h) {
            text = h;
        }

        hintEl.innerText = text;
        hintEl.style.color = color;
    }

    async function enterAdjustStep() {
        setStep(2);

        if (mirrorBeforeId) {
            try { qxMoodMirror.setDoIt('qx2_wheel_before', '不做'); } catch (e) {}
        }

        try {
            let rule = null;
            if (state.pickedRule) { rule = state.pickedRule; }
            else {
                const ruleRes = await loadSystemRule(state.inputEmotionCode);
                if (!ruleRes.ok) { toast(errorToToast(ruleRes.error), 'error'); setStep(1); return; }
                rule = ruleRes.rule;
            }
            const genRes = await generatePlaylist(rule);
            if (!genRes.ok) { toast(errorToToast(genRes.error), 'error'); setStep(1); return; }
            state.playlist = genRes.playlist;
            state.currentIndex = 0;
            state.started = true;
            state.finished = false;
            state.hrvResult = null;
            state.hrvAborted = false;
            state.hrvSeries = [];
            state.hfSeries = [];
            state.latestHint = '';
            state.latestQuality = 'unknown';
            renderTrendMini();
            renderAnalysisLive();

            if (window.qxHealChart) { try { qxHealChart.start('qx2_heal_canvas'); } catch (e) {} }

            const hidId = 'qx2_hrv_wave_hidden';
            if (!document.getElementById(hidId)) {
                const hid = document.createElement('div');
                hid.id = hidId;
                hid.style.position = 'absolute';
                hid.style.width = '1px';
                hid.style.height = '1px';
                hid.style.overflow = 'hidden';
                hid.style.opacity = '0';
                document.body.appendChild(hid);
            }

            const ok = await qxHrvCapture.start(hidId, {
                duration: 9999,
                abortOnNoFinger: false,
                onWarmupTick: (info) => {
                    const hintEl = document.getElementById('qx2_camera_hint');
                    if (hintEl) {
                        const remain = info && info.remain != null ? info.remain : '?';
                        const h = info && info.hint ? info.hint : '';
                        hintEl.innerText = `${t('预备中…', 'Warming up…')} ${remain}s · ${h}`;
                        hintEl.style.color = '#B9770E';
                    }
                    const qx2Wrap = document.querySelector('.qx2-trend-video-wrap');
                    if (qx2Wrap) {
                        let c = '#B9770E';
                        const f = info && info.flag;
                        if (f === 'good') c = '#2ECC71';
                        else if (f === 'no_press') c = '#C0392B';
                        qx2Wrap.style.borderColor = c;
                    }
                },
                onWarmupEnd: () => {
                    playCurrentTrack();
                },
                onProgress: (rt) => {
                    if (!rt) return;
                    if (rt.hint !== undefined) state.latestHint = rt.hint;
                    if (rt.quality) state.latestQuality = rt.quality;

                    paintCameraStatus(rt);

                    if (rt.quality === 'good' && rt.bpm > 0) {
                        state.hrvSeries.push({ t: rt.elapsed, bpm: rt.bpm, rmssd: rt.rmssd });
                        if (rt.hf > 0) {
                            state.hfSeries.push({ t: rt.elapsed, hf: rt.hf });
                        }
                    }
                    if (window.qxHealChart) { try { qxHealChart.push(rt); } catch (e) {} }
                    if (state.step === 2) renderAnalysisLive();
                },
                onComplete: (result) => {
                    state.hrvResult = result;
                    console.log('[qx2] HRV onComplete, coverage =', result && result.coverage);
                },
                onAbort: (info) => {
                    state.hrvAborted = true;
                    console.log('[qx2] HRV aborted:', info && info.reason);
                }
            });

            if (!ok) {
                toast(t('摄像头不可用，请检查权限', 'Camera unavailable'), 'error');
                setStep(1);
                return;
            }

            const s = document.querySelector('#' + hidId + ' .qx-hrv-btn-start');
            if (s && !s.disabled) s.click();

            updateAllButtonsState();
        } catch (e) {
            console.error('[qx2] enterAdjustStep 异常', e);
            toast(t('进入调整失败：', 'Enter adjust failed: ') + e.message, 'error');
            setStep(1);
        }
    }

    function bindFeedbackRadios() {
        document.querySelectorAll('input[name="qx2_feedback"]').forEach(r => {
            r.addEventListener('change', () => {
                state.feedback = r.value;
                updateAllButtonsState();
            });
        });
    }

    function clearPickedRule() {
        state.pickedRule = null;
        const btn = document.getElementById('qx2_btn_collection');
        if (btn) btn.innerText = t('选组曲', 'Pick');
    }
    function setPickedRule(rule) {
        state.pickedRule = rule || null;
        const btn = document.getElementById('qx2_btn_collection');
        if (btn) {
            if (rule) btn.innerText = t(`已选：${rule.rulename}`, `Picked: ${rule.rulename}`);
            else      btn.innerText = t('选组曲', 'Pick');
        }
    }
    async function onPickCollection() {
        if (state.step !== 1) return;
        if (!state.inputEmotionCode || state.inputEmotionCode === 0) {
            toast(t('请先选择听前情绪', 'Please select input emotion first'), 'warning');
            return;
        }
        const modal = document.getElementById('qx2_collect_modal');
        const list = document.getElementById('qx2_collect_modal_list');
        if (!modal || !list) return;
        list.innerHTML = '<div class="qx2-collect-empty">' + t('加载中…', 'Loading…') + '</div>';
        modal.classList.add('show');
        const rules = await loadCollectedRules(state.inputEmotionCode);
        let html = '';
        const isAuto = !state.pickedRule;
        html += `<div class="qx2-collect-item qx2-collect-item-auto ${isAuto ? 'active' : ''}" data-rule="__auto__">
            <div class="qx2-collect-item-name">${t('使用自动组曲', 'Use Auto Playlist')}</div>
            <div class="qx2-collect-item-meta">${t('由系统自动随机生成', 'Auto generated')}</div>
        </div>`;
        if (!rules || rules.length === 0) {
            html += `<div class="qx2-collect-empty">${t('当前情绪暂无收藏组曲', 'No collected playlist yet')}</div>`;
        } else {
            rules.forEach(r => {
                const active = state.pickedRule && state.pickedRule.ruleid === r.ruleid;
                html += `<div class="qx2-collect-item ${active ? 'active' : ''}" data-rule="${r.ruleid}">
                    <div class="qx2-collect-item-name">${escapeHtml(r.rulename || '(未命名)')}</div>
                    <div class="qx2-collect-item-meta">${t('收藏人', 'by')}：${escapeHtml(r.createdbyname || '—')}</div>
                </div>`;
            });
        }
        list.innerHTML = html;
        list.querySelectorAll('.qx2-collect-item').forEach(el => {
            el.onclick = () => {
                const rid = el.dataset.rule;
                if (rid === '__auto__') clearPickedRule();
                else {
                    const r = rules.find(x => String(x.ruleid) === String(rid));
                    if (r) setPickedRule(r);
                }
                modal.classList.remove('show');
            };
        });
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function closeCollectModal() {
        const modal = document.getElementById('qx2_collect_modal');
        if (modal) modal.classList.remove('show');
    }

    async function onCollect() {
        if (state.isGuest) { toast(t('访客不能收藏', 'Guest cannot collect'), 'warning'); return; }
        if (state.pickedRule) { toast(t('这条已是收藏组曲', 'Already collected'), 'warning'); return; }
        if (!state.playlist.length) { toast(t('没有可收藏的组曲', 'No playlist'), 'warning'); return; }
        const defaultName = `${getUserName()}${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Date.now().toString().slice(-4)}`;
        const name = prompt(t('请为这个组曲命名：', 'Name this playlist:'), defaultName);
        if (!name) return;
        try {
            const sequence = state.playlist.map(tr => ({ musictypecode: tr.musictypecode, mode: 'fixed', trackid: tr.trackid }));
            const seqStr = JSON.stringify(sequence);
            const existing = await restGet(`emobao_regulationrule?emotioncode=eq.${state.inputEmotionCode}&ruletype=eq.user_collected&isactive=eq.true`);
            if (existing && existing.length) {
                for (const r of existing) {
                    if (JSON.stringify(r.sequence) === seqStr) {
                        toast(t(`这套组曲已被“${r.createdbyname || 'someone'}”收藏`, `Already collected`), 'warning');
                        return;
                    }
                }
            }
            const resp = await fetch(`${SUPABASE_URL}/rest/v1/emobao_regulationrule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
                body: JSON.stringify({
                    emotioncode: state.inputEmotionCode,
                    rulename: name,
                    ruletype: 'user_collected',
                    sequence: sequence,
                    createdby: getUserId(),
                    createdbyname: getUserName(),
                    isactive: true,
                }),
            });
            if (!resp.ok) throw new Error(await resp.text());
            toast(t('已收藏', 'Collected'), 'success');
        } catch (e) {
            console.error(e);
            toast(t('收藏失败：', 'Collect failed: ') + e.message, 'error');
        }
    }

    function onRestart() {
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio.src = ''; }
        try { qxHrvCapture.stop(); } catch (e) {}
        try { qxHrvCapture.release(); } catch (e) {}
        state.outputEmotionCode = 0;
        state.feedback = null;
        state.playlist = [];
        state.currentIndex = 0;
        state.started = false;
        state.finished = false;
        state.hrvResult = null;
        state.hrvAborted = false;
        state.hrvSeries = [];
        state.hfSeries = [];
        state.latestHint = '';
        state.latestQuality = 'unknown';
        clearPickedRule();

        if (mirrorBeforeId) {
            try { qxMoodMirror.setDoIt('qx2_wheel_before', '做'); } catch (e) {}
        }
        if (mirrorAfterId) qxMoodMirror.setDoIt('qx2_wheel_after', '不做');
        if (mirrorAfterId) qxMoodMirror.setValue('qx2_wheel_after', 0);

        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        const body = document.getElementById('qx2_analysis_body');
        if (body) body.innerHTML = '<div class="qx2-analysis-placeholder">' + t('进第 4 步，自动给出分析', 'Analysis at step 4') + '</div>';
        const hintEl = document.getElementById('qx2_camera_hint');
        if (hintEl) {
            hintEl.innerText = t('请把干净的手指放在摄像头上', 'Put your finger on the camera');
            hintEl.style.color = '#5A6B87';
        }
        setStep(1);
        document.querySelectorAll('input[name="qx2_feedback"]').forEach(r => r.checked = false);
        renderTrendMini();
        updateAllButtonsState();
    }

    function onExit() {
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        if (state.started && !state.finished) {
            if (!confirm(t('正在调整中，确定退出吗？', 'Regulating. Exit?'))) return;
        }
        if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio.src = ''; }
        try { qxHrvCapture.stop(); } catch (e) {}
        try { qxHrvCapture.release(); } catch (e) {}
        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        window.returnToMain();
    }

    async function qx2_init() {
        console.log('qx2_init 开始');
        if (state.initialized) return;
        state.isGuest = (getUserType() === 14);
        state.step = 1;
        state.inputEmotionCode = 0;
        state.outputEmotionCode = 0;
        state.feedback = null;
        state.playlist = [];
        state.currentIndex = 0;
        state.started = false;
        state.finished = false;
        state.hrvResult = null;
        state.hrvAborted = false;
        state.pickedRule = null;
        state.hrvSeries = [];
        state.hfSeries = [];
        state.latestHint = '';
        state.latestQuality = 'unknown';

        if (!document.getElementById('qx2_hrv_wave_hidden')) {
            const hid = document.createElement('div');
            hid.id = 'qx2_hrv_wave_hidden';
            hid.style.position = 'absolute';
            hid.style.width = '1px';
            hid.style.height = '1px';
            hid.style.overflow = 'hidden';
            hid.style.opacity = '0';
            document.body.appendChild(hid);
        }

        let inputCode = 0;
        if (!state.isGuest) {
            try {
                const result = await rpc('emobao_get_today_perception', { p_userid: getUserId() });
                const row = Array.isArray(result) ? result[0] : result;
                if (row && row.emotion_code != null) inputCode = row.emotion_code;
            } catch (e) { console.error('读 qx1 情绪失败', e); }
        }
        state.inputEmotionCode = inputCode;

        initMirrorBefore(inputCode);
        initMirrorAfter();
        bindFeedbackRadios();

        document.getElementById('qx2_btn_restart').onclick = onRestart;
        document.getElementById('qx2_btn_collect').onclick = onCollect;
        document.getElementById('qx2_btn_exit').onclick = onExit;
        document.getElementById('qx2_btn_collection').onclick = onPickCollection;
        const btnStart = document.getElementById('qx2_btn_start');
        if (btnStart) btnStart.onclick = () => { onFlowStepClick(2); };

        const closeBtn = document.getElementById('qx2_collect_modal_close');
        if (closeBtn) closeBtn.onclick = closeCollectModal;
        const modal = document.getElementById('qx2_collect_modal');
        if (modal) modal.onclick = (e) => { if (e.target === modal) closeCollectModal(); };

        document.querySelectorAll('#qx2_flow_bar .qx2-flow-step').forEach(el => {
            el.addEventListener('click', () => {
                const s = parseInt(el.dataset.step);
                if (el.classList.contains('disabled')) return;
                onFlowStepClick(s);
            });
        });

        clearPickedRule();
        setStep(1);
        renderTrendMini();
        updateAllButtonsState();

        state.initialized = true;
        console.log('qx2_init 完成');
    }

    function qx2_destroy() {
        console.log('qx2_destroy');
        state.initialized = false;
        if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio.src = ''; state.audio = null; }
        try { qxHrvCapture.stop(); } catch (e) {}
        try { qxHrvCapture.release(); } catch (e) {}
        if (mirrorBeforeId) { qxMoodMirror.destroy('qx2_wheel_before'); mirrorBeforeId = null; }
        if (mirrorAfterId) { qxMoodMirror.destroy('qx2_wheel_after'); mirrorAfterId = null; }
        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        closeCollectModal();
        const hid = document.getElementById('qx2_hrv_wave_hidden');
        if (hid) hid.remove();
        state.playlist = [];
        state.currentIndex = 0;
        state.started = false;
        state.finished = false;
        state.hrvResult = null;
        state.hrvAborted = false;
        state.pickedRule = null;
        state.hrvSeries = [];
        state.hfSeries = [];
    }

    window.qx2_init = qx2_init;
    window.qx2_destroy = qx2_destroy;

})();