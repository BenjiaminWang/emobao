/* ================================================================
   情绪宝 - qx5 手机鼓棒（phone_drum）
   ----------------------------------------------------------------
   完全替代旧摄像头体感架子鼓。流程：
     ① 选曲：真实曲库的下拉列表，列出带真实音频的进行曲，可选/试听
     ② 演奏：右手挥手机击打（力度感应），左手点屏幕按钮切音色，
             选中曲目用真实音频文件伴奏，五鼓为 JS 内嵌合成打击乐音色
   平台：手机浏览器（HTTPS）挥击；电脑可点屏幕测试。
   ================================================================ */
(function () {
    'use strict';
    if (!window.qx5Engine) return;
    const E = window.qx5Engine;

    /* ---------- 真实曲库（与 body_drum 同一数据源，绝不合成假曲目） ---------- */
    const SB_URL = 'https://api.emobao.com';
    const SB_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';
    function isMarch(t) {
        return /进行曲|march/i.test(((t && t.title) || '') + ' ' + ((t && t.cat) || ''));
    }
    function sbGet(path, signal) {
        return fetch(SB_URL + '/rest/v1/' + path, {
            headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
            signal: signal
        }).then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); });
    }
    async function fetchWorks(signal) {
        const q = sel => 'emo_works?select=' + sel + '&is_published=eq.true&order=created_at.desc&limit=500';
        try { return await sbGet(q('workid,title_cn,title_en,audio_url,composer,total_duration,is_published'), signal); }
        catch (e) { try { return await sbGet(q('workid,title_cn,title_en,audio_url'), signal); } catch (e2) { return []; } }
    }
    async function fetchTracks() {
        try {
            const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = ctrl ? setTimeout(() => ctrl.abort(), 7000) : null;
            const signal = ctrl ? ctrl.signal : undefined;
            const [rows, works, types] = await Promise.all([
                sbGet('emobao_musictrack?select=trackid,musictypecode,title_cn,title_en,duration,fileurl,isactive&isactive=eq.true&order=createdat.desc&limit=500', signal).catch(() => []),
                fetchWorks(signal),
                sbGet('emobao_musictype?select=musictypecode,typename_cn,typename_en&order=sortorder.asc', signal).catch(() => [])
            ]);
            if (timer) clearTimeout(timer);
            const catMap = {};
            (Array.isArray(types) ? types : []).forEach(ty => { catMap[ty.musictypecode] = ty.typename_cn || ty.typename_en || ''; });
            const list = [];
            (Array.isArray(rows) ? rows : []).forEach(r => {
                if (!r.fileurl) return;
                list.push({ id: 'r' + r.trackid, title: r.title_cn || r.title_en || '未命名曲目',
                    author: '', cat: catMap[r.musictypecode] || '曲库', duration: Number(r.duration) || 120, fileurl: r.fileurl });
            });
            (Array.isArray(works) ? works : []).forEach(w => {
                if (!w.audio_url) return;
                list.push({ id: 'w' + w.workid, title: w.title_cn || w.title_en || '未命名作品',
                    author: w.composer || '', cat: '发布作品', duration: Number(w.total_duration) || 120, fileurl: w.audio_url });
            });
            const seen = {}, uniq = [];
            list.forEach(t => { if (!seen[t.fileurl]) { seen[t.fileurl] = 1; uniq.push(t); } });
            uniq.sort((a, b) => (isMarch(b) ? 1 : 0) - (isMarch(a) ? 1 : 0));
            return uniq;
        } catch (e) { return []; }
    }

    /* ---------- 样式（作用域限定在 .ps-root，避免污染其他游戏） ---------- */
    function injectStyle() {
        if (document.getElementById('ps-style')) return;
        const st = document.createElement('style');
        st.id = 'ps-style';
        st.textContent = `
        .ps-root{--bg:#0B1020;--panel:#151C30;--line:#2A3552;--txt:#EAF0FF;--sub:#8FA3C8;--dim:#5A6B90;
          --kick:#FF5C6C;--snare:#FF9F43;--hihat:#2FD9B0;--tom:#4E9BFF;--crash:#B07CFF;
          position:relative;width:100%;height:100%;min-height:560px;background:var(--bg);color:var(--txt);
          font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
          display:flex;flex-direction:column;overflow:hidden;user-select:none;-webkit-tap-highlight-color:transparent;border-radius:14px}
        .ps-root *{box-sizing:border-box}
        .ps-screen{display:none;position:absolute;inset:0;flex-direction:column}
        .ps-screen.active{display:flex}
        .ps-head{padding:20px 18px 8px;text-align:center;flex:0 0 auto}
        .ps-title{font-size:22px;font-weight:800;letter-spacing:1px}
        .ps-sub{font-size:13px;color:var(--sub);line-height:1.6;margin-top:6px}
        .ps-scroll{flex:1;min-height:0;overflow:auto;padding:8px 18px}
        .ps-field{margin:16px 0}
        .ps-field label{display:block;font-size:13px;color:var(--sub);margin-bottom:8px}
        .ps-select{width:100%;padding:14px 12px;font-size:15px;border-radius:12px;background:var(--panel);
          color:var(--txt);border:1px solid var(--line);appearance:none}
        .ps-meta{font-size:12px;color:var(--dim);margin-top:8px;min-height:18px}
        .ps-preview{margin-top:10px;background:transparent;color:var(--hihat);border:1px solid var(--hihat);
          border-radius:20px;padding:8px 18px;font-size:14px;cursor:pointer}
        .ps-actions{display:flex;gap:10px;padding:12px 18px calc(16px);flex:0 0 auto}
        .ps-btn{flex:1;border:0;border-radius:14px;padding:14px;font-size:16px;font-weight:800;cursor:pointer}
        .ps-topbar{display:flex;align-items:center;gap:10px;padding:12px 16px 4px;flex:0 0 auto}
        .ps-topbar .exit{flex:0 0 auto;background:transparent;color:var(--sub);border:1px solid var(--line);
          border-radius:18px;padding:9px 16px;font-size:13px;cursor:pointer}
        .ps-topbar .go{flex:1;background:var(--hihat);color:#0B1020;border:0;border-radius:14px;
          padding:12px;font-size:16px;font-weight:800;cursor:pointer}
        .ps-topbar .go:disabled{opacity:.45;cursor:default}
        .ps-topbar .go:active{transform:scale(.98)}
        .ps-tracklist{flex:1;min-height:0;overflow-y:auto;margin:8px 16px;border:1px solid var(--line);
          border-radius:14px;background:var(--panel)}
        .ps-track-item{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid var(--line);cursor:pointer}
        .ps-track-item:last-child{border-bottom:0}
        .ps-track-item.sel{background:color-mix(in srgb,var(--hihat) 16%,transparent)}
        .ps-track-item .idx{flex:0 0 auto;width:26px;height:26px;border-radius:50%;background:rgba(143,163,200,.14);
          color:var(--sub);font-size:12px;display:flex;align-items:center;justify-content:center}
        .ps-track-item.sel .idx{background:var(--hihat);color:#0B1020;font-weight:800}
        .ps-track-item .info{flex:1;min-width:0}
        .ps-track-item .nm{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .ps-track-item .meta{font-size:11px;color:var(--dim);margin-top:3px}
        .ps-track-item .arrow{color:var(--dim);font-size:16px}
        .ps-selectfoot{flex:0 0 auto;padding:6px 16px 14px;text-align:center}
        .ps-btn.primary{background:var(--hihat);color:#0B1020}
        .ps-btn.ghost{background:transparent;color:var(--sub);border:1px solid var(--line)}
        .ps-btn:active{transform:scale(.97)}
        .ps-tools{position:absolute;top:10px;right:12px;z-index:15;display:flex;gap:6px}
        .ps-icbtn{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--panel);
          color:var(--sub);font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .ps-cur{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:4px;flex:0 0 auto}
        .ps-cur .dot{width:16px;height:16px;border-radius:50%;background:var(--kick);box-shadow:0 0 18px var(--kick);transition:.2s}
        .ps-cur .name{font-size:30px;font-weight:800;letter-spacing:2px;transition:.2s}
        .ps-cur .en{font-size:12px;color:var(--sub);letter-spacing:2px}
        .ps-stage{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
        .ps-ring{position:absolute;left:50%;top:50%;width:min(52vw,220px);height:min(52vw,220px);
          transform:translate(-50%,-50%);border-radius:50%;border:2px solid var(--line);
          display:flex;align-items:center;justify-content:center;flex-direction:column;transition:border-color .15s,background .15s;cursor:pointer}
        .ps-ring .lvl{font-size:12px;color:var(--sub)}
        .ps-ring .mag{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:2px}
        .ps-fbar{width:min(38vw,140px);height:9px;border-radius:6px;background:rgba(143,163,200,.18);margin-top:10px;overflow:hidden}
        .ps-fbar i{display:block;height:100%;width:0%;border-radius:6px;background:linear-gradient(90deg,#2FD9B0,#FFD166,#FF5C6C);transition:width .08s}
        .ps-flabel{font-size:11px;color:var(--dim);margin-top:4px}
        .ps-hitword{font-size:12px;color:var(--hihat);margin-top:6px;min-height:16px}
        .ps-ripple{position:absolute;left:50%;top:50%;width:min(52vw,220px);height:min(52vw,220px);
          transform:translate(-50%,-50%) scale(1);border-radius:50%;border:3px solid var(--c,var(--kick));opacity:0;pointer-events:none}
        .ps-ripple.go{animation:psrip .5s ease-out}
        @keyframes psrip{0%{transform:translate(-50%,-50%) scale(1);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}
        .ps-ring.flash{background:color-mix(in srgb,var(--c,var(--kick)) 18%,transparent);border-color:var(--c,var(--kick))}
        .ps-wave{position:absolute;left:12px;right:12px;top:8px;height:52px;opacity:.85}
        .ps-hint{position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:12px;color:var(--dim);line-height:1.5}
        .ps-deck{flex:0 0 auto;padding:8px 12px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
        .ps-pad{border:1px solid var(--line);border-radius:16px;background:var(--panel);padding:10px 2px 8px;
          text-align:center;transition:.12s;position:relative;overflow:hidden;cursor:pointer}
        .ps-pad .ic{font-size:24px;line-height:1.1}
        .ps-pad .nm{font-size:13px;font-weight:700;margin-top:4px}
        .ps-pad .ky{font-size:9px;color:var(--dim);margin-top:2px}
        .ps-pad.sel{border-color:var(--c);background:color-mix(in srgb,var(--c) 16%,var(--panel));
          box-shadow:0 0 0 2px color-mix(in srgb,var(--c) 40%,transparent)}
        .ps-pad.sel .nm{color:var(--c)}
        .ps-pad:active{transform:scale(.94)}
        .ps-stats{display:flex;justify-content:space-around;padding:0 12px 4px;font-size:12px;color:var(--sub);flex:0 0 auto}
        .ps-stats b{color:var(--txt);font-variant-numeric:tabular-nums}
        .ps-overlay{position:absolute;inset:0;background:rgba(11,16,32,.96);z-index:20;display:flex;
          flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;gap:16px}
        .ps-overlay h1{font-size:26px;letter-spacing:1px}
        .ps-overlay p{font-size:14px;color:var(--sub);line-height:1.7;max-width:340px}
        .ps-warn{font-size:12px;color:#FFB4BD;line-height:1.6}
        .ps-badge{display:inline-block;margin:4px auto;padding:6px 14px;background:#1f6feb;color:#fff;
          border-radius:16px;font-size:13px;font-weight:600}
        .ps-keypad{position:absolute;inset:0;z-index:18;background:rgba(11,16,32,.98);padding:18px 20px;overflow:auto}
        .ps-keypad h2{font-size:18px;margin:0 30px 4px 0}
        .ps-keypad .sub{font-size:12px;color:var(--sub);line-height:1.6}
        .ps-keypad .close{position:absolute;top:12px;right:12px;background:transparent;color:var(--sub);
          border:1px solid var(--line);border-radius:10px;padding:6px 10px;cursor:pointer}
        .ps-keyrow{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)}
        .ps-keyrow .nm{flex:1;font-size:14px;font-weight:700}
        .ps-keycap{min-width:74px;text-align:center;padding:6px 8px;border-radius:8px;background:rgba(143,163,200,.14);
          color:var(--txt);font-size:12px;font-variant-numeric:tabular-nums}
        .ps-keycap.learning{background:var(--hihat);color:#0B1020;animation:psblink .7s infinite alternate}
        @keyframes psblink{from{opacity:.55}to{opacity:1}}
        .ps-keytip{font-size:11px;color:var(--dim);line-height:1.6;margin-top:10px}
        .ps-keylast{font-size:12px;color:var(--hihat);margin-top:6px;min-height:18px}
        .ps-keyrow button{background:transparent;color:var(--hihat);border:1px solid var(--hihat);
          border-radius:8px;padding:5px 10px;font-size:11px;cursor:pointer}
        .ps-keyrow button.ghost{color:var(--dim);border-color:var(--line)}
        .ps-quit{position:absolute;top:10px;left:12px;z-index:15;background:transparent;color:var(--sub);
          border:1px solid var(--line);border-radius:18px;padding:6px 12px;font-size:12px;cursor:pointer}
        `;
        document.head.appendChild(st);
    }

    E.registerGame({
        id: 'body_drum',
        collectionId: 'time',
        title: { cn: '手机鼓棒', en: 'Phone Drumsticks' },
        subtitle: { cn: '手机当鼓棒，挥出进行曲的节奏', en: 'Swing your phone to the marching beat' },
        isFeatured: true,

        generateTrials: function () {
            return [{ id: 'phone_drum_ensemble', condition: 'free', stimulus: {} }];
        },

        renderTrial: async function (hostEl, trial, onAnswer, meta) {
            injectStyle();
            hostEl.innerHTML = '<div class="ps-root"><div class="ps-screen active" id="ps-select"></div><div class="ps-screen" id="ps-play"></div></div>';
            const root = hostEl.querySelector('.ps-root');

            /* ============ 共享状态 ============ */
            const PADS = [
                { key: 'kick', nm: '大鼓', en: 'KICK', ic: '🥁', color: 'var(--kick)' },
                { key: 'snare', nm: '军鼓', en: 'SNARE', ic: '🎵', color: 'var(--snare)' },
                { key: 'hihat', nm: '踩镲', en: 'HIHAT', ic: '✨', color: 'var(--hihat)' },
                { key: 'tom', nm: '通鼓', en: 'TOM', ic: '🪘', color: 'var(--tom)' },
                { key: 'crash', nm: '吊镲', en: 'CRASH', ic: '🎶', color: 'var(--crash)' }
            ];
            const byKey = {}; PADS.forEach(p => byKey[p.key] = p);
            const cfg = { sens: 14, cool: 160, vol: 1.0 };
            const SR = 60;
            let cur = PADS[0];
            let finished = false;
            let tracks = [], selectedTrack = null;
            let actx = null, buffers = {}, master = null;
            let bgAudio = null, previewAudio = null;
            let motionOn = false, lastMotionTs = 0, samples = [], swing = null;
            let state = { hits: 0, forceSum: 0, armed: true, lastHitAt: 0, liveMag: 0 };
            let timers = [];
            /* 左手戒指/蓝牙键盘按键映射：存本机，换设备或改键不必重新发版 */
            const KEY_STORE = 'ps_ring_keymap_v1';
            let keyMap = loadKeyMap();
            let learnPad = null;
            let keyListenerOn = false;
            let refreshKeyRows = function () {};
            const $ = id => root.querySelector(String(id).charAt(0) === '#' ? id : '#' + id);
            const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
            const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

            function speak(txt) {
                try { if (window.qxSpeak) window.qxSpeak(txt); }
                catch (e) {}
            }

            /* ============ 左手戒指 / 蓝牙键盘按键映射 ============ */
            function loadKeyMap() {
                try { const raw = localStorage.getItem(KEY_STORE); return raw ? (JSON.parse(raw) || {}) : {}; }
                catch (e) { return {}; }
            }
            function saveKeyMap() {
                try { localStorage.setItem(KEY_STORE, JSON.stringify(keyMap)); } catch (e) {}
            }
            function keyCodeOf(ev) {
                return ev.code || (ev.key && ev.key.length === 1 ? 'Key' + ev.key.toUpperCase() : '') || ev.key || '';
            }
            function keyLabel(code) {
                const M = {
                    ArrowLeft: '← 左', ArrowRight: '→ 右', ArrowUp: '↑ 上', ArrowDown: '↓ 下',
                    PageUp: 'PgUp 上一件', PageDown: 'PgDn 下一件',
                    MediaTrackPrevious: '媒体上一曲', MediaTrackNext: '媒体下一曲',
                    Space: '空格', Enter: '回车', NumpadEnter: '小键盘回车'
                };
                if (M[code]) return M[code];
                if (/^Digit\d$/.test(code)) return '数字 ' + code.slice(5);
                if (/^Numpad\d$/.test(code)) return '小键盘 ' + code.slice(6);
                if (/^Key[A-Z]$/.test(code)) return '字母 ' + code.slice(3);
                return code || '（未识别）';
            }
            function boundKeyOf(padKey) {
                for (const code in keyMap) if (keyMap[code] === padKey) return code;
                return '';
            }
            function cyclePad(dir) {
                let i = PADS.findIndex(p => p.key === cur.key);
                i = (i + dir + PADS.length) % PADS.length;
                auditionTimbre(PADS[i].key, '切换');
            }
            function auditionTimbre(padKey, prefix) {
                unlockAudio();
                onTimbre(padKey);
                playHit(padKey, 0.85);
                const hw = $('#hitword');
                if (hw) { hw.textContent = (prefix || '戒指') + ' · ' + byKey[padKey].nm; later(() => { if (hw.textContent.indexOf(prefix || '戒指') === 0) hw.textContent = ''; }, 900); }
                const nm = $('cur-name'); if (nm) { nm.style.transform = 'scale(1.12)'; later(() => nm.style.transform = '', 200); }
            }

            /* ============ 音频引擎：JS 内嵌合成（零文件依赖） ============ */
            function renderDrum(type) {
                const sr = actx.sampleRate, TAU = Math.PI * 2;
                const DUR = { kick: 0.38, snare: 0.44, hihat: 0.30, tom: 0.34, crash: 1.35 }[type];
                const n = Math.floor(sr * DUR), buf = actx.createBuffer(1, n, sr), d = buf.getChannelData(0);
                function env(t, tau, at) { at = at || 0.002; return Math.min(1, t / at) * Math.exp(-t / tau); }
                function endFade(t, s, e) { return t < s ? 1 : (t > e ? 0 : 1 - (t - s) / (e - s)); }
                function lp2(cut) { const rc = 1 / (2 * Math.PI * cut), al = (1 / sr) / (rc + 1 / sr); let y1 = 0, y2 = 0;
                    return function (v) { y1 += al * (v - y1); y2 += al * (y1 - y2); return y2; }; }
                function hp1(cut) { const rc = 1 / (2 * Math.PI * cut), al = rc / (rc + 1 / sr); let x = 0, y = 0;
                    return function (v) { const o = al * (x + v - y); x = v; y = o; return o; }; }
                function bn(step) { let p = 0, c = Math.random() * 2 - 1, pos = 0;
                    return function () { if (pos >= 1) { p = c; c = Math.random() * 2 - 1; pos -= 1; } const v = p + (c - p) * pos; pos += 1 / step; return v; }; }
                let phase = 0, i, t;
                if (type === 'kick') {
                    const noise = bn(4), nlp = lp2(1600), out = lp2(2600);
                    for (i = 0; i < n; i++) { t = i / sr; const f = 68 + 82 * Math.exp(-t / 0.010); phase += TAU * f / sr;
                        const body = Math.sin(phase) * 0.55 * env(t, 0.075);
                        const harm = Math.sin(2 * phase) * 0.16 * env(t, 0.035);
                        const click = nlp(noise()) * env(t, 0.006) * 0.55;
                        const knock = Math.sin(TAU * 300 * t) * env(t, 0.020) * 0.40;
                        d[i] = out(body + harm + click + knock) * endFade(t, 0.22, 0.32); }
                } else if (type === 'snare') {
                    const B = [[0, 1.0, 0.060, 0.095, 205], [0.060, 0.70, 0.048, 0.078, 220], [0.125, 0.50, 0.040, 0.065, 238],
                               [0.192, 0.34, 0.032, 0.055, 255], [0.255, 0.22, 0.026, 0.048, 270]];
                    const noise = bn(3), wireHP = hp1(1500), wireLP = lp2(8000);
                    for (i = 0; i < n; i++) { t = i / sr; const wire = wireLP(wireHP(noise())); let s = 0, m, dt, tone2;
                        for (m = 0; m < B.length; m++) { dt = t - B[m][0]; if (dt < 0 || dt > 0.20) continue;
                            tone2 = (Math.sin(TAU * B[m][4] * dt) * 0.55 + Math.sin(TAU * B[m][4] * 2 * dt) * 0.30) * Math.exp(-dt / B[m][2]);
                            s += (tone2 * 0.60 + wire * 0.80 * Math.exp(-dt / B[m][3])) * B[m][1]; }
                        d[i] = s; }
                } else if (type === 'hihat') {
                    const noise = bn(2), nlp = lp2(11000), nhp = hp1(5000);
                    for (i = 0; i < n; i++) { t = i / sr; const nz = nhp(nlp(noise()));
                        const metal = (Math.sin(TAU * 7200 * t) + Math.sin(TAU * 9600 * t) * 0.5) * 0.12;
                        d[i] = (nz + metal) * env(t, 0.055); }
                } else if (type === 'tom') {
                    const noise = bn(6), nlp = lp2(1800), out = lp2(3000);
                    for (i = 0; i < n; i++) { t = i / sr; const ft = 215 + 35 * Math.exp(-t / 0.025); phase += TAU * ft / sr;
                        const tb = (Math.sin(phase) * 0.75 + Math.sin(2 * phase) * 0.18) * env(t, 0.075);
                        const atk = nlp(noise()) * env(t, 0.006) * 0.16;
                        d[i] = out(tb + atk) * endFade(t, 0.20, 0.29); }
                } else {
                    let lp = 0;
                    for (i = 0; i < n; i++) { t = i / sr; const nz = Math.random() * 2 - 1; lp = lp * 0.55 + nz * 0.45;
                        d[i] = (nz - lp) * (Math.min(1, t / 0.012) * Math.exp(-t / 0.55)); }
                }
                let pk = 0; for (i = 0; i < n; i++) { if (Math.abs(d[i]) > pk) pk = Math.abs(d[i]); }
                if (pk > 0) for (i = 0; i < n; i++) d[i] = d[i] / pk;
                const target = type === 'crash' ? 0.75 : (type === 'hihat' ? 0.85 : 1.0);
                for (i = 0; i < n; i++) d[i] = Math.tanh(d[i] * 1.7) / Math.tanh(1.7) * target;
                return buf;
            }
            function initAudio() {
                if (actx) return;
                const AC = window.AudioContext || window.webkitAudioContext;
                actx = new AC();
                const limiter = actx.createWaveShaper();
                const curve = new Float32Array(1024);
                for (let ci = 0; ci < 1024; ci++) { const x = ci / 1023 * 2 - 1, a = Math.abs(x), s = x < 0 ? -1 : 1;
                    curve[ci] = a <= 0.7 ? x : s * (0.7 + 0.3 * Math.tanh((a - 0.7) / 0.3)); }
                limiter.curve = curve;
                master = actx.createGain(); master.gain.value = 1;
                master.connect(limiter); limiter.connect(actx.destination);
                PADS.forEach(p => buffers[p.key] = renderDrum(p.key));
            }
            function unlockAudio() {
                initAudio();
                if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
                const bs = $('btn-sound'); if (bs) bs.textContent = '🔊';
            }
            function playHit(key, velocity) {
                if (!actx || !buffers[key]) return;
                const b = buffers[key], src = actx.createBufferSource(), g = actx.createGain();
                src.buffer = b; src.connect(g); g.connect(master);
                const t = actx.currentTime, dur = b.duration;
                let peak = (0.45 + Math.pow(Math.max(0, Math.min(1, velocity)), 1.1) * 1.05) * cfg.vol;
                if (key === 'kick') peak *= 1.7;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
                src.start(t); src.stop(t + dur + 0.02);
            }

            /* ============ 语义事件 ============ */
            function onTimbre(key) {
                cur = byKey[key]; if (!cur) return;
                const n = $('cur-name'), en = $('cur-en'), dot = $('cur-dot');
                if (n) n.textContent = cur.nm;
                if (en) en.textContent = cur.en;
                if (dot) { dot.style.background = cur.color; dot.style.boxShadow = '0 0 18px ' + cur.color; }
                root.querySelectorAll('.ps-pad').forEach(el => el.classList.toggle('sel', el.dataset.key === key));
            }
            function describeForce(v) { return v < 0.28 ? '轻敲' : (v < 0.55 ? '中等' : (v < 0.8 ? '用力' : '重击!')); }
            function onStrike(v) {
                const now = performance.now();
                if (now - state.lastHitAt < cfg.cool) return;
                state.lastHitAt = now; state.hits++; state.forceSum += v;
                playHit(cur.key, v);
                const ring = $('ring'); if (ring) { ring.classList.add('flash'); ring.style.setProperty('--c', cur.color); later(() => ring.classList.remove('flash'), 130); }
                const rip = $('ripple'); if (rip) { rip.style.setProperty('--c', cur.color); rip.classList.remove('go'); void rip.offsetWidth; rip.classList.add('go'); }
                const hw = $('hitword'); if (hw) { hw.textContent = cur.nm + ' · ' + Math.round(v * 100) + '%'; later(() => hw.textContent = '', 600); }
                const fb = $('fbar-fill'); if (fb) fb.style.width = Math.round(v * 100) + '%';
                const fl = $('flabel'); if (fl) fl.textContent = '力度 ' + Math.round(v * 100) + '% · ' + describeForce(v);
                const nm = $('cur-name'); if (nm) { nm.style.transform = 'scale(1.12)'; later(() => nm.style.transform = '', 200); }
                const sh = $('st-hits'); if (sh) sh.textContent = state.hits;
                const sf = $('st-force'); if (sf) sf.textContent = Math.round(state.forceSum / state.hits * 100) + '%';
            }

            /* ============ 挥击检测 ============ */
            function onMotion(e) {
                if (finished) return;
                const a = e.acceleration;
                let mag;
                if (a && a.x != null) mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
                else { const g = e.accelerationIncludingGravity; if (!g || g.x == null) return;
                    mag = Math.abs(Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) - 9.8); }
                const now = e.timeStamp || performance.now();
                if (now - lastMotionTs < SR) return;
                const dt = Math.max(1, now - lastMotionTs);
                lastMotionTs = now; state.liveMag = mag;
                samples.push(mag); if (samples.length > 26) samples.shift();
                drawWave(samples);
                const hi = cfg.sens;
                const live = Math.max(0, Math.min(1, (mag - hi * 0.25) / (hi * 1.75)));
                const fb = $('fbar-fill'); if (fb && !swing) fb.style.width = Math.round(live * 100) + '%';
                if (state.armed && mag > hi && !swing) swing = { peak: mag, startTs: now, prevMag: mag, maxSlope: 0 };
                if (swing) {
                    if (mag > swing.peak) swing.peak = mag;
                    const slope = (mag - swing.prevMag) / dt * 1000;
                    if (slope > swing.maxSlope) swing.maxSlope = slope;
                    swing.prevMag = mag;
                    const back = mag < swing.peak * 0.5, timeout = (now - swing.startTs) > 400;
                    if (back || timeout) {
                        const peak = swing.peak;
                        const byPeak = Math.min(1, (peak - hi) / (hi * 2.2));
                        const bySlope = Math.min(1, swing.maxSlope / (hi * 26));
                        const v = Math.max(0.06, Math.min(1, byPeak * 0.8 + bySlope * 0.2));
                        swing = null;
                        if (now - state.lastHitAt >= cfg.cool) {
                            state.armed = false; onStrike(v);
                            later(() => state.armed = true, cfg.cool);
                        }
                    }
                }
            }
            function requestMotion() {
                const DME = window.DeviceMotionEvent;
                if (!DME) { motionOn = false; return Promise.resolve(true); }
                if (typeof DME.requestPermission === 'function') {
                    return DME.requestPermission().then(s => {
                        if (s !== 'granted') { const w = $('gate-warn'); if (w) w.textContent = '运动权限被拒绝，请到系统设置里允许「运动与健身/动作」。'; return false; }
                        window.addEventListener('devicemotion', onMotion); motionOn = true; return true;
                    }).catch(() => { const w = $('gate-warn'); if (w) w.textContent = '运动权限请求失败，请确认用手机 HTTPS 打开后重试。'; return false; });
                }
                window.addEventListener('devicemotion', onMotion); motionOn = true;
                return Promise.resolve(true);
            }
            function localStrike() {
                unlockAudio();
                onStrike(0.45 + Math.random() * 0.5);
                const fl = $('flabel'); if (fl) fl.textContent += '（电脑测试）';
            }

            /* ============ 波形 ============ */
            function drawWave(arr) {
                const wcv = $('wave'); if (!wcv) return;
                const w = wcv.clientWidth, h = wcv.clientHeight, dpr = window.devicePixelRatio || 1;
                if (wcv.width !== w * dpr) { wcv.width = w * dpr; wcv.height = h * dpr; }
                const ctx = wcv.getContext('2d');
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
                const c = cur.color.replace('var(', '').replace(')', '');
                const real = getComputedStyle(root).getPropertyValue(c).trim() || '#2FD9B0';
                ctx.strokeStyle = real; ctx.lineWidth = 2; ctx.beginPath();
                const max = Math.max(cfg.sens * 2, 10);
                for (let i = 0; i < arr.length; i++) {
                    const x = i / (arr.length - 1) * w, y = h - Math.min(1, arr[i] / max) * h;
                    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
                }
                ctx.stroke();
            }

            /* ============ 伴奏 ============ */
            function stopBacking() { if (bgAudio) { try { bgAudio.pause(); bgAudio.src = ''; bgAudio.load(); } catch (e) {} } bgAudio = null; }
            function playBacking(t) {
                if (!t || !t.fileurl) return;
                unlockAudio();
                if (!bgAudio) bgAudio = new Audio();
                bgAudio.src = t.fileurl; bgAudio.loop = true;
                bgAudio.play().catch(() => { const w = $('hint'); if (w) w.textContent = '伴奏加载失败，仍可自由敲击'; });
            }

            /* ============ 清理 ============ */
            function releaseAll() {
                timers.forEach(id => clearTimeout(id)); timers = [];
                window.removeEventListener('devicemotion', onMotion);
                if (keyListenerOn) { document.removeEventListener('keydown', onKey); keyListenerOn = false; }
                learnPad = null;
                stopBacking();
                if (previewAudio) { try { previewAudio.pause(); previewAudio.src = ''; } catch (e) {} }
                if (window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) {} }
                if (actx) { try { Promise.resolve(actx.close()).catch(() => {}); } catch (e) {} }
                actx = null; buffers = {};
            }
            function exitGame(aborted) {
                if (finished) return;
                finished = true;
                const stats = { hits: state.hits, avgForce: state.hits ? state.forceSum / state.hits : 0,
                    track: selectedTrack ? selectedTrack.title : '', aborted: !!aborted };
                releaseAll();
                try { onAnswer(JSON.stringify(stats), stats.hits > 0); } catch (e) {}
            }
            function showScreen(name) {
                root.querySelectorAll('.ps-screen').forEach(s => s.classList.remove('active'));
                const el = $('#ps-' + name); if (el) el.classList.add('active');
            }

            /* ============ ① 选曲（真实曲库进行曲 · 可滚动列表） ============ */
            function buildSelect() {
                showScreen('select');
                const scr = $('#ps-select');
                scr.innerHTML = `
                    <div class="ps-topbar">
                        <button class="exit" id="ps-exit">退出</button>
                        <button class="go" id="ps-go" disabled>开始演奏 →</button>
                    </div>
                    <div class="ps-head">
                        <div class="ps-title">① 选择进行曲</div>
                        <div class="ps-sub">从真实曲库里选一支进行曲跟着敲<br>点曲目选中，可上下滑动查看全部</div>
                    </div>
                    <div class="ps-tracklist" id="ps-track"><div class="ps-track-item"><div class="info"><div class="nm">曲库加载中…</div></div></div></div>
                    <div class="ps-selectfoot">
                        <div class="ps-meta" id="ps-meta"></div>
                        <button class="ps-preview" id="ps-try">▶ 试听选中曲目</button>
                    </div>
                `;
                $('#ps-exit').onclick = () => exitGame(false);
                $('#ps-try').onclick = tryPreview;
                $('#ps-go').onclick = () => { stopPreviewAudio(); buildPlay(); };
                fetchTracks().then(list => {
                    if (finished) return;
                    tracks = list;
                    const marches = tracks.filter(isMarch);
                    const opts = (marches.length ? marches : tracks);
                    const box = $('#ps-track'); if (!box) return;
                    if (!opts.length) {
                        box.innerHTML = '<div class="ps-track-item"><div class="info"><div class="nm">（曲库暂无带音频曲目）</div></div></div>';
                        $('#ps-meta').textContent = '当前曲库没有可直接播放的曲目，仍可进入自由敲击。';
                    } else {
                        box.innerHTML = opts.map((t, i) => {
                            const bits = [t.cat, t.author].filter(Boolean);
                            const meta = bits.join(' · ') + (t.duration ? (bits.length ? ' · ' : '') + formatDur(t.duration) : '');
                            return '<div class="ps-track-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' +
                                '<div class="idx">' + (i + 1) + '</div>' +
                                '<div class="info"><div class="nm">' + esc(t.title) + '</div>' +
                                (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + '</div>' +
                                '<div class="arrow">›</div></div>';
                        }).join('');
                        box.querySelectorAll('.ps-track-item').forEach(el => {
                            el.onclick = () => onPickTrack(parseInt(el.dataset.i, 10));
                        });
                        selectedTrack = opts[0]; updateMeta();
                    }
                    $('#ps-go').disabled = false;
                    box._opts = opts;
                });
            }
            function pickedOpts() { const box = $('#ps-track'); return box && box._opts ? box._opts : []; }
            function onPickTrack(i) {
                const opts = pickedOpts();
                selectedTrack = opts[i] || null;
                const box = $('#ps-track');
                if (box) box.querySelectorAll('.ps-track-item').forEach(el => el.classList.toggle('sel', parseInt(el.dataset.i, 10) === i));
                stopPreviewAudio(); updateMeta();
            }
            function updateMeta() {
                const m = $('#ps-meta'); if (!m) return;
                if (!selectedTrack) { m.textContent = ''; return; }
                const bits = [selectedTrack.cat, selectedTrack.author].filter(Boolean);
                m.textContent = bits.join(' · ') + (selectedTrack.duration ? ' · ' + formatDur(selectedTrack.duration) : '');
            }
            function formatDur(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
            function stopPreviewAudio() { if (previewAudio) { try { previewAudio.pause(); previewAudio.src = ''; } catch (e) {} } previewAudio = null; const b = $('#ps-try'); if (b) b.textContent = '▶ 试听选中曲目'; }
            function tryPreview() {
                if (!selectedTrack || !selectedTrack.fileurl) { const m = $('#ps-meta'); if (m) m.textContent = '这首曲目没有可播放的音频链接。'; return; }
                unlockAudio();
                if (previewAudio && !previewAudio.paused) { stopPreviewAudio(); return; }
                previewAudio = new Audio(selectedTrack.fileurl);
                const b = $('#ps-try'); if (b) b.textContent = '■ 停止试听';
                previewAudio.play().catch(() => { if (b) b.textContent = '▶ 试听失败，点此重试'; });
                previewAudio.onended = () => stopPreviewAudio();
            }

            /* ============ ② 演奏 ============ */
            function buildPlay() {
                showScreen('play');
                const scr = $('#ps-play');
                const tname = selectedTrack ? selectedTrack.title : '自由演奏';
                scr.innerHTML = `
                    <button class="ps-quit" id="ps-quit">退出</button>
                    <div class="ps-tools">
                        <div class="ps-icbtn" id="btn-keys" title="戒指按键设置">⌨</div>
                        <div class="ps-icbtn" id="btn-sound" title="开声">🔇</div>
                    </div>
                    <div class="ps-head">
                        <div class="ps-title">🥁 ${esc(tname)}</div>
                        <div class="ps-cur"><span class="dot" id="cur-dot"></span><span class="name" id="cur-name">大鼓</span><span class="en" id="cur-en">KICK</span></div>
                    </div>
                    <div class="ps-stage">
                        <canvas class="ps-wave" id="wave"></canvas>
                        <div class="ps-ripple" id="ripple"></div>
                        <div class="ps-ring" id="ring">
                            <div class="lvl">实时加速度</div>
                            <div class="mag" id="mag">0.0</div>
                            <div class="ps-fbar"><i id="fbar-fill"></i></div>
                            <div class="ps-flabel" id="flabel">挥得越快越重 → 声音越响</div>
                            <div class="ps-hitword" id="hitword"></div>
                        </div>
                        <div class="ps-hint" id="hint">右手挥动 = 击打　·　左手点下方按钮 / 戒指按键 = 换乐器<br>戒指先点右上角 ⌨ 学习按键；电脑：空格击打，1–5 换乐器，←→ 切换</div>
                    </div>
                    <div class="ps-stats">
                        <span>击打 <b id="st-hits">0</b></span>
                        <span>平均力度 <b id="st-force">0%</b></span>
                    </div>
                    <div class="ps-deck" id="deck"></div>
                    <div class="ps-keypad" id="ps-keypad" style="display:none">
                        <button class="close" id="key-close">关闭</button>
                        <h2>💍 戒指 / 蓝牙键盘按键</h2>
                        <div class="sub">把戒指和手机配对成蓝牙键盘后，点某一行的「学习」，再按一下戒指按键，就完成绑定。<br>绑定存在本机，下次打开依然有效；不换手机无需重新设置。</div>
                        <div id="key-rows" style="margin-top:12px"></div>
                        <div class="ps-keylast" id="key-last"></div>
                        <div class="ps-keytip">没配对戒指也能用：键盘数字 1–5 直接换乐器，← / → 或 PgUp / PgDn 依次切换，空格击打（电脑测试）。<br>一个按键只想循环切换五种乐器？把这个键绑定到「依次切换」即可。</div>
                    </div>
                    <div class="ps-overlay" id="gate">
                        <h1>📱 手机当鼓棒</h1>
                        <div class="ps-badge">情绪宝 · 手机鼓棒</div>
                        <p>右手握稳手机（务必套好挂绳），向下一挥就是一次击打；左手点屏幕下方按钮切换乐器。<br>点下面按钮开启声音和运动权限。</p>
                        <button class="ps-btn primary" id="btn-start" style="max-width:320px">开启声音 + 运动权限</button>
                        <div class="ps-warn" id="gate-warn"></div>
                        <p class="ps-sub" style="font-size:12px">iPhone 请用 Safari 通过 HTTPS 打开以授权运动传感器；安卓 Chrome 同样需要 HTTPS。</p>
                    </div>
                `;
                // 鼓面按钮
                const deck = $('#deck');
                PADS.forEach(p => {
                    const b = document.createElement('div');
                    b.className = 'ps-pad' + (p.key === cur.key ? ' sel' : '');
                    b.dataset.key = p.key; b.style.setProperty('--c', p.color);
                    b.innerHTML = '<div class="ic">' + p.ic + '</div><div class="nm">' + p.nm + '</div><div class="ky">' + p.en + '</div>';
                    b.addEventListener('pointerdown', ev => { ev.preventDefault(); unlockAudio(); onTimbre(p.key); playHit(p.key, 0.85); const hw = $('#hitword'); if (hw) hw.textContent = '试听 · ' + p.nm; });
                    deck.appendChild(b);
                });

                /* 戒指按键学习面板 */
                function renderKeyRows() {
                    const box = $('#key-rows'); if (!box) return;
                    const rows = PADS.map(p => ({ key: p.key, nm: p.ic + ' ' + p.nm }));
                    rows.push({ key: '__cycle', nm: '🔄 依次切换五种乐器（一个键轮播）' });
                    box.innerHTML = rows.map(r => {
                        const bound = boundKeyOf(r.key);
                        return '<div class="ps-keyrow"><span class="nm">' + esc(r.nm) + '</span>' +
                            '<span class="ps-keycap' + (learnPad === r.key ? ' learning' : '') + '">' +
                            (learnPad === r.key ? '按一下…' : (bound ? esc(keyLabel(bound)) : '未绑定')) + '</span>' +
                            '<button data-learn="' + esc(r.key) + '">' + (learnPad === r.key ? '等待按键' : '学习') + '</button>' +
                            (bound ? '<button class="ghost" data-clear="' + esc(r.key) + '">清除</button>' : '') + '</div>';
                    }).join('');
                    box.querySelectorAll('[data-learn]').forEach(btn => btn.onclick = () => {
                        learnPad = btn.dataset.learn; renderKeyRows(); unlockAudio();
                        const l = $('#key-last'); if (l) l.textContent = '等待按键… 现在按一下戒指 / 蓝牙键盘上的按键';
                        speak('请按一下戒指按键');
                    });
                    box.querySelectorAll('[data-clear]').forEach(btn => btn.onclick = () => {
                        const k = btn.dataset.clear;
                        for (const code in keyMap) if (keyMap[code] === k) delete keyMap[code];
                        saveKeyMap(); renderKeyRows();
                    });
                }
                refreshKeyRows = renderKeyRows;
                renderKeyRows();
                $('#btn-keys').onclick = () => {
                    const p = $('#ps-keypad'); if (!p) return;
                    p.style.display = (p.style.display === 'none') ? 'block' : 'none';
                    learnPad = null; renderKeyRows();
                };
                $('#key-close').onclick = () => { const p = $('#ps-keypad'); if (p) p.style.display = 'none'; learnPad = null; renderKeyRows(); };
                $('#ps-quit').onclick = () => exitGame(false);
                $('#btn-sound').onclick = unlockAudio;
                $('#btn-start').onclick = () => {
                    unlockAudio();
                    requestMotion().then(ok => {
                        if (!ok) return;
                        const gate = $('#gate'); if (gate) gate.style.display = 'none';
                        if (!motionOn) { const fl = $('flabel'); if (fl) fl.textContent = '电脑测试模式 · 点圆圈击打'; }
                        if (selectedTrack && selectedTrack.fileurl) playBacking(selectedTrack);
                        speak('开始演奏。右手挥动手机敲鼓，左手点按钮换乐器。');
                    });
                };
                $('#ring').addEventListener('pointerdown', ev => { ev.preventDefault(); if ($('#gate').style.display === 'none') localStrike(); });
                if (!keyListenerOn) { document.addEventListener('keydown', onKey); keyListenerOn = true; }
            }

            const NEXT_KEYS = {
                ArrowRight: 1, PageDown: 1, MediaTrackNext: 1, BracketRight: 1,
                ArrowLeft: -1, PageUp: -1, MediaTrackPrevious: -1, BracketLeft: -1
            };
            function inPlay() {
                const scr = $('#ps-play'), gate = $('#gate');
                return !finished && scr && scr.classList.contains('active') && gate && gate.style.display === 'none';
            }
            function onKey(ev) {
                if (!inPlay()) return;
                const tag = ((ev.target && ev.target.tagName) || '').toLowerCase();
                if (tag === 'input' || tag === 'select' || tag === 'textarea' || (ev.target && ev.target.isContentEditable)) return;
                if (ev.repeat) { ev.preventDefault(); return; }
                const code = keyCodeOf(ev);
                if (!code) return;
                const kp = $('#ps-keypad'), learnOpen = kp && kp.style.display !== 'none', last = $('#key-last');
                if (learnPad) {
                    ev.preventDefault();
                    for (const k in keyMap) if (k === code || keyMap[k] === learnPad) delete keyMap[k];
                    keyMap[code] = learnPad; saveKeyMap();
                    const label = learnPad === '__cycle' ? '依次切换' : (byKey[learnPad] ? byKey[learnPad].nm : learnPad);
                    if (last) last.textContent = '已绑定：' + keyLabel(code) + ' → ' + label;
                    learnPad = null; refreshKeyRows(); unlockAudio(); speak('绑定成功');
                    return;
                }
                if (learnOpen) { ev.preventDefault(); if (last) last.textContent = '检测到按键：' + keyLabel(code) + '（' + code + '）'; return; }
                if (Object.prototype.hasOwnProperty.call(keyMap, code)) {
                    ev.preventDefault();
                    const target = keyMap[code];
                    if (target === '__cycle') cyclePad(1);
                    else if (byKey[target]) auditionTimbre(target, '戒指');
                    return;
                }
                if (/^Digit[1-5]$/.test(code) || /^Numpad[1-5]$/.test(code)) {
                    ev.preventDefault(); auditionTimbre(PADS[parseInt(code.slice(-1), 10) - 1].key, '键盘'); return;
                }
                if (Object.prototype.hasOwnProperty.call(NEXT_KEYS, code)) { ev.preventDefault(); cyclePad(NEXT_KEYS[code]); return; }
                if (code === 'Space') { ev.preventDefault(); localStrike(); return; }
            }

            /* ============ 启动 ============ */
            buildSelect();
        }
    });
})();
