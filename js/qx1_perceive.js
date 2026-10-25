/* ================================================================
   情绪宝 - qx1 情绪感知
   v31 强制修复版：使用 pointerdown 替代 click
   采样 60秒
   ================================================================ */
   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const FETCH_TIMEOUT_MS = 12000;
    const FETCH_RETRY = 3;
    const FETCH_RETRY_DELAY = 800;

    const DAILY_BLESSINGS = {
        0: [
            { cn: '放下焦虑，享受宁静。', en: 'Let go of anxiety, enjoy peace.' },
            { cn: '不内耗，松弛蓄力。', en: 'No overthinking, recharge gently.' },
            { cn: '平和从容，明天元气满满。', en: 'Stay calm, be full of energy tomorrow.' },
        ],
        1: [
            { cn: '接纳疲惫，慢慢来。', en: 'Embrace tiredness, take it slow.' },
            { cn: '周一是重启，深呼吸。', en: 'Monday is a restart, breathe deep.' },
            { cn: '允许起伏，尽力就好。', en: 'Allow ups and downs, do your best.' },
        ],
        2: [
            { cn: '专注当下，压力变动力。', en: 'Focus on now, turn pressure into drive.' },
            { cn: '轻装上阵，享受高效。', en: 'Travel light, enjoy efficiency.' },
            { cn: '心平气和，稳步前行。', en: 'Stay calm, move steadily.' },
        ],
        3: [
            { cn: '周中不焦虑，给小确幸。', en: 'Midweek without anxiety, find small joys.' },
            { cn: '劳逸结合，好好爱自己。', en: 'Balance work and rest, love yourself.' },
            { cn: '看淡平淡，关注小快乐。', en: 'Let go of dullness, notice small happiness.' },
        ],
        4: [
            { cn: '放下疲惫，释怀烦恼。', en: 'Let go of tiredness and worries.' },
            { cn: '不内耗，曙光在前。', en: 'No overthinking, dawn is near.' },
            { cn: '接纳疲惫，期待周末。', en: 'Accept fatigue, look forward to the weekend.' },
        ],
        5: [
            { cn: '享受喜悦，放下包袱。', en: 'Enjoy joy, drop the burden.' },
            { cn: '肯定付出，不纠结。', en: 'Affirm your efforts, don\'t dwell.' },
            { cn: '烦恼留周四，快乐迎周末。', en: 'Leave worries on Thursday, welcome the weekend with joy.' },
        ],
        6: [
            { cn: '放下工作，享受松弛。', en: 'Put down work, enjoy relaxation.' },
            { cn: '慵懒不内疚，好好休息。', en: 'Be lazy without guilt, rest well.' },
            { cn: '松弛当下，做快乐自己。', en: 'Relax now, be your happy self.' },
        ],
    };

    let state = {
        emotionCode: null,
        savedEmotionCode: null,
        savedEvents: [],
        events: [],
        selectedEventIndex: -1,
        categories: [],
        categoryEventsMap: {},
        treeExpanded: {},
        canExit: true,
        isGuest: false,
        initialized: false,
        hrvResult: null,
        hrvSaved: false,
        eventsSaved: true,
    };
     // 🌟 全局语音导航词
     function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
     const QX1_GUIDE_TEXT = t(
        "朋友，欢迎来到情绪感知。接下来我会为您导航，帮您熟悉如何记录自己的情绪日记，为您的心身健康积累有用数据。如果嫌我啰嗦，随时点右上角小喇叭让我闭嘴。第一步，用左上角的魔镜。触碰魔镜的镜框它会根据您的表情帮您识别情绪。注意旁边的情绪温度计，颜色变暖代表有活力，变冷代表平静或低落。如果光线不好或魔镜猜错，您可以触摸魔镜下方的小黄点，自己转动旋钮定义最真实的感受。第二步，看下方的生活事件。情绪不是凭空来的，请选今天影响情绪的主要事情，区分每件事的好坏、影响大小。第三步，测 HRV。这是您情绪的生理体温。切记，找个光线亮的地方，最好有光照在手指上，这样测得更准。把干净的手指轻按在摄像头上保持 60 秒，绿灯亮起就成功了。测完后右上方的小红心被点亮，点击即可查看雷达图和报告。",
        "Friend, welcome to Emotion Perceive. I will guide you through how to record your emotional diary and accumulate data for your health. First, use the magic mirror. Touch its frame to identify your emotion. Note the thermometer: warmer colors mean energetic, cooler means calm or low. If the lighting is poor or the mirror guesses wrong, touch the small yellow dot below to turn the knob and define your true feeling. Second, look at the life events below. Emotions don't come from nowhere; select the main events that affected you today, and rate their impact. Third, test HRV. This is your emotion's 'physical temperature.' Remember, find a bright place, ideally with light shining on your finger. Place a clean finger on the camera for 60 seconds. Once the green light appears, it's successful. After testing, the red heart in the top right will light up; click it to see your radar chart and report."
    );
    
    function getUserId() { return window.mQxb && window.mQxb.user_id; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getLang() { return (window.mQxb && window.mQxb.Language) || 1; }

    function getHrvSourceFromSetting() {
        if (typeof window.qx6GetHrvSource === 'function') {
            try { return window.qx6GetHrvSource(); } catch (e) {}
        }
        try {
            const v = localStorage.getItem('emobao_hrv_source');
            if (v === 'polar' || v === 'camera') return v;
        } catch (e) {}
        if (window.mQxb && window.mQxb.Sensor && window.mQxb.Sensor.hrvSource) {
            return window.mQxb.Sensor.hrvSource;
        }
        return 'camera';
    }

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
        if (msg.indexOf('Failed to fetch') >= 0) return true;
        if (msg.indexOf('NetworkError') >= 0) return true;
        if (msg.indexOf('ERR_CONNECTION_RESET') >= 0) return true;
        if (msg.indexOf('ERR_NETWORK') >= 0) return true;
        return false;
    }

    async function rpc(fnName, params) {
        const url = `${SUPABASE_URL}/rest/v1/rpc/${fnName}`;
        const headers = {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        };
        const body = JSON.stringify(params);

        let lastErr = null;
        for (let i = 0; i < FETCH_RETRY; i++) {
            try {
                const res = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers,
                    body,
                    cache: 'no-store',
                });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`RPC ${fnName} 失败: ${res.status} ${txt}`);
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

    async function restGet(path) {
        const url = `${SUPABASE_URL}/rest/v1/${path}`;
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
        };
        let lastErr = null;
        for (let i = 0; i < FETCH_RETRY; i++) {
            try {
                const res = await fetchWithTimeout(url, { headers, cache: 'no-store' });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`REST ${path} 失败: ${res.status} ${txt}`);
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

    function refreshEmotionTitle() {
        const area = document.querySelector('.qx1-emotion-area .qx1-section-title');
        if (!area) return;
        const code = state.emotionCode;
        const lang = getLang();
        if (!code) {
            area.innerText = t('今日情绪', 'Today');
            return;
        }
        const info = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_LIST || [])
            .find(x => x.code === code);
        const name = info ? (lang === 1 ? info.cn : info.en) : '';
        area.innerText = name
            ? t('今日情绪 · ', 'Today · ') + name
            : t('今日情绪', 'Today');
    }

    let _toastTimer = null;
    function toast(text, type) {
        type = type || 'info';
        let bar = document.getElementById('qx1_toast_bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'qx1_toast_bar';
            bar.className = 'qx1-toast-bar';
            document.body.appendChild(bar);
        }
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        bar.className = 'qx1-toast-bar qx1-toast-' + type;
        bar.innerText = text;
        requestAnimationFrame(() => bar.classList.add('show'));
        _toastTimer = setTimeout(() => {
            bar.classList.remove('show');
        }, 3000);
    }

    function applyLayout() {
        const container = document.getElementById('qx1_container');
        if (!container) return;

        const minSide = Math.min(window.innerWidth, window.innerHeight);
        const isPhone   = minSide < 600;
        const isTablet  = minSide >= 600 && minSide < 1024;
        const isDesktop = minSide >= 1024;

        container.classList.remove('landscape', 'portrait', 'device-phone', 'device-tablet', 'device-desktop');
        container.classList.add('portrait');
        container.classList.add(isPhone ? 'device-phone' : (isTablet ? 'device-tablet' : 'device-desktop'));

        if (window.qxLifeEventChart) {
            qxLifeEventChart.draw('qx1_impact_chart', state.events);
        }
    }

    let _resizeTimer = null;
    function onResizeDebounced() {
        if (_resizeTimer) clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            applyLayout();
        }, 120);
    }

    function renderEventList() {
        const list = document.getElementById('qx1_event_list');
        const detail = document.getElementById('qx1_event_detail');
        const titleEl = document.querySelector('.qx1-events-area .qx1-section-title');
        const lang = getLang();
        list.innerHTML = '';

        if (titleEl) {
            titleEl.innerHTML = `${t('当日生活事件', "Today's Events")} <span class="qx1-events-count">${state.events.length} ${t('条', '')}</span>`;
        }

        if (state.events.length === 0) {
            list.innerHTML = `<div class="qx1-event-empty">${t('暂无事件', 'No events')}</div>`;
            detail.classList.add('disabled');
            detail.classList.remove('incomplete');
            if (window.qxLifeEventChart) {
                qxLifeEventChart.draw('qx1_impact_chart', []);
                qxLifeEventChart.renderSummary('qx1_impact_summary', []);
            }
            return;
        }

        state.events.forEach((ev, idx) => {
            const div = document.createElement('div');
            div.className = 'qx1-event-item' + (idx === state.selectedEventIndex ? ' selected' : '');
            div.dataset.index = idx;

            const name = lang === 1 ? ev.eventname_cn : ev.eventname_en;
            const natureStr = ev.eventnature ? t(ev.eventnature, ev.eventnature === '好事' ? 'Good' : 'Bad') : '';
            const impactStr = ev.impactlevel ? `L${ev.impactlevel}` : '';

            div.innerHTML = `
                <span class="qx1-event-name">${name}</span>
                <span class="qx1-event-meta">${natureStr} ${impactStr}</span>
            `;
            list.appendChild(div);
        });

        list.querySelectorAll('.qx1-event-item').forEach(el => {
            el.addEventListener('click', () => {
                state.selectedEventIndex = parseInt(el.dataset.index);
                renderEventList();
                showEventDetail();
            });
        });

        if (state.selectedEventIndex < 0) {
            detail.classList.add('disabled');
            detail.classList.remove('incomplete');
        }

        if (window.qxLifeEventChart) {
            qxLifeEventChart.draw('qx1_impact_chart', state.events);
            qxLifeEventChart.renderSummary('qx1_impact_summary', state.events);
        }
    }

    function showEventDetail() {
        const detail = document.getElementById('qx1_event_detail');
        if (state.selectedEventIndex < 0) {
            detail.classList.add('disabled');
            detail.classList.remove('incomplete');
            return;
        }
        const ev = state.events[state.selectedEventIndex];
        detail.classList.remove('disabled');

        const isIncomplete = (!ev.eventnature || !ev.impactlevel);
        detail.classList.toggle('incomplete', isIncomplete);

        document.querySelectorAll('input[name="qx1_nature"]').forEach(r => {
            r.checked = (r.value === ev.eventnature);
        });
        document.querySelectorAll('input[name="qx1_impact"]').forEach(r => {
            r.checked = (parseInt(r.value) === ev.impactlevel);
        });
    }

    function bindEventDetailRadios() {
        document.querySelectorAll('input[name="qx1_nature"]').forEach(r => {
            r.addEventListener('change', () => {
                if (state.selectedEventIndex < 0) return;
                state.events[state.selectedEventIndex].eventnature = r.value;
                markDirty();
                renderEventList();
                showEventDetail();
            });
        });
        document.querySelectorAll('input[name="qx1_impact"]').forEach(r => {
            r.addEventListener('change', () => {
                if (state.selectedEventIndex < 0) return;
                state.events[state.selectedEventIndex].impactlevel = parseInt(r.value);
                markDirty();
                renderEventList();
                showEventDetail();
            });
        });
    }

    function onDeleteCurrentEvent() {
        if (state.selectedEventIndex < 0) {
            toast(t('请先选中一条事件', 'Please select an event first'), 'warning');
            return;
        }
        const ev = state.events[state.selectedEventIndex];
        const name = getLang() === 1 ? ev.eventname_cn : ev.eventname_en;
        if (confirm(t(`是否从当日生活事件删除“${name}”？`, `Remove "${name}"?`))) {
            state.events.splice(state.selectedEventIndex, 1);
            state.selectedEventIndex = -1;
            markDirty();
            renderEventList();
            showEventDetail();
        }
    }

    async function loadCategories() {
        const tree = document.getElementById('qx1_tree');
        if (!tree) return;
        tree.innerHTML = `<div class="qx1-tree-loading">${t('加载中…', 'Loading…')}</div>`;

        try {
            const all = await restGet('emobao_lifeevent?isactive=eq.true&order=sortorder');
            const parents = all.filter(r => r.eventparentcode === null);
            const children = all.filter(r => r.eventparentcode !== null);

            state.categories = parents;
            state.categoryEventsMap = {};
            state.treeExpanded = {};

            parents.forEach((p, i) => {
                state.categoryEventsMap[p.eventcode] = children.filter(c => c.eventparentcode === p.eventcode);
                state.treeExpanded[p.eventcode] = (i === 0);
            });

            renderTree();
        } catch (e) {
            console.warn('[qx1] loadCategories 失败', e);
            if (tree) {
                tree.innerHTML = `<div class="qx1-tree-error" id="qx1_tree_retry" style="cursor:pointer;">${t('点击重试', 'Tap to retry')}</div>`;
                const retry = document.getElementById('qx1_tree_retry');
                if (retry) {
                    retry.addEventListener('click', () => loadCategories());
                }
            }
        }
    }

    function renderTree() {
        const tree = document.getElementById('qx1_tree');
        const lang = getLang();
        tree.innerHTML = '';

        state.categories.forEach(c => {
            const catDiv = document.createElement('div');
            catDiv.className = 'qx1-tree-cat';

            const titleDiv = document.createElement('div');
            titleDiv.className = 'qx1-tree-cat-title';
            const expanded = state.treeExpanded[c.eventcode];
            titleDiv.innerHTML = `<span class="qx1-tree-arrow">${expanded ? '▼' : '▶'}</span> <span>${lang === 1 ? c.eventname_cn : c.eventname_en}</span>`;
            
            titleDiv.addEventListener('click', function(e) {
                state.treeExpanded[c.eventcode] = !state.treeExpanded[c.eventcode];
                renderTree();
            });
            catDiv.appendChild(titleDiv);

            if (expanded) {
                const childDiv = document.createElement('div');
                childDiv.className = 'qx1-tree-children';
                const children = state.categoryEventsMap[c.eventcode] || [];
                children.forEach(ch => {
                    const item = document.createElement('div');
                    item.className = 'qx1-tree-item';
                    item.dataset.eventcode = ch.eventcode;
                    item.dataset.nameCn = ch.eventname_cn;
                    item.dataset.nameEn = ch.eventname_en;
                    item.innerText = lang === 1 ? ch.eventname_cn : ch.eventname_en;

                    // 使用底层的 pointerdown 事件，绕过 click 穿透问题
                    item.addEventListener('pointerdown', function(e) {
                        if (window.speechSynthesis) window.speechSynthesis.cancel(); // 🌟 闭嘴

                        // 清除其他选中
                        const allItems = tree.querySelectorAll('.qx1-tree-item');
                        allItems.forEach(el => el.classList.remove('selected'));
                        item.classList.add('selected');

                        // 直接加入到右列表
                        addEventFromTree(item.dataset.eventcode, item.dataset.nameCn, item.dataset.nameEn);
                    });

                    childDiv.appendChild(item);
                });
                catDiv.appendChild(childDiv);
            }

            tree.appendChild(catDiv);
        });
    }

    function addEventFromTree(eventcode, nameCn, nameEn) {
        if (state.events.length >= 10) {
            toast(t('一天内最多 10 个生活事件', 'Max 10 life events per day'), 'warning');
            return;
        }
        const existingIdx = state.events.findIndex(e => e.eventcode === eventcode);
        if (existingIdx >= 0) {
            state.selectedEventIndex = existingIdx;
            renderEventList();
            showEventDetail();
            return;
        }
        
        state.events.push({
            eventcode,
            eventname_cn: nameCn,
            eventname_en: nameEn,
            eventnature: '',
            impactlevel: 0,
        });
        
        state.selectedEventIndex = state.events.length - 1;
        markDirty();
        renderEventList();
        showEventDetail();
    }

    function markDirty() {
        state.canExit = false;
        state.eventsSaved = false;
    }

    function checkEmotionEvents() {
        if (!state.emotionCode) {
            return { ok: false, msg: t('还没有选择情绪', 'No emotion selected') };
        }
        if (state.events.length === 0) {
            return { ok: false, msg: t('还没有记录生活事件', 'No life event') };
        }
        for (let i = 0; i < state.events.length; i++) {
            const e = state.events[i];
            if (!e.eventnature) {
                return { ok: false, msg: t(`第 ${i + 1} 条事件未填好坏`, `Event #${i + 1} missing nature`) };
            }
            if (!e.impactlevel || e.impactlevel < 1 || e.impactlevel > 4) {
                return { ok: false, msg: t(`第 ${i + 1} 条事件未填影响程度`, `Event #${i + 1} missing impact`) };
            }
        }
        return { ok: true };
    }

    function refreshCanExit() {
        const eventsOk = state.eventsSaved;
        const hrvOk = (state.hrvResult == null) || state.hrvSaved;
        state.canExit = eventsOk && hrvOk;
    }

    async function onSave() {
        if (state.isGuest) {
            toast(t('欢迎体验情绪宝，成为 VIP 可保存您的记录 🌹',
                    'Welcome to Emo Treasure. Become a VIP to save your records. 🌹'), 'info');
            return;
        }

        const needSaveEvents = !state.eventsSaved;
        const needSaveHrv = (state.hrvResult != null) && !state.hrvSaved;

        if (!needSaveEvents && !needSaveHrv) {
            toast(t('您还没有填写或改动任何信息', 'You have not made any changes'), 'info');
            return;
        }

        if (needSaveEvents) {
            const chk = checkEmotionEvents();
            if (!chk.ok) {
                toast(chk.msg, 'warning');
                return;
            }
        }

        let savedEmotionEvents = false;
        let savedHrv = false;

        if (needSaveEvents) {
            try {
                const events = state.events.map(e => ({
                    eventcode: e.eventcode,
                    eventnature: e.eventnature,
                    impactlevel: e.impactlevel,
                }));
                const result = await rpc('emobao_save_perception', {
                    p_userid: getUserId(),
                    p_emotion_code: state.emotionCode,
                    p_events: events,
                });
                const row = Array.isArray(result) ? result[0] : result;
                if (!row || !row.success) {
                    toast(t('存入失败：', 'Save failed: ') + (row && row.message), 'error');
                    return;
                }
                state.savedEmotionCode = state.emotionCode;
                state.savedEvents = JSON.parse(JSON.stringify(state.events));
                state.eventsSaved = true;
                savedEmotionEvents = true;
            } catch (e) {
                console.error(e);
                toast(t('网络信号太差，无法正常工作', 'Network error, please try again'), 'error');
                return;
            }
        }

        if (needSaveHrv) {
            try {
                const r = state.hrvResult;
                const now = new Date();
                const starttime = new Date(now.getTime() - r.duration * 1000).toISOString();
                const endtime = now.toISOString();

                const hrvResult = await rpc('emobao_save_hrv_session', {
                    p_userid: getUserId(),
                    p_measurephase: 'before',
                    p_starttime: starttime,
                    p_endtime: endtime,
                    p_bpm: r.bpm,
                    p_sdnn: r.sdnn,
                    p_rmssd: r.rmssd,
                    p_pnn50: r.pnn50,
                    p_lf: r.lf,
                    p_hf: r.hf,
                    p_lf_hf: 0,
                    p_rrintervals: JSON.stringify(r.rrIntervals),
                });
                const hrvRow = Array.isArray(hrvResult) ? hrvResult[0] : hrvResult;
                if (!hrvRow || !hrvRow.success) {
                    toast(t('HRV 存入失败：', 'HRV save failed: ') + (hrvRow && hrvRow.message), 'warning');
                } else {
                    state.hrvSaved = true;
                    savedHrv = true;
                }
            } catch (e) {
                console.error(e);
                toast(t('HRV 网络异常', 'HRV network error'), 'warning');
            }
        }

        refreshCanExit();
        updateHeartIcon();

        if (savedEmotionEvents && savedHrv) {
            toast(t('已全部存入', 'All saved'), 'success');
        } else if (savedEmotionEvents) {
            toast(t('情绪+事件已存入', 'Emotion + events saved'), 'success');
        } else if (savedHrv) {
            toast(t('HRV 已存入', 'HRV saved'), 'success');
        }
    }

    function getDailyBlessing() {
        const day = new Date().getDay();
        const list = DAILY_BLESSINGS[day] || DAILY_BLESSINGS[1];
        const pick = list[Math.floor(Math.random() * list.length)];
        return getLang() === 1 ? pick.cn : pick.en;
    }

    function onExit() {
        if (state.isGuest) {
            toast(t('欢迎早日加入情绪宝 VIP！关注情绪健康！',
                    'Join Emo Treasure VIP soon! Care for your emotional health!'), 'info');
            setTimeout(() => {
                window.returnToMain();
            }, 100);
            return;
        }

        refreshCanExit();

        const hrvCapturedNotSaved = (state.hrvResult != null) && !state.hrvSaved;
        const eventsNotSaved = !state.eventsSaved;

        if (!hrvCapturedNotSaved && !eventsNotSaved) {
            toast(getDailyBlessing(), 'success');
            setTimeout(() => {
                window.returnToMain();
            }, 100);
            return;
        }

        if (hrvCapturedNotSaved) {
            toast(t('HRV 已采集但未存入', 'HRV captured but not saved'), 'warning');
        }

        const chk = checkEmotionEvents();
        if (chk.ok && !hrvCapturedNotSaved) {
            if (confirm(t('本次改动的信息没有存入，您放弃吗？', 'Changes not saved. Give up?'))) {
                toast(getDailyBlessing(), 'success');
                setTimeout(() => {
                    window.returnToMain();
                }, 100);
            }
        } else {
            const msg = (hrvCapturedNotSaved
                    ? t('HRV 已采集但未存入。', 'HRV captured but not saved. ') + '\n\n'
                    : '')
                + (chk.ok ? '' : chk.msg + '\n\n')
                + t('点“确定”返回继续填写，点“取消”放弃此次输入并退出。',
                    'OK to continue editing, Cancel to discard and exit.');
            if (!confirm(msg)) {
                toast(getDailyBlessing(), 'success');
                setTimeout(() => {
                    window.returnToMain();
                }, 100);
            }
        }
    }

    function updateHeartIcon() {
        const heart = document.getElementById('qx1_heart_icon');
        if (!heart) return;

        if (state.hrvSaved) {
            heart.classList.remove('heart-white');
            heart.classList.add('heart-red');
        } else {
            heart.classList.remove('heart-red');
            heart.classList.add('heart-white');
        }
    }

    function bindHeartIcon() {
        const heart = document.getElementById('qx1_heart_icon');
        if (!heart) return;
        heart.addEventListener('click', () => {
            const modal = document.getElementById('qx1_chart_modal');
            if (modal && modal.classList.contains('show')) {
                closeHrvModal();
            } else {
                openHrvModal();
            }
        });
    }

    function openHrvModal() {
        if (!state.hrvSaved) {
            toast(t('请先采集并存入 HRV', 'Please capture and save HRV first'), 'warning');
            return;
        }

        let modal = document.getElementById('qx1_chart_modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'qx1_chart_modal';
            modal.className = 'qx1-chart-modal';
            modal.innerHTML = `
                <div class="qx1-chart-modal-inner">
                    <div class="qx1-chart-modal-tabs">
                        <button class="qx1-chart-modal-tab active" data-key="radar">${t('HRV 雷达', 'HRV Radar')}</button>
                        <button class="qx1-chart-modal-tab" data-key="trend">${t('心率趋势', 'HR Trend')}</button>
                        <button class="qx1-chart-modal-tab" data-key="scatter">${t('RR 散点', 'RR Scatter')}</button>
                        <button class="qx1-chart-modal-tab" data-key="cards">${t('指标卡', 'Metrics')}</button>
                        <button class="qx1-chart-modal-help" id="qx1_chart_modal_help" title="${t('说明', 'Help')}">⤢</button>
                    </div>
                    <div class="qx1-chart-modal-body" id="qx1_chart_modal_body"></div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelectorAll('.qx1-chart-modal-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    modal.querySelectorAll('.qx1-chart-modal-tab').forEach(x => x.classList.remove('active'));
                    tab.classList.add('active');
                    renderHrvModal(tab.dataset.key);
                    
                    // 🌟 点击 Tab 时的语音播报
                    if (window.qxSpeak) {
                        let speakText = '';
                        if (tab.dataset.key === 'radar') {
                            speakText = "这是 HRV 雷达图。四个轴代表不同的身体指标。圈里面涂色的面积越大，说明您此刻越放松，身体的恢复状态越好。";
                        } else if (tab.dataset.key === 'trend') {
                            speakText = "这是心率趋势图。红色的实线是心跳速度，蓝色的虚线是心跳的弹性。蓝线如果抬高，说明您正在放松；如果蓝线压低，说明您还有点紧张。";
                        } else if (tab.dataset.key === 'scatter') {
                            speakText = "这是 RR 散点图。图上的点越分散，说明您的心跳越有弹性，人越放松；如果点挤成一团，说明心跳很规律，人可能有些紧绷。";
                        } else if (tab.dataset.key === 'cards') {
                            speakText = "这是关键指标卡。您看中间的蓝色方块，如果它落在两侧的灰色区域里，说明指标完全正常。上方还为您给出了综合的放松评分。";
                        }
                        if (speakText) {
                            window.qxSpeak(speakText, () => {});
                        }
                    }
                });
            });

            const helpBtn = document.getElementById('qx1_chart_modal_help');
            if (helpBtn) {
                helpBtn.addEventListener('click', () => {
                    const active = modal.querySelector('.qx1-chart-modal-tab.active');
                    const key = active ? active.dataset.key : 'radar';
                    openHelpCard(key);
                });
            }
        }

        const delBtn = document.getElementById('qx1_btn_del_event');
        if (delBtn) delBtn.classList.add('hidden');

        modal.classList.add('show');
        renderHrvModal('radar');
    }

    function closeHrvModal() {
        const modal = document.getElementById('qx1_chart_modal');
        if (modal) modal.classList.remove('show');

        const delBtn = document.getElementById('qx1_btn_del_event');
        if (delBtn) delBtn.classList.remove('hidden');
    }

    function getShortDesc(key) {
        const map = {
            radar: t([
                '四轴分别是：平均心率、RMSSD、SDNN、HF。',
                '',
                '它们共同反映一件事——你的自主神经此刻偏"松弛"，还是偏"紧绷"。',
                '',
                '四轴围成的面积越大，说明副交感神经越占上风，身体越处于放松、修复、恢复的状态。',
                '',
                '（副交感神经：负责"休息与消化"的那一半神经系统。）',
            ].join('\n'), [
                'Four axes: average heart rate, RMSSD, SDNN, HF.',
                '',
                'Together they reflect one thing — whether your autonomic nervous system is relaxed or tense right now.',
                '',
                'The larger the area, the more the parasympathetic side dominates, and the more your body is in rest, repair and recovery mode.',
                '',
                '(Parasympathetic: the "rest and digest" half of the nervous system.)',
            ].join('\n')),

            trend: t([
                '红线是心率（每分钟心跳次数），蓝虚线是 RMSSD（相邻两次心跳间隔的波动幅度）。',
                '',
                '红线平稳、蓝线抬高 → 说明你正在放松；',
                '红线起伏、蓝线压低 → 说明你还绷着。',
                '',
                '看整体趋势就好，别被一两个尖峰吓到。',
                '',
                '（RMSSD 是心率变异性里最常用的短时指标，反映副交感活性。）',
            ].join('\n'), [
                'Red line is heart rate (beats per minute); blue dashed line is RMSSD (variation between adjacent beat intervals).',
                '',
                'Red line steady, blue line rising → you are relaxing.',
                'Red line swinging, blue line dropping → you are still tense.',
                '',
                'Look at the overall trend; don\'t be scared by one or two spikes.',
                '',
                '(RMSSD is the most common short-term HRV index, reflecting parasympathetic activity.)',
            ].join('\n')),

            scatter: t([
                'RR 间期，是"两次心跳之间的间隔时间"。',
                '',
                '这张图把所有 RR 配对画成点：',
                '横轴是这一次的间隔，纵轴是下一次的间隔。',
                '',
                '点越集中 → 心跳很规律 → 人越紧张、越绷；',
                '点越分散 → 心跳有弹性 → 人越放松、恢复越好。',
                '',
                '（这类图叫 Poincaré 散点，是看 HRV 混沌程度的一种直观方法。）',
            ].join('\n'), [
                'RR interval is the time between two heartbeats.',
                '',
                'This chart pairs every RR and plots them as points:',
                'X-axis is the current interval, Y-axis is the next one.',
                '',
                'Tighter cluster → more regular heartbeat → more tense.',
                'More scattered → more elastic heartbeat → more relaxed and recovered.',
                '',
                '(This is a Poincaré scatter, an intuitive way to see HRV chaos.)',
            ].join('\n')),

            cards: t('关键 HRV 指标一览。', 'Key HRV metrics.'),
        };
        return map[key] || '';
    }

    function getLongDesc() {
        return t([
            'HF 高频：与呼吸同步，副交感活性可靠指标，越低越紧张',
            'LF 低频：交感+副交感混合，压力参考',
            'RMSSD：相邻心跳间隔差值的均方根，越大副交感越强',
            'SDNN：心跳间隔标准差，反映整体 HRV 大小，值越低说明自主神经调节能力越差',
            '',
            '平均心率 + RMSSD 组合：最实用的情绪状态判断',
            '  高 HR + 低 RMSSD = 紧张',
            '  低 HR + 高 RMSSD = 放松',
            '  ⚠️ 趋势可用，有了多日形成的个人 HRV 基线',
            '',
            '个人 HRV 基线定义：一个人在静息、无压力状态下，RMSSD 和平均心率的常态范围',
            '  - 基线不是"一个固定值"，是"一个范围"（如 RMSSD 45–65ms）',
            '  - 基线是"个人专属"的，不能跨人比较',
            '  - 基线会"随时间缓慢变化"，不是永久固定',
            '',
            '个人基线偏移',
            '  - 如果长期记录，能看出"本次整体球体比平时大还是小？"',
            '  - 大 → 今天恢复好；小 → 今天压力大',
        ].join('\n'), [
            'HF (high freq): synced with breathing, reliable parasympathetic index. Lower = more tense.',
            'LF (low freq): mixed sympathetic + parasympathetic, a stress reference.',
            'RMSSD: root mean square of successive beat interval differences. Higher = more parasympathetic.',
            'SDNN: standard deviation of beat intervals, overall HRV. Lower = worse autonomic regulation.',
            '',
            'Average HR + RMSSD combo: the most practical read of emotional state.',
            '  High HR + low RMSSD = tense',
            '  Low HR + high RMSSD = relaxed',
            '  ⚠️ Trend is usable once a personal HRV baseline is built over days.',
            '',
            'Personal HRV baseline: the normal range of RMSSD and average HR at rest, under no stress.',
            '  - A baseline is not "a fixed value", it is "a range" (e.g. RMSSD 45–65 ms).',
            '  - Baselines are personal; do not compare across people.',
            '  - Baselines drift slowly over time, not permanent.',
            '',
            'Personal baseline shift',
            '  - With long-term records, you can see "is today\'s sphere bigger or smaller than usual?"',
            '  - Bigger → better recovery today; smaller → more stress today',
        ].join('\n'));
    }

    function openHelpCard(key) {
        const body = (key === 'cards') ? getLongDesc() : getShortDesc(key);
        const titleMap = {
            radar:   t('HRV 雷达 · 怎么看', 'HRV Radar · How to read'),
            trend:   t('心率趋势 · 怎么看', 'HR Trend · How to read'),
            scatter: t('RR 散点 · 怎么看', 'RR Scatter · How to read'),
            cards:   t('HRV 指标说明', 'HRV Metrics'),
        };
        if (window.qxHelpCard && typeof qxHelpCard.show === 'function') {
            qxHelpCard.show({
                title: titleMap[key] || t('说明', 'Help'),
                body: body,
                size: 'frame',
            });
        } else {
            console.warn('[qx1] qxHelpCard 未加载');
        }
    }

    function renderHrvModal(key) {
        const body = document.getElementById('qx1_chart_modal_body');
        if (!body) return;

        body.innerHTML = '';

        const r = state.hrvResult;

        if (!r) {
            body.innerHTML = `<div class="qx1-chart-modal-empty">${t('暂无 HRV 数据，请先采集', 'No HRV data yet')}</div>`;
            return;
        }

        if (key === 'radar' && typeof qxHrvCapture.drawRadarChart === 'function') {
            qxHrvCapture.drawRadarChart(body, r);
        } else if (key === 'trend' && typeof qxHrvCapture.drawTrendChart === 'function') {
            qxHrvCapture.drawTrendChart(body, r);
        } else if (key === 'scatter' && typeof qxHrvCapture.drawScatterChart === 'function') {
            qxHrvCapture.drawScatterChart(body, r);
        } else if (key === 'cards' && typeof qxHrvCapture.drawCardChart === 'function') {
            qxHrvCapture.drawCardChart(body, r);
        } else {
            qxHrvCapture.drawDashboard('qx1_chart_modal_body', r);
        }
    }

    function openHealModal() {
        if (window.speechSynthesis) window.speechSynthesis.cancel(); // 🌟 闭嘴，别再念总介绍了
        const modal = document.getElementById('qx1_heal_modal');
        if (!modal) return;
        modal.classList.add('show');
        const timer = document.getElementById('qx1_heal_modal_timer');
        if (timer) timer.innerText = t('0 / 60 秒', '0 / 60 s');

        const src = qxHrvCapture.getSource ? qxHrvCapture.getSource() : 'camera';
        const hint = document.getElementById('qx1_heal_modal_hint');
        if (hint) {
            if (src === 'polar') {
                hint.innerText = t('Polar H10 采集中…', 'Polar H10 capturing…');
            } else {
                hint.innerText = t('把干净的手指放到摄像头上', 'Put a clean finger on the camera');
            }
        }

        const pf = document.getElementById('qx1_heal_modal_progress');
        if (pf) pf.style.width = '0%';
        if (window.qxHealChart) {
            try { qxHealChart.start('qx1_heal_canvas'); } catch (e) { console.error('[qx1] heal start 失败', e); }
        }
    }

    function closeHealModal() {
        const modal = document.getElementById('qx1_heal_modal');
        if (modal) modal.classList.remove('show');
        if (window.qxHealChart) {
            try { qxHealChart.reset(); } catch (e) {}
        }
    }

    function startHrvCapture() {
        if (!window.qxHrvCapture) {
            console.error('[qx1] window.qxHrvCapture 未加载，请检查 qx_hrv_capture.js 是否在 qx1 之前引入');
            toast(t('HRV 模块未加载，请刷新页面', 'HRV module not loaded, please refresh'), 'error');
            return;
        }

        let host = document.getElementById('qx1_hrv_capture');
        if (!host) {
            console.warn('[qx1] 找不到 #qx1_hrv_capture，自动创建容器');
            host = document.createElement('div');
            host.id = 'qx1_hrv_capture';
            host.className = 'qx1-hrv-capture';
            const anchor = document.getElementById('qx1_hrv_timer');
            const parent = anchor ? (anchor.closest('.qx1-hrv-capture-area') || anchor.parentElement) : null;
            if (parent) parent.insertBefore(host, parent.firstChild);
            else document.body.appendChild(host);
        }

        let src = getHrvSourceFromSetting();
        const polarReady = !!(window.qxPolarH10
                          && typeof window.qxPolarH10.isConnected === 'function'
                          && window.qxPolarH10.isConnected());
        console.log('[qx1] Setting 采样源 =', src, '| Polar 已连接 =', polarReady,
                    '| 容器存在 =', !!host);

        if (src === 'polar' && !polarReady) {
            console.warn('[qx1] Polar 未连接，降级为摄像头 PPG');
            toast(t('Polar H10 未连接，本次改用摄像头 PPG',
                    'Polar H10 not connected. Using camera PPG this time.'), 'warning');
            src = 'camera';
        }

        qxHrvCapture.start('qx1_hrv_capture', {
            source: src,
            duration: 60,
            onProgress: (rt) => {
                if (!rt) return;
                if (window.qxHealChart) {
                    try { qxHealChart.push(rt); } catch (e) {}
                }
            },
            onAbort: (info) => {
                if (!info) return;
                if (info.reason === 'no_finger') {
                    toast(t('手指松开了，请把手指轻轻放回摄像头，数据正在保留…', 'Finger removed. Please place it back gently. Data is being preserved...'), 'warning');
                } else if (info.reason === 'unsupported') {
                    toast(info.message || t('本机不支持蓝牙心率带', 'Bluetooth not supported'), 'error');
                } else if (info.reason === 'LOW_RR') {
                    toast(t('Polar 有效数据不足，请重测', 'Not enough Polar data, retry'), 'warning');
                }
            },
            onComplete: (result) => {
                if (result && (result.coverage === undefined || result.coverage >= 0.10)) {
                    state.hrvResult = result;
                    state.hrvSaved = false;
                    markDirty();
                    const srcLabel = (result.source === 'polar') ? 'Polar' : t('摄像头', 'Camera');
                    toast(t(`HRV 采集完成（${srcLabel}），请点"存入"`,
                            `HRV done (${srcLabel}), please save`), 'success');
                } else {
                    toast(t('HRV 数据不足，请重试', 'HRV data insufficient'), 'warning');
                }
                if (window.qxHealChart) {
                    try { qxHealChart.finish(); } catch (e) {}
                }
            }
        });
    }

    async function qx1_init() {
        console.log('qx1_init 开始');
        if (state.initialized) return;

        state.isGuest = (getUserType() === 14);
        state.emotionCode = null;
        state.savedEmotionCode = null;
        state.events = [];
        state.savedEvents = [];
        state.selectedEventIndex = -1;
        state.canExit = true;
        state.eventsSaved = true;
        state.hrvResult = null;
        state.hrvSaved = false;
        // 🌟 抢跑：不等加载，立刻开口说话！
        setTimeout(() => {
            if (window.qxSpeak) {
                window.qxSpeak(QX1_GUIDE_TEXT, () => {});
            }
        }, 100); // 改成了100毫秒
        applyLayout();
        window.addEventListener('resize', onResizeDebounced);
        window.addEventListener('orientationchange', onResizeDebounced);
        qxMoodMirror.create('qx1_emotion_wheel', {
            mode: '今日情绪',
            initialCode: 0,
            doIt: '做',
            thermometerSide: 'right',
            onChange: (code) => {
                if (window.speechSynthesis) window.speechSynthesis.cancel(); // 🌟 闭嘴
                state.emotionCode = (code == null || code === 0) ? null : code;
                refreshEmotionTitle();
                markDirty();
            }
        });

        (function waitAndStart(remainMs) {
            if (window.qxHrvCapture) { startHrvCapture(); return; }
            if (remainMs <= 0) {
                console.error('[qx1] 等待 qxHrvCapture 超时，仍未加载');
                toast(t('HRV 模块加载超时，请检查脚本引入', 'HRV module load timeout'), 'error');
                return;
            }
            setTimeout(() => waitAndStart(remainMs - 100), 100);
        })(3000);

        const hrvRoot = document.getElementById('qx1_hrv_capture');
        if (hrvRoot) {
            hrvRoot.addEventListener('click', (ev) => {
                const btn = ev.target.closest('.qx-hrv-btn-start');
                if (btn) {
                    setTimeout(() => openHealModal(), 60);
                }
            });
        }
        const closeBtn = document.getElementById('qx1_heal_modal_close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                closeHealModal();
                try { qxHrvCapture.stop(); } catch (e) {}
            };
        }

        renderEventList();
        bindEventDetailRadios();
        bindHeartIcon();
        updateHeartIcon();
        refreshEmotionTitle();

        const saveBtn = document.getElementById('qx1_btn_save');
        const delBtn = document.getElementById('qx1_btn_del_event');
        const exitBtn = document.getElementById('qx1_btn_exit');

        if (delBtn) delBtn.classList.remove('hidden');

        if (state.isGuest) {
            saveBtn.classList.add('disabled');
            saveBtn.disabled = true;
        } else {
            saveBtn.classList.remove('disabled');
            saveBtn.disabled = false;
        }

        saveBtn.onclick = onSave;
        delBtn.onclick = onDeleteCurrentEvent;
        exitBtn.onclick = onExit;

        loadCategories();

        if (state.isGuest) {
            renderEventList();
        } else {
            try {
                const result = await rpc('emobao_get_today_perception', { p_userid: getUserId() });
                const row = Array.isArray(result) ? result[0] : result;

                const hasData = row && (
                    row.emotion_code != null ||
                    (Array.isArray(row.events) && row.events.length > 0)
                );

                if (hasData) {
                    if (row.emotion_code != null) {
                        state.emotionCode = row.emotion_code;
                        state.savedEmotionCode = row.emotion_code;
                    }
                    if (Array.isArray(row.events) && row.events.length > 0) {
                        state.events = row.events.map(e => ({
                            eventcode: e.eventcode,
                            eventname_cn: e.eventname_cn || '',
                            eventname_en: e.eventname_en || '',
                            eventnature: e.eventnature || '',
                            impactlevel: e.impactlevel || 0,
                        }));
                        state.savedEvents = JSON.parse(JSON.stringify(state.events));
                    }
                    state.eventsSaved = true;
                } else {
                    state.emotionCode = null;
                    state.savedEmotionCode = null;
                    state.events = [];
                    state.savedEvents = [];
                    state.eventsSaved = true;
                }

                if (state.emotionCode != null) {
                    qxMoodMirror.setValue('qx1_emotion_wheel', state.emotionCode);
                }
                refreshEmotionTitle();

                if (state.events.length > 0) {
                    state.selectedEventIndex = 0;
                }
                renderEventList();
                showEventDetail();
                updateHeartIcon();
            } catch (e) {
                console.warn('[qx1] 加载当日记录失败，按空记录处理', e);
                state.emotionCode = null;
                state.savedEmotionCode = null;
                state.events = [];
                state.savedEvents = [];
                state.eventsSaved = true;
                state.selectedEventIndex = -1;
                renderEventList();
                showEventDetail();
                updateHeartIcon();
                refreshEmotionTitle();
            }
        }

        applyLayout();

        state.initialized = true;
        console.log('qx1_init 完成');
    }

    function qx1_destroy() {
        console.log('qx1_destroy');
        state.initialized = false;

        window.removeEventListener('resize', onResizeDebounced);
        window.removeEventListener('orientationchange', onResizeDebounced);

        qxMoodMirror.destroy('qx1_emotion_wheel');
        qxHrvCapture.release();
        closeHealModal();

        const list = document.getElementById('qx1_event_list');
        if (list) list.innerHTML = '';
        const tree = document.getElementById('qx1_tree');
        if (tree) tree.innerHTML = '';
        const chart = document.getElementById('qx1_impact_chart');
        if (chart) chart.innerHTML = '';

        const modal = document.getElementById('qx1_chart_modal');
        if (modal) {
            modal.classList.remove('show');
            modal.remove();
        }

        if (window.qxHelpCard) {
            try { qxHelpCard.hide(); } catch (e) {}
        }

        state.events = [];
        state.selectedEventIndex = -1;
        state.savedEvents = [];
        state.categoryEventsMap = {};
        state.treeExpanded = {};
        state.hrvResult = null;
        state.hrvSaved = false;
        refreshEmotionTitle();
    }

    window.qx1_init = qx1_init;
    window.qx1_destroy = qx1_destroy;

})();