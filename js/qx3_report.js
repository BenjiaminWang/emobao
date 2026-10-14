/* ================================================================
   情绪宝 - qx3 报告分析
   v5：
   - 覆盖率不足时：不灌 mock，直接空图 + 说明
   - 三个 draw 函数空数据时不再硬撑坐标轴
   - buildSummary 空数据时只给一句
   - setDemoMode('incomplete') 文案改为「数据不足，无法生成报告」
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const FETCH_TIMEOUT_MS = 12000;
    const FETCH_RETRY = 2;
    const FETCH_RETRY_DELAY = 700;

    const MIN_COVERAGE = 0.70;

    const EMOTION_COLORS = {
        1: '#E60000', 2: '#FF4500', 3: '#FF69B4',
        4: '#00C853', 5: '#4CAF50', 6: '#1B5E20',
        7: '#616161', 8: '#0D47A1', 9: '#000000',
    };
    const EMOTION_LIST = [
        { code: 1, cn: '焦躁', en: 'Irritable' },
        { code: 2, cn: '热烈', en: 'Passionate' },
        { code: 3, cn: '欢快', en: 'Cheerful' },
        { code: 4, cn: '轻快', en: 'Lively' },
        { code: 5, cn: '明朗', en: 'Bright' },
        { code: 6, cn: '平静', en: 'Calm' },
        { code: 7, cn: '压抑', en: 'Depressed' },
        { code: 8, cn: '忧伤', en: 'Melancholy' },
        { code: 9, cn: '悲伤', en: 'Sad' },
    ];
    const EMOTION_Y_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    const IMPACT_FACTOR = { 1: 0.5, 2: 1.0, 3: 1.5, 4: 2.0 };

    let state = {
        initialized: false,
        isGuest: false,
        range: 'week',
        days: 7,
        useMock: false,
        mockReason: '',
        emotionDays: {},
        eventDays: {},
        hrvDays: {},
        baselineEmotion: null,
        baselineHrvRmssd: null,
        baselineHrvBpm: null,
    };

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
    function getUserId() { return window.mQxb && window.mQxb.user_id; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }

    /* ============ 网络 ============ */
    async function fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || FETCH_TIMEOUT_MS);
        try {
            const res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
            clearTimeout(timer);
            return res;
        } catch (e) {
            clearTimeout(timer);
            throw e;
        }
    }
    function isRetryableError(e) {
        if (!e) return false;
        if (e.name === 'AbortError') return true;
        const msg = String(e.message || '');
        return msg.indexOf('Failed to fetch') >= 0 ||
               msg.indexOf('NetworkError') >= 0 ||
               msg.indexOf('ERR_CONNECTION_RESET') >= 0;
    }
    async function restGet(path) {
        const url = `${SUPABASE_URL}/rest/v1/${path}`;
        const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
        let lastErr = null;
        for (let i = 0; i < FETCH_RETRY; i++) {
            try {
                const res = await fetchWithTimeout(url, { headers, cache: 'no-store' });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`REST ${path}: ${res.status} ${txt}`);
                }
                return res.json();
            } catch (e) {
                lastErr = e;
                if (i < FETCH_RETRY - 1 && isRetryableError(e)) {
                    await new Promise(r => setTimeout(r, FETCH_RETRY_DELAY));
                    continue;
                }
                throw e;
            }
        }
        throw lastErr;
    }

    /* ============ 日期 ============ */
    function pad2(n) { return String(n).padStart(2, '0'); }
    function dateKey(d) {
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }
    function addDays(d, n) {
        const x = new Date(d); x.setDate(x.getDate() + n); return x;
    }
    function dateRangeKeys(days) {
        const out = [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (let i = days - 1; i >= 0; i--) out.push(dateKey(addDays(today, -i)));
        return out;
    }
    function shortDate(k) {
        const parts = k.split('-');
        return `${parts[1]}/${parts[2]}`;
    }
    function avg(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    /* ============ Toast ============ */
    let _toastTimer = null;
    function toast(text, type) {
        type = type || 'info';
        let bar = document.getElementById('qx3_toast_bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'qx3_toast_bar';
            bar.className = 'qx3-toast-bar';
            document.body.appendChild(bar);
        }
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        bar.className = 'qx3-toast-bar qx3-toast-' + type;
        bar.innerText = text;
        requestAnimationFrame(() => bar.classList.add('show'));
        _toastTimer = setTimeout(() => bar.classList.remove('show'), 3000);
    }

    /* ============ 真实数据拉取 ============ */
    async function loadRealData(days) {
        const uid = getUserId();
        const from = dateRangeKeys(days)[0];
        const to = dateRangeKeys(days)[days - 1];

        const out = { emotionDays: {}, eventDays: {}, hrvDays: {} };

        try {
            const rows = await restGet(
                `emobao_emotiondiary?userid=eq.${encodeURIComponent(uid)}` +
                `&recorddate=gte.${from}&recorddate=lte.${to}&order=recorddate.asc`
            );
            (rows || []).forEach(r => {
                const k = (r.recorddate || '').slice(0, 10);
                if (k && r.emotioncode != null) out.emotionDays[k] = parseInt(r.emotioncode);
            });
        } catch (e) { console.warn('[qx3] emotion 加载失败', e); }

        try {
            const rows = await restGet(
                `emobao_lifeeventrecord?userid=eq.${encodeURIComponent(uid)}` +
                `&recorddate=gte.${from}&recorddate=lte.${to}&order=recorddate.asc`
            );
            (rows || []).forEach(r => {
                const k = (r.recorddate || '').slice(0, 10);
                if (!k) return;
                if (!out.eventDays[k]) out.eventDays[k] = { good: 0, bad: 0, items: [] };
                const nature = r.eventnature || '';
                const level = parseInt(r.impactlevel) || 0;
                const factor = IMPACT_FACTOR[level] || 0;
                if (nature === '好事') out.eventDays[k].good += factor;
                else if (nature === '坏事') out.eventDays[k].bad += factor;
                out.eventDays[k].items.push({
                    eventcode: r.eventcode,
                    eventname_cn: r.eventname_cn || '',
                    eventname_en: r.eventname_en || '',
                    nature, level,
                });
            });
            Object.keys(out.eventDays).forEach(k => {
                out.eventDays[k].good = Math.round(out.eventDays[k].good * 10) / 10;
                out.eventDays[k].bad = Math.round(out.eventDays[k].bad * 10) / 10;
            });
        } catch (e) { console.warn('[qx3] event 加载失败', e); }

        try {
            const rows = await restGet(
                `emobao_hrv_session?userid=eq.${encodeURIComponent(uid)}` +
                `&starttime=gte.${from}T00:00:00&starttime=lte.${to}T23:59:59&order=starttime.asc`
            );
            const tmp = {};
            (rows || []).forEach(r => {
                const k = (r.starttime || '').slice(0, 10);
                if (!k) return;
                if (!tmp[k]) tmp[k] = { rmssd: [], bpm: [] };
                if (r.rmssd != null) tmp[k].rmssd.push(parseFloat(r.rmssd));
                if (r.heartrate != null) tmp[k].bpm.push(parseFloat(r.heartrate));
            });
            Object.keys(tmp).forEach(k => {
                out.hrvDays[k] = {
                    rmssd: avg(tmp[k].rmssd),
                    bpm: avg(tmp[k].bpm),
                };
            });
        } catch (e) { console.warn('[qx3] hrv 加载失败', e); }

        return out;
    }

    /* ============ 演示数据（仅访客用） ============ */
    function buildMockData(days) {
        const keys = dateRangeKeys(days);
        const emotionDays = {};
        const eventDays = {};
        const hrvDays = {};
        const total = keys.length;

        const MOCK_EVENTS_POS = [
            { code: 'M_POS_1', cn: '朋友聚餐', en: 'Dinner with friends' },
            { code: 'M_POS_2', cn: '完成小目标', en: 'Finished a small goal' },
            { code: 'M_POS_3', cn: '收到礼物', en: 'Received a gift' },
            { code: 'M_POS_4', cn: '运动出汗', en: 'Workout' },
            { code: 'M_POS_5', cn: '睡了个好觉', en: 'Slept well' },
        ];
        const MOCK_EVENTS_NEG = [
            { code: 'M_NEG_1', cn: '加班到深夜', en: 'Worked late' },
            { code: 'M_NEG_2', cn: '失眠', en: 'Insomnia' },
            { code: 'M_NEG_3', cn: '经济压力', en: 'Financial pressure' },
            { code: 'M_NEG_4', cn: '交通堵塞', en: 'Traffic jam' },
            { code: 'M_NEG_5', cn: '身体不适', en: 'Feeling unwell' },
        ];

        keys.forEach((k, i) => {
            const posFromEnd = total - 1 - i;
            const wk = 5 - Math.floor(posFromEnd / 7);

            let code;
            if (wk === 1)      code = [6,7,7,8,8,9,7][i % 7];
            else if (wk === 2) code = [5,6,6,7,6,5,7][i % 7];
            else if (wk === 3) code = [5,6,7,6,6,5,7][i % 7];
            else if (wk === 4) code = [6,7,8,8,9,7,8][i % 7];
            else               code = [2,3,3,4,4,5,3][i % 7];
            emotionDays[k] = code;

            const n = (wk === 1 || wk === 4) ? (i % 3 === 0 ? 2 : 1)
                    : (wk === 5) ? (i % 3 === 0 ? 2 : 1)
                    : (i % 4 === 0 ? 2 : 1);
            let good = 0, bad = 0;
            const items = [];
            for (let j = 0; j < n; j++) {
                let nature, level, ev;
                if (wk === 1 || wk === 4) {
                    nature = (j % 3 === 0) ? '好事' : '坏事';
                    level = 2 + ((i + j) % 3);
                } else if (wk === 5) {
                    nature = (j % 4 === 0) ? '坏事' : '好事';
                    level = 1 + ((i + j) % 2);
                } else {
                    nature = (j % 2 === 0) ? '好事' : '坏事';
                    level = 1 + ((i + j) % 3);
                }
                ev = (nature === '好事')
                    ? MOCK_EVENTS_POS[(i + j) % MOCK_EVENTS_POS.length]
                    : MOCK_EVENTS_NEG[(i + j) % MOCK_EVENTS_NEG.length];
                const factor = IMPACT_FACTOR[level] || 0;
                if (nature === '好事') good += factor;
                else bad += factor;
                items.push({
                    eventcode: ev.code,
                    eventname_cn: ev.cn,
                    eventname_en: ev.en,
                    nature, level,
                });
            }
            eventDays[k] = { good: Math.round(good * 10) / 10, bad: Math.round(bad * 10) / 10, items };

            let bpm, rmssd;
            if (wk === 1)      { bpm = 80 + (i % 6); rmssd = 32 + (i % 10); }
            else if (wk === 2) { bpm = 72 + (i % 6); rmssd = 48 + (i % 10); }
            else if (wk === 3) { bpm = 70 + (i % 6); rmssd = 52 + (i % 10); }
            else if (wk === 4) { bpm = 78 + (i % 6); rmssd = 34 + (i % 10); }
            else               { bpm = 64 + (i % 6); rmssd = 62 + (i % 10); }
            hrvDays[k] = { rmssd, bpm };
        });

        return { emotionDays, eventDays, hrvDays };
    }

    /* ============ 空图占位 ============ */
    function drawEmptyChart(host, msgCn, msgEn) {
        const w = Math.max(300, host.clientWidth || 320);
        const h = Math.max(180, host.clientHeight || 220);
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        const txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('x', w / 2);
        txt.setAttribute('y', h / 2);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('font-size', 12);
        txt.setAttribute('fill', '#96A3B8');
        txt.textContent = t(msgCn, msgEn);
        svg.appendChild(txt);
        host.appendChild(svg);
    }

    /* ============ 图：情绪基线 ============ */
    function drawEmotionChart() {
        const host = document.getElementById('qx3_emotion_chart');
        if (!host) return;
        host.innerHTML = '';

        const keys = dateRangeKeys(state.days);

        const hasAny = keys.some(k => state.emotionDays[k] != null);
        if (!hasAny) {
            drawEmptyChart(host, '本报告期数据不足，暂无图表', 'Not enough data for this period');
            const sub = document.getElementById('qx3_emotion_sub');
            if (sub) sub.textContent = t('无数据', 'No data');
            state.baselineEmotion = null;
            return;
        }

        const w = Math.max(300, host.clientWidth || 320);
        const h = Math.max(180, host.clientHeight || 220);
        const padL = 52, padR = 16, padT = 16, padB = 28;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        const yForCode = (code) => {
            const idx = EMOTION_Y_ORDER.indexOf(code);
            return padT + (idx / (EMOTION_Y_ORDER.length - 1)) * plotH;
        };

        EMOTION_Y_ORDER.forEach(code => {
            const y = yForCode(code);
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', padL);
            line.setAttribute('x2', padL + plotW);
            line.setAttribute('y1', y);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', '#EEF3F8');
            line.setAttribute('stroke-width', 1);
            svg.appendChild(line);

            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', padL - 6);
            label.setAttribute('y', y + 3);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', 10);
            label.setAttribute('fill', EMOTION_COLORS[code]);
            label.setAttribute('font-weight', 'bold');
            const info = EMOTION_LIST.find(e => e.code === code);
            const lang = (window.mQxb && window.mQxb.Language) || 1;
            label.textContent = info ? (lang === 1 ? info.cn : info.en) : String(code);
            svg.appendChild(label);
        });

        const xForIdx = (i) => {
            if (keys.length === 1) return padL + plotW / 2;
            return padL + (i / (keys.length - 1)) * plotW;
        };

        const showEvery = keys.length > 60 ? 30 : (keys.length > 20 ? 3 : 1);
        keys.forEach((k, i) => {
            if (i % showEvery !== 0 && i !== keys.length - 1) return;
            const x = xForIdx(i);
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', h - 8);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', 9);
            label.setAttribute('fill', '#5A6B87');
            label.textContent = shortDate(k);
            svg.appendChild(label);
        });

        const validCodes = [];
        keys.forEach((k, i) => {
            const code = state.emotionDays[k];
            if (code == null) return;
            validCodes.push(code);
            const x = xForIdx(i);
            const y = yForCode(code);
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', 4.5);
            circle.setAttribute('fill', EMOTION_COLORS[code] || '#333');
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', 1.5);
            svg.appendChild(circle);
        });

        if (validCodes.length > 0) {
            const mean = avg(validCodes);
            state.baselineEmotion = mean;
            const yMean = padT + ((mean - 1) / (EMOTION_Y_ORDER.length - 1)) * plotH;
            const dash = document.createElementNS(svgNS, 'line');
            dash.setAttribute('x1', padL);
            dash.setAttribute('x2', padL + plotW);
            dash.setAttribute('y1', yMean);
            dash.setAttribute('y2', yMean);
            dash.setAttribute('stroke', '#2C7BE5');
            dash.setAttribute('stroke-width', 2);
            dash.setAttribute('stroke-dasharray', '6 4');
            svg.appendChild(dash);

            const meanLabel = document.createElementNS(svgNS, 'text');
            meanLabel.setAttribute('x', padL + plotW - 4);
            meanLabel.setAttribute('y', yMean - 4);
            meanLabel.setAttribute('text-anchor', 'end');
            meanLabel.setAttribute('font-size', 10);
            meanLabel.setAttribute('fill', '#2C7BE5');
            meanLabel.setAttribute('font-weight', 'bold');
            meanLabel.textContent = t('基线 ', 'Baseline ') + mean.toFixed(2);
            svg.appendChild(meanLabel);
        } else {
            state.baselineEmotion = null;
        }

        host.appendChild(svg);

        const sub = document.getElementById('qx3_emotion_sub');
        if (sub) {
            sub.textContent = validCodes.length
                ? t(`${validCodes.length}/${keys.length} 天有记录`, `${validCodes.length}/${keys.length} days`)
                : t('无数据', 'No data');
        }
    }

    /* ============ 图：生活事件综合 ============ */
    function drawEventChart() {
        const host = document.getElementById('qx3_event_chart');
        if (!host) return;
        host.innerHTML = '';

        const keys = dateRangeKeys(state.days);

        const hasAny = keys.some(k => state.eventDays[k] && (state.eventDays[k].good > 0 || state.eventDays[k].bad > 0));
        if (!hasAny) {
            drawEmptyChart(host, '本报告期数据不足，暂无图表', 'Not enough data for this period');
            const totalsEl = document.getElementById('qx3_event_totals');
            if (totalsEl) totalsEl.textContent = '';
            const sub = document.getElementById('qx3_event_sub');
            if (sub) sub.textContent = t('无数据', 'No data');
            return;
        }

        const w = Math.max(300, host.clientWidth || 320);
        const h = Math.max(180, host.clientHeight || 220);
        const padL = 34, padR = 16, padT = 16, padB = 28;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;
        const midY = padT + plotH / 2;

        let maxGood = 0, maxBad = 0;
        keys.forEach(k => {
            const d = state.eventDays[k];
            if (!d) return;
            if (d.good > maxGood) maxGood = d.good;
            if (d.bad > maxBad) maxBad = d.bad;
        });
        const maxAbs = Math.max(1, maxGood, maxBad);

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        const zeroLine = document.createElementNS(svgNS, 'line');
        zeroLine.setAttribute('x1', padL);
        zeroLine.setAttribute('x2', padL + plotW);
        zeroLine.setAttribute('y1', midY);
        zeroLine.setAttribute('y2', midY);
        zeroLine.setAttribute('stroke', '#999');
        zeroLine.setAttribute('stroke-width', 1);
        zeroLine.setAttribute('stroke-dasharray', '4 3');
        svg.appendChild(zeroLine);

        [1, 0.5, 0, -0.5, -1].forEach(ratio => {
            const y = midY - ratio * (plotH / 2);
            const val = (ratio * maxAbs).toFixed(1);
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', padL - 4);
            label.setAttribute('y', y + 3);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', 9);
            label.setAttribute('fill', '#96A3B8');
            label.textContent = val;
            svg.appendChild(label);
        });

        const xForIdx = (i) => {
            if (keys.length === 1) return padL + plotW / 2;
            return padL + (i / (keys.length - 1)) * plotW;
        };
        const barW = Math.max(4, Math.min(16, plotW / keys.length * 0.6));
        const showEvery = keys.length > 60 ? 30 : (keys.length > 20 ? 3 : 1);

        keys.forEach((k, i) => {
            const x = xForIdx(i);
            const d = state.eventDays[k] || { good: 0, bad: 0 };

            if (d.good > 0) {
                const bh = (d.good / maxAbs) * (plotH / 2);
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', x - barW / 2);
                rect.setAttribute('y', midY - bh);
                rect.setAttribute('width', barW);
                rect.setAttribute('height', bh);
                rect.setAttribute('fill', '#E53935');
                rect.setAttribute('rx', 1.5);
                svg.appendChild(rect);
            }
            if (d.bad > 0) {
                const bh = (d.bad / maxAbs) * (plotH / 2);
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', x - barW / 2);
                rect.setAttribute('y', midY);
                rect.setAttribute('width', barW);
                rect.setAttribute('height', bh);
                rect.setAttribute('fill', '#212121');
                rect.setAttribute('rx', 1.5);
                svg.appendChild(rect);
            }

            if (i % showEvery === 0 || i === keys.length - 1) {
                const label = document.createElementNS(svgNS, 'text');
                label.setAttribute('x', x);
                label.setAttribute('y', h - 8);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', 9);
                label.setAttribute('fill', '#5A6B87');
                label.textContent = shortDate(k);
                svg.appendChild(label);
            }
        });

        host.appendChild(svg);

        const totalsEl = document.getElementById('qx3_event_totals');
        if (totalsEl) {
            let good = 0, bad = 0;
            keys.forEach(k => {
                const d = state.eventDays[k];
                if (!d) return;
                good += d.good;
                bad += d.bad;
            });
            totalsEl.textContent = t(
                `合计 好事 ${good.toFixed(1)} / 坏事 ${bad.toFixed(1)}`,
                `Total good ${good.toFixed(1)} / bad ${bad.toFixed(1)}`
            );
        }

        const sub = document.getElementById('qx3_event_sub');
        if (sub) {
            const daysWith = keys.filter(k => state.eventDays[k] && (state.eventDays[k].good > 0 || state.eventDays[k].bad > 0)).length;
            sub.textContent = daysWith
                ? t(`${daysWith}/${keys.length} 天有事件`, `${daysWith}/${keys.length} days`)
                : t('无数据', 'No data');
        }
    }

    /* ============ 图：HRV 基线 ============ */
    function drawHrvChart() {
        const host = document.getElementById('qx3_hrv_chart');
        if (!host) return;
        host.innerHTML = '';

        const keys = dateRangeKeys(state.days);

        const hasAny = keys.some(k => state.hrvDays[k]);
        if (!hasAny) {
            drawEmptyChart(host, '本报告期数据不足，暂无图表', 'Not enough data for this period');
            const sub = document.getElementById('qx3_hrv_sub');
            if (sub) sub.textContent = t('无数据', 'No data');
            state.baselineHrvRmssd = null;
            state.baselineHrvBpm = null;
            return;
        }

        const w = Math.max(300, host.clientWidth || 320);
        const h = Math.max(180, host.clientHeight || 220);
        const padL = 40, padR = 40, padT = 16, padB = 28;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        const rmssdVals = keys.map(k => state.hrvDays[k] ? state.hrvDays[k].rmssd : null);
        const bpmVals   = keys.map(k => state.hrvDays[k] ? state.hrvDays[k].bpm : null);
        const rmssdValid = rmssdVals.filter(v => v != null);
        const bpmValid = bpmVals.filter(v => v != null);

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        if (rmssdValid.length === 0 && bpmValid.length === 0) {
            const txt = document.createElementNS(svgNS, 'text');
            txt.setAttribute('x', w / 2);
            txt.setAttribute('y', h / 2);
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('font-size', 12);
            txt.setAttribute('fill', '#96A3B8');
            txt.textContent = t('无 HRV 数据', 'No HRV data');
            svg.appendChild(txt);
            host.appendChild(svg);
            const sub = document.getElementById('qx3_hrv_sub');
            if (sub) sub.textContent = t('无数据', 'No data');
            return;
        }

        const rmMin = rmssdValid.length ? Math.min(...rmssdValid) - 5 : 0;
        const rmMax = rmssdValid.length ? Math.max(...rmssdValid) + 5 : 100;
        const bpMin = bpmValid.length ? Math.min(...bpmValid) - 5 : 50;
        const bpMax = bpmValid.length ? Math.max(...bpmValid) + 5 : 100;

        const xForIdx = (i) => {
            if (keys.length === 1) return padL + plotW / 2;
            return padL + (i / (keys.length - 1)) * plotW;
        };
        const yForRm = (v) => padT + plotH - ((v - rmMin) / (rmMax - rmMin || 1)) * plotH;
        const yForBp = (v) => padT + plotH - ((v - bpMin) / (bpMax - bpMin || 1)) * plotH;

        for (let k = 0; k <= 4; k++) {
            const y = padT + plotH * k / 4;
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', padL);
            line.setAttribute('x2', padL + plotW);
            line.setAttribute('y1', y);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', '#EEF3F8');
            line.setAttribute('stroke-width', 1);
            svg.appendChild(line);
        }

        const showEvery = keys.length > 60 ? 30 : (keys.length > 20 ? 3 : 1);
        keys.forEach((k, i) => {
            if (i % showEvery !== 0 && i !== keys.length - 1) return;
            const x = xForIdx(i);
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', h - 8);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', 9);
            label.setAttribute('fill', '#5A6B87');
            label.textContent = shortDate(k);
            svg.appendChild(label);
        });

        if (rmssdValid.length > 0) {
            let dPath = '';
            rmssdVals.forEach((v, i) => {
                if (v == null) return;
                const x = xForIdx(i);
                const y = yForRm(v);
                dPath += (dPath ? ' L' : 'M') + x + ' ' + y;
            });
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', dPath);
            path.setAttribute('stroke', '#2C7BE5');
            path.setAttribute('stroke-width', 2);
            path.setAttribute('fill', 'none');
            svg.appendChild(path);

            rmssdVals.forEach((v, i) => {
                if (v == null) return;
                const x = xForIdx(i);
                const y = yForRm(v);
                const c = document.createElementNS(svgNS, 'circle');
                c.setAttribute('cx', x);
                c.setAttribute('cy', y);
                c.setAttribute('r', 2.5);
                c.setAttribute('fill', '#2C7BE5');
                svg.appendChild(c);
            });

            const mean = avg(rmssdValid);
            state.baselineHrvRmssd = mean;
            const yMean = yForRm(mean);
            const dash = document.createElementNS(svgNS, 'line');
            dash.setAttribute('x1', padL);
            dash.setAttribute('x2', padL + plotW);
            dash.setAttribute('y1', yMean);
            dash.setAttribute('y2', yMean);
            dash.setAttribute('stroke', '#2C7BE5');
            dash.setAttribute('stroke-width', 1.5);
            dash.setAttribute('stroke-dasharray', '5 4');
            svg.appendChild(dash);

            const lbl = document.createElementNS(svgNS, 'text');
            lbl.setAttribute('x', padL + plotW - 4);
            lbl.setAttribute('y', yMean - 4);
            lbl.setAttribute('text-anchor', 'end');
            lbl.setAttribute('font-size', 9);
            lbl.setAttribute('fill', '#2C7BE5');
            lbl.textContent = 'RMSSD ' + mean.toFixed(1);
            svg.appendChild(lbl);
        }

        if (bpmValid.length > 0) {
            let dPath = '';
            bpmVals.forEach((v, i) => {
                if (v == null) return;
                const x = xForIdx(i);
                const y = yForBp(v);
                dPath += (dPath ? ' L' : 'M') + x + ' ' + y;
            });
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', dPath);
            path.setAttribute('stroke', '#E53935');
            path.setAttribute('stroke-width', 1.5);
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', 0.8);
            svg.appendChild(path);

            const mean = avg(bpmValid);
            state.baselineHrvBpm = mean;
            const yMean = yForBp(mean);
            const dash = document.createElementNS(svgNS, 'line');
            dash.setAttribute('x1', padL);
            dash.setAttribute('x2', padL + plotW);
            dash.setAttribute('y1', yMean);
            dash.setAttribute('y2', yMean);
            dash.setAttribute('stroke', '#E53935');
            dash.setAttribute('stroke-width', 1.5);
            dash.setAttribute('stroke-dasharray', '5 4');
            svg.appendChild(dash);
        }

        host.appendChild(svg);

        const sub = document.getElementById('qx3_hrv_sub');
        if (sub) {
            sub.textContent = t(
                `${rmssdValid.length}/${keys.length} 天有 HRV`,
                `${rmssdValid.length}/${keys.length} days`
            );
        }
    }

    /* ============ 总评语 ============ */
    function buildSummary() {
        const body = document.getElementById('qx3_summary_body');
        if (!body) return;

        const keys = dateRangeKeys(state.days);
        const totalDays = keys.length;
        const lang = (window.mQxb && window.mQxb.Language) || 1;

        /* 空数据：不编叙述 */
        const hasAnyAll = keys.some(k => state.emotionDays[k] != null)
                       || keys.some(k => state.eventDays[k] && state.eventDays[k].items && state.eventDays[k].items.length)
                       || keys.some(k => state.hrvDays[k]);
        if (!hasAnyAll) {
            body.innerHTML = `<div class="qx3-summary-placeholder">${t('本报告期数据不足，无法生成分析。请继续记录。', 'Not enough data for this period. Keep recording.')}</div>`;
            const sub = document.getElementById('qx3_summary_sub');
            if (sub) sub.textContent = t(`${totalDays} 天窗口`, `${totalDays}-day window`);
            state.baselineEmotion = null;
            state.baselineHrvRmssd = null;
            state.baselineHrvBpm = null;
            return;
        }

        /* ---------- 1. 汇总 ---------- */
        let posScore = 0;
        let negScore = 0;
        let posCount = 0;
        let negCount = 0;

        const eventDaysMap = {};
        const eventNameMap = {};

        keys.forEach(k => {
            const day = state.eventDays[k];
            if (!day || !day.items) return;
            day.items.forEach(it => {
                const level = parseInt(it.level) || 0;
                if (it.nature === '好事') { posScore += level; posCount++; }
                else { negScore += level; negCount++; }

                const code = it.eventcode || '';
                if (!code) return;
                if (!eventDaysMap[code]) eventDaysMap[code] = new Set();
                eventDaysMap[code].add(k);
                if (!eventNameMap[code]) {
                    eventNameMap[code] = {
                        cn: it.eventname_cn || '',
                        en: it.eventname_en || '',
                    };
                }
            });
        });

        const totalScore = posScore + negScore;
        const totalEvents = posCount + negCount;

        /* ---------- 2. 情绪、HRV ---------- */
        const emotionAvg = state.baselineEmotion;
        const hrvRmssd = state.baselineHrvRmssd;
        const hrvBpm = state.baselineHrvBpm;

        const codeList = keys.map(k => state.emotionDays[k]).filter(v => v != null);
        const codeMax = codeList.length ? Math.max(...codeList) : null;
        const codeMin = codeList.length ? Math.min(...codeList) : null;
        const codeRange = (codeMax != null && codeMin != null) ? (codeMax - codeMin) : null;

        /* ---------- 3. 高频事件 ---------- */
        const freqThreshold = totalDays * 3 / 7;
        const freqList = [];
        Object.keys(eventDaysMap).forEach(code => {
            const days = eventDaysMap[code].size;
            if (days >= freqThreshold) {
                freqList.push({
                    code,
                    days,
                    nameCn: eventNameMap[code].cn,
                    nameEn: eventNameMap[code].en,
                });
            }
        });
        freqList.sort((a, b) => b.days - a.days);

        /* ---------- 4. 档位 ---------- */
        const rangeLabel = {
            week:     { cn: '最近一周', en: 'the past week' },
            month:    { cn: '最近一月', en: 'the past month' },
            halfyear: { cn: '最近半年', en: 'the past half year' },
            year:     { cn: '最近一年', en: 'the past year' },
        }[state.range] || { cn: '本报告期', en: 'this period' };

        let moodLevel = 'neutral';
        if (emotionAvg != null) {
            if (emotionAvg <= 3) moodLevel = 'bright';
            else if (emotionAvg <= 5) moodLevel = 'light';
            else if (emotionAvg <= 7) moodLevel = 'dim';
            else moodLevel = 'low';
        }

        let hrvLevel = 'unknown';
        if (hrvRmssd != null) {
            if (hrvRmssd >= 60) hrvLevel = 'high';
            else if (hrvRmssd >= 45) hrvLevel = 'normal';
            else if (hrvRmssd >= 30) hrvLevel = 'low';
            else hrvLevel = 'verylow';
        }

        let swingLevel = 'mid';
        if (codeRange != null) {
            if (codeRange <= 2) swingLevel = 'stable';
            else if (codeRange <= 4) swingLevel = 'mid';
            else swingLevel = 'wild';
        }

        let riskLevel = null;
        if (state.range !== 'week') {
            if (totalScore < 20) riskLevel = 'low';
            else if (totalScore <= 32) riskLevel = 'mid';
            else riskLevel = 'high';
        }

        /* ---------- 5. 叙述段 ---------- */
        const parts = [];

        if (emotionAvg != null) {
            if (moodLevel === 'bright') {
                parts.push(t('这段时间整体情绪偏欢快，正性体验占了上风。',
                             'Overall cheerful, positive moments dominate.'));
            } else if (moodLevel === 'light') {
                parts.push(t('情绪以明朗、平稳为主，没有明显下坠。',
                             'Mostly bright and steady, no obvious dip.'));
            } else if (moodLevel === 'dim') {
                parts.push(t('情绪以压抑为主，偶有沉下来的时候。',
                             'Mostly depressed, with some low moments.'));
            } else {
                parts.push(t('情绪偏向忧伤、低沉，恢复需要时间。',
                             'Mood is melancholic and low; recovery takes time.'));
            }
        }

        if (codeRange != null) {
            if (swingLevel === 'stable') {
                parts.push(t('情绪起伏不大，整体比较稳定。',
                             'Emotional swings are small, fairly stable.'));
            } else if (swingLevel === 'mid') {
                parts.push(t('情绪有一定起伏，属正常范围。',
                             'Some ups and downs, within normal range.'));
            } else {
                parts.push(t('情绪波动较大，像坐过山车一样。',
                             'Large emotional swings, like a roller coaster.'));
            }
        }

        if (freqList.length > 0) {
            const names = freqList.map(f => {
                return lang === 1 ? f.nameCn : (f.nameEn || f.nameCn);
            }).filter(n => n);
            if (names.length > 0) {
                const quoted = names.map(n => '“' + n + '”').join('');
                parts.push(t(
                    `${rangeLabel.cn}情绪受${quoted}影响较多。`,
                    `${rangeLabel.en}, emotion is strongly affected by ${quoted}.`
                ));
            }
        }

        if (hrvLevel !== 'unknown') {
            if (hrvLevel === 'high') {
                parts.push(t('HRV 偏高，副交感占优，说明身体修复得不错。',
                             'HRV is high; parasympathetic dominance suggests good recovery.'));
            } else if (hrvLevel === 'normal') {
                parts.push(t('HRV 在正常区间，身心相对平衡。',
                             'HRV is within normal range; body and mind are relatively balanced.'));
            } else if (hrvLevel === 'low') {
                parts.push(t('HRV 偏低，提示身体还在应付一些压力。',
                             'HRV is low, indicating the body is still handling some stress.'));
            } else {
                parts.push(t('HRV 明显偏低，提示较大的应激负荷。',
                             'HRV is clearly low, suggesting a significant stress load.'));
            }
        }

        if (totalEvents === 0) {
            parts.push(t('这段时间还没有生活事件记录。',
                         'No life events recorded in this period.'));
        } else {
            const posNegDiff = posScore - negScore;
            if (posNegDiff > 10) {
                parts.push(t('生活事件以正性为主，好事多于坏事。',
                             'Life events lean positive, more good than bad.'));
            } else if (posNegDiff < -10) {
                parts.push(t('生活事件以负性为主，坏事多于好事。',
                             'Life events lean negative, more bad than good.'));
            } else {
                parts.push(t('正负性事件大体相当。',
                             'Positive and negative events are roughly balanced.'));
            }
        }

        /* ---------- 6. 建议 ---------- */
        let advice;
        if (riskLevel === 'high') {
            advice = t('建议安排适度运动、规律作息，并减少额外压力源。如有必要则寻求专业心理支持。',
                       'Suggest moderate exercise, regular rest, and reduce extra stress. Seek professional support if necessary.');
        } else if (riskLevel === 'mid') {
            advice = t('建议保持规律作息、适度运动，多用情绪宝进行情绪调节。',
                       'Suggest keeping regular rest, moderate exercise, and using Emo Treasure to regulate.');
        } else if (riskLevel === 'low') {
            advice = t('继续保持良好的作息与情绪管理习惯。',
                       'Keep up good rest and emotional management.');
        } else {
            advice = t('时间较短，暂不下长期结论。继续记录，长期趋势会逐渐清晰。',
                       'The window is short; no long-term conclusion yet. Keep recording — trends will emerge.');
        }

        /* ---------- 7. 渲染 ---------- */
        const lines = [];

        if (riskLevel === 'high') {
            lines.push(`<div class="qx3-summary-level" style="color:#E74C3C">${t('显著应激', 'Significant stress')} · ${t('总分', 'Score')} ${totalScore}</div>`);
        } else if (riskLevel === 'mid') {
            lines.push(`<div class="qx3-summary-level" style="color:#F39C12">${t('轻中度应激', 'Mild–moderate stress')} · ${t('总分', 'Score')} ${totalScore}</div>`);
        } else if (riskLevel === 'low') {
            lines.push(`<div class="qx3-summary-level" style="color:#2ECC71">${t('低风险', 'Low risk')} · ${t('总分', 'Score')} ${totalScore}</div>`);
        } else {
            lines.push(`<div class="qx3-summary-level" style="color:#2C7BE5">${rangeLabel.cn} · ${t('事件', 'Events')} ${totalEvents} ${t('条', '')}</div>`);
        }

        lines.push(`<div class="qx3-summary-row"><b>${t('正性事件刺激量', 'Positive')}</b>：${posScore} · <b>${t('负性事件刺激量', 'Negative')}</b>：${negScore}</div>`);
        lines.push(`<div class="qx3-summary-row"><b>${t('情绪基线', 'Emotion baseline')}</b>：${emotionAvg != null ? emotionAvg.toFixed(2) : '—'}${codeRange != null ? ` · ${t('波动幅度', 'Range')} ${codeRange}` : ''}</div>`);
        lines.push(`<div class="qx3-summary-row"><b>${t('HRV 基线', 'HRV baseline')}</b>：${hrvRmssd != null ? `RMSSD ${hrvRmssd.toFixed(1)}${hrvBpm != null ? ' / HR ' + hrvBpm.toFixed(0) : ''}` : '—'}</div>`);

        if (parts.length > 0) {
            lines.push(`<div class="qx3-summary-narrative">${parts.join('')}</div>`);
        }

        lines.push(`<div class="qx3-summary-advice">${advice}</div>`);

        body.innerHTML = lines.join('');

        const sub = document.getElementById('qx3_summary_sub');
        if (sub) {
            sub.textContent = t(`${totalDays} 天窗口`, `${totalDays}-day window`);
        }
    }

    /* ============ 演示模式 ============ */
    function setDemoMode(reason, coverage, covered, total) {
        state.useMock = true;
        state.mockReason = reason;
        const bar = document.getElementById('qx3_demo_bar');
        if (bar) {
            bar.style.display = 'block';
            if (reason === 'guest') {
                bar.innerText = t(
                    '访客体验 · 以下为演示数据，成为 VIP 记录 7 天后可查看真实分析',
                    'Guest demo · Sample data. Become VIP and record for 7 days to see your real analysis.'
                );
                bar.className = 'qx3-demo-bar qx3-demo-guest';
            } else if (reason === 'incomplete') {
                const rangeCn = { week: '近一周', month: '近一月', halfyear: '近半年', year: '近一年' }[state.range] || '本报告期';
                const rangeEn = { week: 'weekly', month: 'monthly', halfyear: 'half-year', year: 'yearly' }[state.range] || 'this period';
                const pct = Math.round((coverage || 0) * 100);
                bar.innerText = t(
                    `没有${rangeCn}的完整数据（覆盖 ${covered}/${total} 天，约 ${pct}%）· 无法生成报告，请继续记录`,
                    `Not enough complete data for ${rangeEn} (${covered}/${total} days, ~${pct}%). Cannot generate report yet.`
                );
                bar.className = 'qx3-demo-bar qx3-demo-incomplete';
            } else {
                bar.innerText = t('模拟数据', 'Sample data');
                bar.className = 'qx3-demo-bar';
            }
        }
    }

    function clearDemoMode() {
        state.useMock = false;
        state.mockReason = '';
        const bar = document.getElementById('qx3_demo_bar');
        if (bar) { bar.style.display = 'none'; bar.innerText = ''; }
    }

    async function refresh() {
        const status = document.getElementById('qx3_status');
        if (status) status.innerText = t('加载中…', 'Loading…');

        state.isGuest = (getUserType() === 14);
        state.days = { week: 7, month: 30, halfyear: 180, year: 365 }[state.range];

        if (state.isGuest) {
            /* 访客：走演示数据 */
            const mock = buildMockData(state.days);
            state.emotionDays = mock.emotionDays;
            state.eventDays = mock.eventDays;
            state.hrvDays = mock.hrvDays;
            setDemoMode('guest');
        } else {
            const data = await loadRealData(state.days);
            const keys = dateRangeKeys(state.days);
            const totalDays = keys.length;
            const emotionCovered = keys.filter(k => data.emotionDays[k] != null).length;
            const coverage = totalDays > 0 ? emotionCovered / totalDays : 0;

            if (coverage < MIN_COVERAGE) {
                /* 数据不足：不画图、不编叙述，只提示 */
                state.emotionDays = {};
                state.eventDays = {};
                state.hrvDays = {};
                setDemoMode('incomplete', coverage, emotionCovered, totalDays);
            } else {
                state.emotionDays = data.emotionDays;
                state.eventDays = data.eventDays;
                state.hrvDays = data.hrvDays;
                clearDemoMode();
            }
        }

        drawEmotionChart();
        drawEventChart();
        drawHrvChart();
        buildSummary();

        if (status) {
            if (state.useMock) {
                status.innerText = t('模拟数据', 'Sample');
            } else {
                const keys = dateRangeKeys(state.days);
                status.innerText = shortDate(keys[0]) + ' – ' + shortDate(keys[keys.length - 1]);
            }
        }
    }

    function bindRangeSwitch() {
        const sw = document.getElementById('qx3_range_switch');
        if (!sw) return;
        sw.querySelectorAll('.qx3-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                sw.querySelectorAll('.qx3-range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.range = btn.dataset.range;
                refresh();
            });
        });
    }

    async function qx3_init() {
        console.log('qx3_init 开始');
        if (state.initialized) return;

        state.range = 'week';
        state.days = 7;
        state.emotionDays = {};
        state.eventDays = {};
        state.hrvDays = {};

        bindRangeSwitch();

        const exitBtn = document.getElementById('qx3_btn_exit');
        if (exitBtn) exitBtn.onclick = () => window.returnToMain();

        window.addEventListener('resize', onResizeDebounced);

        await refresh();

        state.initialized = true;
        console.log('qx3_init 完成');
    }

    let _resizeTimer = null;
    function onResizeDebounced() {
        if (_resizeTimer) clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            if (state.initialized) {
                drawEmotionChart();
                drawEventChart();
                drawHrvChart();
            }
        }, 150);
    }

    function qx3_destroy() {
        console.log('qx3_destroy');
        state.initialized = false;
        window.removeEventListener('resize', onResizeDebounced);
        state.emotionDays = {};
        state.eventDays = {};
        state.hrvDays = {};
    }

    window.qx3_init = qx3_init;
    window.qx3_destroy = qx3_destroy;

})();