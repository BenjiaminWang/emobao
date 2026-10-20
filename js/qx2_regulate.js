/* ================================================================
   情绪宝 - qx2 情绪调节（v47 终极沉浸版）
   日期：2026-10-20
   修复：开篇内嵌无弹窗、伴随式乐器飘字、静默音频报错、超时自动播放音乐
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const MUSIC_LEVELS = [
        { code: 1,  cn: '壮丽', en: 'Grand' },
        { code: 2,  cn: '激昂', en: 'Intense' },
        { code: 3,  cn: '热烈', en: 'Passionate' },
        { code: 4,  cn: '欢快', en: 'Cheerful' },
        { code: 5,  cn: '轻快', en: 'Lively' },
        { code: 6,  cn: '明朗', en: 'Bright' },
        { code: 7,  cn: '平静', en: 'Calm' },
        { code: 8,  cn: '沉思', en: 'Pensive' },
        { code: 9,  cn: '忧伤', en: 'Melancholy' },
        { code: 10, cn: '压抑', en: 'Down' },
        { code: 11, cn: '悲伤', en: 'Sad' },
        { code: 12, cn: '空灵', en: 'Ethereal' },
    ];

    function getMusicLevelName(code) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        const m = MUSIC_LEVELS.find(x => x.code === code);
        if (!m) return String(code);
        return lang === 2 ? (m.en || m.cn) : m.cn;
    }

    let state = {
        step: 1, isGuest: false, inputEmotionCode: 0, outputEmotionCode: 0, feedback: null,
        playlist: [], currentIndex: 0, audio: null, hrvResult: null, hrvAborted: false,
        started: false, finished: false, initialized: false, hrvSeries: [], hfSeries: [],
        latestHint: '', latestQuality: 'unknown', isWorkMode: false, lastSpokenText: '', lastSpokenTime: 0,
    };

    function t(cn, en) { const lang = (window.mQxb && window.mQxb.Language) || 1; return lang === 1 ? cn : en; }
    function getUserId() { return window.mQxb && window.mQxb.user_id; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getLang() { return (window.mQxb && window.mQxb.Language) || 1; }

    function getCameraGuideText() {
        let facing = 'user';
        if (window.mQxb && window.mQxb.Sensor && window.mQxb.Sensor.hrvCameraFacing) { facing = window.mQxb.Sensor.hrvCameraFacing; }
        const isFront = (facing === 'user');
        
        return getLang() === 1
            ? `请您闭上眼睛听音乐的同时，把干净手指放在${isFront ? '前' : '后'}摄像头上，这样可以帮助您分析出音乐对您情绪的影响。`
            : `Please close your eyes and listen to the music. Put a clean finger on the ${isFront ? 'front' : 'back'} camera. This will help us analyze the impact of music on your emotions.`;
    }

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

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    function applyStepLayout() {
        const container = document.getElementById('qx2_container');
        if (!container) return;
        if (state.step === 2) {
            container.classList.add('step2-mode');
            if (state.isWorkMode) {
                container.classList.add('work-mode');
            } else {
                container.classList.remove('work-mode');
            }
        } else {
            container.classList.remove('step2-mode');
            container.classList.remove('work-mode');
        }
    }
    function setStep(n) {
        state.step = n;
        renderFlowBar();
        updateAllButtonsState();
        applyStepLayout();
    }

    function updateAllButtonsState() {
        const btnStart = document.getElementById('qx2_btn_start');
        const btnCollection = document.getElementById('qx2_btn_collection');
        const inStep1 = (state.step === 1);
        if (btnStart) btnStart.disabled = !inStep1 || !state.inputEmotionCode;
        if (btnCollection) btnCollection.disabled = !inStep1;
    }

    let mirrorBeforeId = null;
    let mirrorAfterId = null;
    function initMirrorBefore(initialCode) {
        mirrorBeforeId = qxMoodMirror.create('qx2_wheel_before', {
            mode: t('听前情绪', 'Before Emotion'),
            initialCode: initialCode || 0,
            doIt: '做',
            thermometerSide: 'right',
            onChange: (code) => {
                state.inputEmotionCode = (code == null) ? 0 : code;
                updateAllButtonsState();
            }
        });
    }
    function initMirrorAfter() {
        mirrorAfterId = qxMoodMirror.create('qx2_wheel_after', {
            mode: t('听后情绪', 'After Emotion'),
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

    async function loadWorks() {
        try {
            const works = await restGet(
                `emo_works?is_published=eq.true&select=workid,title_cn,title_en,composer,cover_url,audio_url,total_duration,era,form,global_valence,global_arousal&order=created_at.asc`
            );
            return works || [];
        } catch (e) {
            console.warn('[qx2] 加载作品失败', e);
            return [];
        }
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
        let el = document.getElementById('qx2_trend_mini_overlay')
              || document.querySelector('#qx2_heal_overlay .qx2-trend-mini')
              || document.getElementById('qx2_trend_mini');
        if (!el) return;

        const videoWrap = el.querySelector('.qx2-trend-video-wrap');
        el.innerHTML = '';
        if (videoWrap) el.appendChild(videoWrap);
        const pl = state.playlist;
        if (pl.length === 0) return;

        if (pl.length > 1) {
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
    }

    function initAudio() {
        if (!state.audio) {
            state.audio = new Audio();
            state.audio.preload = 'auto';
            state.audio.addEventListener('ended', onTrackEnded);
            
            state.audio.addEventListener('stalled', () => {
                if (state.audio && !state.finished) {
                    state.audio.load();
                    state.audio.play().catch(() => {});
                }
            });

            state.audio.addEventListener('error', (e) => {
                if (!state.audio || !state.audio.error) return;
                
                const errCode = state.audio.error.code;
                const curSrc = state.audio.currentSrc;
                
                if (curSrc && !state.finished) {
                    const curTime = state.audio.currentTime;
                    setTimeout(() => {
                        state.audio.load();
                        state.audio.currentTime = curTime;
                        state.audio.play().catch(() => {});
                    }, 500);
                    return;
                }
                
                toast(t('音频连接中断，请点击重新调整', 'Audio disconnected, please restart'), 'error');
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
            if (err.name === 'AbortError') return;
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
        
        if (_workInfo && _workInfo.timelines) {
            const outro = _workInfo.timelines.find(x => x.start_time === x.end_time && x.start_time > 0);
            if (outro && window.qxHelpCard) {
                const lang = getLang();
                const text = lang === 2 ? (outro.ai_guide_text_en || outro.ai_guide_text) : outro.ai_guide_text;
                setTimeout(() => {
                    qxHelpCard.show({ title: t('聆听回顾', 'Post-Listening Review'), body: text });
                }, 500);
            }
        }
        
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
        
        if (series.length < 2) {
            body.innerHTML = `<div class="qx2-analysis-placeholder">${t('等待采样…', 'Waiting for samples…')}</div>`;
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
            html.push(`<div class="qx2-analysis-tip">
                ${t(
                    '如果您在听音乐时进行了 HRV 采样（用手机摄像头或心率带），可以分析音乐对您情绪的影响。',
                    'If you captured HRV while listening (via camera or chest strap), we can analyze the impact of music on your emotions.'
                )}
            </div>`);
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

    /* ============ 时间轴导赏 & 作品信息卡 ============ */
    let _timelineCache = {};
    let _workInfo = {
        work: null,
        timelines: [],
        tags: { instruments: [], styles: [] },
    };

    async function renderWorkInfo(work) {
        const card = document.getElementById('qx2_work_info');
        if (!card) return;
        card.style.display = 'block';
        
        const lang = getLang();
        const title = lang === 1 ? (work.title_cn || work.title_en) : (work.title_en || work.title_cn);
        const composer = work.composer || ''; 

        const dur = work.total_duration ? Math.floor(work.total_duration / 60) + ':' + String(work.total_duration % 60).padStart(2, '0') : '--';
        card.innerHTML = `
            <div class="qx2-wi-title">${escapeHtml(title)}</div>
            <div class="qx2-wi-meta">${escapeHtml(composer)} · ${dur}${work.era ? ' · ' + escapeHtml(work.era) : ''}${work.form ? ' · ' + escapeHtml(work.form) : ''}</div>
            <div class="qx2-wi-curr-seg" id="qx2_wi_curr_seg" style="display:none;">
                <div class="qx2-wi-curr-seg-title" id="qx2_wi_curr_title"></div>
                <div class="qx2-wi-guide" id="qx2_wi_curr_text"></div>
            </div>
            <div class="qx2-wi-section" id="qx2_wi_struct_sec" style="display:none;">
                <div class="qx2-wi-label">${escapeHtml(t('全曲结构', 'Structure'))}</div>
                <div class="qx2-wi-seg-list" id="qx2_wi_seg_list"></div>
            </div>
            <div class="qx2-wi-section" id="qx2_wi_tags_sec" style="display:none;">
                <div class="qx2-wi-label">${escapeHtml(t('配器与风格', 'Instruments & Style'))}</div>
                <div class="qx2-wi-tags" id="qx2_wi_tags"></div>
            </div>
        `;

        _workInfo = { work: work, timelines: [], tags: { instruments: [], styles: [] } };

        try {
            const timelines = await restGet(
                `emo_work_timelines?workid=eq.${work.workid}&select=start_time,end_time,ai_guide_text,ai_guide_text_en,section_name,emotion_tag,arousal_score,instruments,dynamics,form_section&order=start_time.asc`
            );
            _workInfo.timelines = timelines || [];
            _timelineCache[work.workid] = _workInfo.timelines;
            const structSec = document.getElementById('qx2_wi_struct_sec');
            const segList = document.getElementById('qx2_wi_seg_list');
            if (structSec && segList && _workInfo.timelines.length > 0) {
                structSec.style.display = 'block';
                segList.innerHTML = _workInfo.timelines.filter(tl => tl.start_time !== tl.end_time).map((tl, i) => {
                    const mm = Math.floor(tl.start_time / 60);
                    const ss = String(tl.start_time % 60).padStart(2, '0');
                    return `<span class="qx2-wi-seg-item" data-seg="${tl.start_time}">${mm}:${ss} ${escapeHtml(tl.section_name || tl.emotion_tag || '')}</span>`;
                }).join('');
            }
        } catch (e) { 
            console.warn('[qx2] 拉 timelines 失败', e); 
        }

        try {
            const tags = await restGet(
                `emo_work_tags?workid=eq.${work.workid}&select=instrument_name,style_tag`
            );
            const instruments = new Set();
            const styles = new Set();
            (tags || []).forEach(tg => {
                if (tg.instrument_name) instruments.add(tg.instrument_name);
                if (tg.style_tag) styles.add(tg.style_tag);
            });
            _workInfo.tags = { instruments: [...instruments], styles: [...styles] };
            const tagsSec = document.getElementById('qx2_wi_tags_sec');
            const tagsEl = document.getElementById('qx2_wi_tags');
            if (tagsSec && tagsEl && (instruments.size + styles.size) > 0) {
                tagsSec.style.display = 'block';
                const arr = [];
                [...instruments].forEach(n => arr.push(`<span class="qx2-wi-tag">🎻 ${escapeHtml(n)}</span>`));
                [...styles].forEach(n => arr.push(`<span class="qx2-wi-tag">🎨 ${escapeHtml(n)}</span>`));
                tagsEl.innerHTML = arr.join('');
            }
        } catch (e) { console.warn('[qx2] 拉 tags 失败', e); }

        // ================= 特殊处理《春天里》的代序 Q&A 弹窗 =================
        if (work.title_cn.includes('春天里')) {
            state.lastSpokenText = '春天里代序'; 
            if (window.speechSynthesis) window.speechSynthesis.cancel();

            if (window.qxHelpCard && typeof qxHelpCard.show === 'function') {
                const cardEl = document.getElementById('qx2_work_info');
                if (cardEl) {
                    cardEl.style.backgroundImage = 'none';
                    cardEl.style.backgroundColor = '#f8f9fa';
                }

                const bodyText = t(
`《春天里》，那句“如果有一天，我老无所依，请把我留在，在这春天里”总能触动我心底最柔软的地方。

在这个快节奏的时代，我们像陀螺一样旋转，很难静下心来察觉情绪。我们缺少的往往不是道理，而是一个有效、触手可及的工具。

十年的光阴，我把所有的心血都浇筑进了“情绪宝”。只为在这个充满变数的世界里，给大家提供一个能随时安放情绪、拥抱阳光的“春天”。

在情绪宝的创作旅程中，我并不孤单。衷心感谢高天教授对我的多次悉心培训；衷心感谢多位前辈老师的倾囊相授；特别感谢 Ms. Jane Wu 给了巨大的支持；感谢 Mr. Jerry Jarod 在关键问题上提出的宝贵建议。

情绪宝做了一些用心的、有价值的创新工作——比如把人脸情绪识别与情绪的选择、情绪“温度”的视觉化设计；比如引入科学地测量 HRV 数据印证实际的情绪反映，把抽象的自主神经变化成肉眼可见的图形；比如把相关学科专家积累多年的科学的生活事件量表，与移动互联网结合让大家都方便的监督自己的情绪与健康、特别是情绪宝把丰富的古典音乐华彩乐章送到我们身边，针对您不同的情绪状态，与您“情绪同步”，在欣赏音乐的同时自我调整情绪、情绪宝根据您最近遇到的生活事件，把相关的有价值信息送到“知识问答”、情绪宝提供了丰富的趣味测评游戏，在娱乐的同时不断完善“自我认知画像”……

无论你是老朋友还是新朋友，我都诚挚地欢迎你留下宝贵的意见和建议。
联系方式：
情绪宝邮箱：13269595986@163.com
情绪宝微信：13269595986`,
`In "Spring", the line "If one day I have nothing left, please leave me in this spring" always touches the softest part of my heart.

In this fast-paced era, we spin like tops, finding it hard to calm down and perceive our emotions. What we often lack is not reason, but an effective, accessible tool.

Over ten years, I have poured all my efforts into "EmoBao". Just to provide a "spring" in this ever-changing world where everyone can safely place their emotions and embrace the sunshine.

In the journey of creating EmoBao, I am not alone. I sincerely thank Professor Gao Tian for his careful training; I sincerely thank many senior teachers for their generous guidance; special thanks to Ms. Jane Wu for her tremendous support; and thanks to Mr. Jerry Jarod for his valuable suggestions on key issues.

EmoBao has made some thoughtful and valuable innovations—such as facial emotion recognition and visual design of emotional "temperature"; introducing scientific HRV measurement to visualize abstract autonomic changes; combining scientific life event scales with mobile internet to help you monitor your emotions and health. Most importantly, EmoBao brings rich classical music masterpieces to you, syncing with your emotional state, allowing you to adjust emotions while appreciating music. EmoBao also delivers valuable knowledge through Q&A based on your recent life events, and offers a variety of fun assessment games to continuously refine your "self-cognitive profile" while entertaining you...

No matter if you are an old or new friend, I sincerely welcome your valuable opinions and suggestions.
Contact:
EmoBao Email: 13269595986@163.com
EmoBao WeChat: 13269595986`);

                qxHelpCard.show({
                    title: t('情绪宝 · 代序', 'EmoBao · Prologue'),
                    body: bodyText
                });
            }
        }
        // =====================================================================
    }

    function showFloatingTag(text) {
        if (!text) return;
        const container = document.getElementById('qx2_container');
        if (!container) return;

        const tag = document.createElement('div');
        tag.className = 'qx2-floating-tag';
        tag.innerText = text;

        tag.style.position = 'absolute';
        tag.style.bottom = '20%';
        tag.style.left = '50%';
        tag.style.transform = 'translateX(-50%) translateY(0)';
        tag.style.background = 'rgba(0, 0, 0, 0.6)';
        tag.style.color = '#1DB954';
        tag.style.padding = '8px 16px';
        tag.style.borderRadius = '20px';
        tag.style.fontSize = '14px';
        tag.style.border = '1px solid rgba(29, 185, 84, 0.4)';
        tag.style.backdropFilter = 'blur(4px)';
        tag.style.pointerEvents = 'none';
        tag.style.opacity = '0';
        tag.style.transition = 'opacity 1s ease, transform 3s ease';
        tag.style.zIndex = '9999';

        container.appendChild(tag);

        requestAnimationFrame(() => {
            tag.style.opacity = '1';
            tag.style.transform = 'translateX(-50%) translateY(-50px)';
        });

        setTimeout(() => {
            tag.style.opacity = '0';
            setTimeout(() => tag.remove(), 1000);
        }, 3500);
    }

    function updateWorkInfoProgress(currentSec) {
        if (!_workInfo.work) return;
        if (_workInfo.work.title_cn.includes('春天里')) return;

        const seg = _workInfo.timelines.find(x => currentSec >= x.start_time && currentSec < x.end_time && x.start_time !== x.end_time);
        const segBox = document.getElementById('qx2_wi_curr_seg');
        const titleEl = document.getElementById('qx2_wi_curr_title');
        const textEl = document.getElementById('qx2_wi_curr_text');
        
        if (segBox && titleEl && textEl) {
            if (seg) {
                segBox.style.display = 'block';
                
                const lang = getLang();
                const guideText = lang === 2 
                    ? (seg.ai_guide_text_en || seg.ai_guide_text || '') 
                    : (seg.ai_guide_text || '');

                if (state.lastSpokenText !== guideText && seg.instruments) {
                    let tagText = '';
                    if (seg.instruments) tagText += `🎻 ${seg.instruments}`;
                    if (seg.dynamics) tagText += ` · ${seg.dynamics}`;
                    showFloatingTag(tagText);
                }

                const titleStr = `${seg.section_name || ''} ${seg.form_section ? '· ' + seg.form_section : ''}`;
                titleEl.innerText = titleStr.trim();
                textEl.innerText = guideText;
                
                if (guideText && guideText !== state.lastSpokenText) {
                    const now = Date.now();
                    if (now - state.lastSpokenTime > 10000) {
                        state.lastSpokenText = guideText;
                        state.lastSpokenTime = now;
                        if (window.qxSpeak) {
                            window.qxSpeak(state.lastSpokenText, () => {
                                if (state.audio && state.audio.paused && !state.finished) {
                                    state.audio.play().catch(e => console.log('恢复播放失败:', e));
                                }
                            });
                        }
                    }
                }
            } else {
                segBox.style.display = 'none';
            }
        }
        
        const list = document.getElementById('qx2_wi_seg_list');
        if (list) {
            list.querySelectorAll('.qx2-wi-seg-item').forEach((el) => {
                const segStartTime = parseFloat(el.dataset.seg);
                if (seg && seg.start_time === segStartTime) {
                    el.classList.add('active');
                } else {
                    el.classList.remove('active');
                }
            });
        }
    }

    function hideWorkInfo() {
        const card = document.getElementById('qx2_work_info');
        if (card) card.style.display = 'none';
        _workInfo = { work: null, timelines: [], tags: { instruments: [], styles: [] } };
        state.lastSpokenText = '';
    }

    async function showTimelineGuide(workid, currentSec) {
        if (!workid) return;
        updateWorkInfoProgress(currentSec);
        if (!_timelineCache[workid]) {
            try {
                _timelineCache[workid] = await restGet(
                    `emo_work_timelines?workid=eq.${workid}&select=start_time,end_time,ai_guide_text,ai_guide_text_en,section_name,emotion_tag,arousal_score,instruments,dynamics,form_section&order=start_time.asc`
                );
            } catch (e) { return; }
        }
    }

    function transferVideoStream() {
        const srcVideo = document.getElementById('qx2_trend_video');
        const destVideo = document.getElementById('qx2_trend_video_overlay');
        if (srcVideo && destVideo && srcVideo.srcObject) {
            destVideo.srcObject = srcVideo.srcObject;
            destVideo.play().catch(e => console.warn('视频接力播放失败', e));
        }
    }

    async function enterAdjustStep() {
        state.isWorkMode = false;
        state.lastSpokenText = '';
        state.lastSpokenTime = 0;
        hideWorkInfo();
        setStep(2);
        
        if (mirrorBeforeId) {
            try { qxMoodMirror.setDoIt('qx2_wheel_before', '不做'); } catch (e) {}
        }
        try {
            const ruleRes = await loadSystemRule(state.inputEmotionCode);
            if (!ruleRes.ok) { toast(errorToToast(ruleRes.error), 'error'); setStep(1); return; }
            const genRes = await generatePlaylist(ruleRes.rule);
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
                onProgress: (rt) => {
                    if (!rt) return;
                    if (rt.hint !== undefined) state.latestHint = rt.hint;
                    if (rt.quality) state.latestQuality = rt.quality;
                    if (rt.quality === 'good' && rt.bpm > 0) {
                        state.hrvSeries.push({ t: rt.elapsed, bpm: rt.bpm, rmssd: rt.rmssd });
                        if (rt.hf > 0) state.hfSeries.push({ t: rt.elapsed, hf: rt.hf });
                    }
                    if (window.qxHealChart) { try { qxHealChart.push(rt); } catch (e) {} }
                    if (state.step === 2) renderAnalysisLive();
                },
                onComplete: (result) => { state.hrvResult = result; },
                onAbort: (info) => { state.hrvAborted = true; }
            });
            if (!ok) {
                toast(t('摄像头不可用，请检查权限', 'Camera unavailable'), 'error');
                setStep(1);
                return;
            }
            const s = document.querySelector('#' + hidId + ' .qx-hrv-btn-start');
            if (s && !s.disabled) s.click();

            const guideText = getCameraGuideText();
            if (window.qxSpeak) {
                window.qxSpeak(guideText, () => {
                    playCurrentTrack();
                });
            } else {
                playCurrentTrack();
            }

            setTimeout(() => {
                if (!state.audio || state.audio.paused) {
                    playCurrentTrack();
                }
            }, 6000);

            updateAllButtonsState();
        } catch (e) {
            console.error('[qx2] enterAdjustStep 异常', e);
            toast(t('进入调整失败：', 'Enter adjust failed: ') + e.message, 'error');
            setStep(1);
        }
    }

    async function enterAdjustStepForWork(work) {
        state.isWorkMode = true;
        state.lastSpokenText = '';
        state.lastSpokenTime = 0;
        setStep(2);
        transferVideoStream();

        if (mirrorBeforeId) {
            try { qxMoodMirror.setDoIt('qx2_wheel_before', '不做'); } catch (e) {}
        }
        try {
            state.playlist = [{
                trackid: work.workid,
                title_cn: work.title_cn,
                title_en: work.title_en,
                fileurl: work.audio_url,
                musictypecode: 0,
                isWork: true,
                workInfo: work,
            }];
            state.currentIndex = 0;
            state.started = true;
            state.finished = false;
            state.hrvResult = null;
            state.hrvAborted = false;
            state.hrvSeries = [];
            state.hfSeries = [];
            state.latestHint = '';
            state.latestQuality = 'unknown';
            
            await renderWorkInfo(work);
            
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
                onProgress: (rt) => {
                    if (!rt) return;
                    if (rt.quality) state.latestQuality = rt.quality;
                    if (rt.quality === 'good' && rt.bpm > 0) {
                        state.hrvSeries.push({ t: rt.elapsed, bpm: rt.bpm, rmssd: rt.rmssd });
                        if (rt.hf > 0) state.hfSeries.push({ t: rt.elapsed, hf: rt.hf });
                    }
                    if (window.qxHealChart) { try { qxHealChart.push(rt); } catch (e) {} }
                    if (state.audio && work.workid) {
                        showTimelineGuide(work.workid, state.audio.currentTime);
                    }
                    if (state.step === 2) renderAnalysisLive();
                },
                onComplete: (result) => { state.hrvResult = result; },
                onAbort: (info) => { state.hrvAborted = true; }
            });
            if (!ok) {
                toast(t('摄像头不可用，请检查权限', 'Camera unavailable'), 'error');
                setStep(1);
                return;
            }
            const s = document.querySelector('#' + hidId + ' .qx-hrv-btn-start');
            if (s && !s.disabled) s.click();

            let introText = null;
            if (_workInfo && _workInfo.timelines) {
                const intro = _workInfo.timelines.find(x => x.start_time === 0 && x.end_time === 0);
                if (intro) {
                    introText = getLang() === 2 ? (intro.ai_guide_text_en || intro.ai_guide_text) : intro.ai_guide_text;
                }
            }

            const startAudio = () => {
                playCurrentTrack();
                transferVideoStream();
            };

            if (introText) {
                const currSegBox = document.getElementById('qx2_wi_curr_seg');
                const currText = document.getElementById('qx2_wi_curr_text');
                const currTitle = document.getElementById('qx2_wi_curr_title');
                if (currSegBox && currText && currTitle) {
                    currSegBox.style.display = 'block';
                    currTitle.innerText = t('听前准备', 'Preparation');
                    currText.innerText = introText;
                }
                
                if (window.qxSpeak) {
                    const forcePlayTimer = setTimeout(startAudio, 60000);
                    window.qxSpeak(introText, () => {
                        clearTimeout(forcePlayTimer);
                        startAudio();
                    });
                } else {
                    setTimeout(startAudio, 3000);
                }
            } else {
                const guideText = getCameraGuideText();
                if (window.qxSpeak && !work.title_cn.includes('春天里')) {
                    window.qxSpeak(guideText, startAudio);
                } else {
                    startAudio();
                }
            }

            updateAllButtonsState();
        } catch (e) {
            console.error('[qx2] enterAdjustStepForWork 异常', e);
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

    function closeCollectModal() {
        const modal = document.getElementById('qx2_collect_modal');
        if (modal) modal.classList.remove('show');
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
        const works = await loadWorks();
        if (!works || works.length === 0) {
            list.innerHTML = `<div class="qx2-collect-empty">${t('暂无经典作品', 'No classic works yet')}</div>`;
            return;
        }
        const lang = getLang();
        list.innerHTML = works.map(w => {
            const dur = w.total_duration ? Math.floor(w.total_duration / 60) + ':' + String(w.total_duration % 60).padStart(2, '0') : '--';
            const cover = w.cover_url ? `style="background-image:url('${escapeHtml(w.cover_url)}')"` : '';
            const title = lang === 1 ? (w.title_cn || w.title_en) : (w.title_en || w.title_cn);
            
            return `<div class="qx2-work-item" data-workid="${escapeHtml(w.workid)}">
                <div class="qx2-work-cover" ${cover}></div>
                <div class="qx2-work-info">
                    <div class="qx2-work-title">${escapeHtml(title)}</div>
                    <div class="qx2-work-meta">${escapeHtml(w.composer || '')} · ${dur}${w.era ? ' · ' + escapeHtml(w.era) : ''}</div>
                </div>
            </div>`;
        }).join('');
        list.querySelectorAll('.qx2-work-item').forEach(el => {
            el.onclick = () => {
                const wid = el.dataset.workid;
                const work = works.find(w => w.workid === wid);
                if (!work) return;
                modal.classList.remove('show');
                enterAdjustStepForWork(work);
            };
        });
    }

    function onRestart() {
        state.isWorkMode = false;
        state.lastSpokenText = '';
        state.lastSpokenTime = 0;
        hideWorkInfo();
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        if (state.audio) {
            try {
                state.audio.pause();
                state.audio.src = '';
                state.audio.load();
            } catch (e) {}
        }
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
        _timelineCache = {};
        
        if (window.speechSynthesis) window.speechSynthesis.cancel();

        if (mirrorBeforeId) {
            try { qxMoodMirror.setDoIt('qx2_wheel_before', '做'); } catch (e) {}
        }
        if (mirrorAfterId) qxMoodMirror.setDoIt('qx2_wheel_after', '不做');
        if (mirrorAfterId) qxMoodMirror.setValue('qx2_wheel_after', 0);

        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        const body = document.getElementById('qx2_analysis_body');
        if (body) body.innerHTML = '<div class="qx2-analysis-placeholder">' + t('进第 4 步，自动给出分析', 'Analysis at step 4') + '</div>';
        setStep(1);
        document.querySelectorAll('input[name="qx2_feedback"]').forEach(r => r.checked = false);
        renderTrendMini();
        updateAllButtonsState();
    }

    function onExit() {
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        
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
        state.hrvSeries = [];
        state.hfSeries = [];
        state.latestHint = '';
        state.latestQuality = 'unknown';
        state.isWorkMode = false;
        state.lastSpokenText = '';
        state.lastSpokenTime = 0;
        _timelineCache = {};

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

        if (window.qx0ApplyDataI18n) {
            window.qx0ApplyDataI18n();
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

        setStep(1);
        renderTrendMini();
        updateAllButtonsState();

        state.initialized = true;
        console.log('qx2_init 完成');
    }

    function qx2_destroy() {
        console.log('qx2_destroy');
        state.initialized = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        
        if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio.src = ''; state.audio = null; }
        try { qxHrvCapture.stop(); } catch (e) {}
        try { qxHrvCapture.release(); } catch (e) {}
        if (mirrorBeforeId) { qxMoodMirror.destroy('qx2_wheel_before'); mirrorBeforeId = null; }
        if (mirrorAfterId) { qxMoodMirror.destroy('qx2_wheel_after'); mirrorAfterId = null; }
        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        closeCollectModal();
        hideWorkInfo();
        const mid = document.querySelector('.qx2-mid-row');
        if (mid) mid.classList.remove('step2-mode');
        const container = document.getElementById('qx2_container');
        if (container) container.classList.remove('work-mode');
        const hid = document.getElementById('qx2_hrv_wave_hidden');
        if (hid) hid.remove();
        state.playlist = [];
        state.currentIndex = 0;
        state.started = false;
        state.finished = false;
        state.hrvResult = null;
        state.hrvAborted = false;
        state.hrvSeries = [];
        state.hfSeries = [];
        state.lastSpokenText = '';
        state.lastSpokenTime = 0;
        _timelineCache = {};
    }

    window.qx2_init = qx2_init;
    window.qx2_destroy = qx2_destroy;

})();