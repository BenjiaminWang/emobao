/* ================================================================
   情绪宝 - qx4 知识问答
   v3（2026-10-18）：
   - 引入自动朗读功能，调用全局 window.qxSpeak
   ================================================================ */
   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const ENGINE = 'QX4_KNOWLEDGE';

    const DIMENSION_EN = {
        '积极心理学与健康促进':          'Positive Psychology & Health',
        '基础认知与心身关联':            'Mind-Body Basics',
        '生活方式与情绪健康':            'Lifestyle & Emotional Health',
        '人际关系与社会情绪健康':        'Relationships & Social Health',
        '情绪障碍与躯体化症状':          'Mood Disorders & Somatization',
        '负面情绪与器官影响':            'Negative Emotions & Organs',
        '特殊人群与生命阶段':            'Special Groups & Life Stages',
        '干预、治疗与自我调适':          'Intervention & Self-Regulation',
        '积极心理学前沿：从分子到家族':  'Frontiers: Molecules to Family',
    };

    const state = {
        initialized: false,
        isGuest: false,
        userId: null,
        userType: null,
        todayEmotionCode: null,
        todayEvents: [],
        todayEventCodes: [],
        categories: [],
        assessmentByCat: {},
        questionsByCat: {},
        questionById: {},
        treeExpanded: {},
        selectedQuestionId: null,
    };

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
    function getUserId()   { return window.mQxb && window.mQxb.user_id; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getLang()     { return (window.mQxb && window.mQxb.Language) || 1; }

    let _toastTimer = null;
    function toast(text, type) {
        type = type || 'info';
        let bar = document.getElementById('qx4_toast_bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'qx4_toast_bar';
            bar.className = 'qx1-toast-bar';
            document.body.appendChild(bar);
        }
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        bar.className = 'qx1-toast-bar qx1-toast-' + type;
        bar.innerText = text;
        requestAnimationFrame(() => bar.classList.add('show'));
        _toastTimer = setTimeout(() => bar.classList.remove('show'), 3000);
    }

    async function rpc(fnName, params) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify(params || {}),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`RPC ${fnName}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    async function restGet(path) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST ${path}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    async function loadIdentityAndEvents() {
        state.userId = getUserId();
        state.userType = getUserType();
        state.isGuest = (state.userType === 14);
        state.todayEmotionCode = null;
        state.todayEvents = [];
        state.todayEventCodes = [];

        if (state.isGuest || !state.userId) return;

        try {
            const result = await rpc('emobao_get_today_perception', { p_userid: state.userId });
            const row = Array.isArray(result) ? result[0] : result;
            if (row) {
                if (row.emotion_code != null) state.todayEmotionCode = row.emotion_code;
                if (Array.isArray(row.events)) state.todayEvents = row.events;
            }
            state.todayEventCodes = state.todayEvents
                .map(e => e.eventcode)
                .filter(Boolean);
            console.log('[qx4] 今日情绪:', state.todayEmotionCode, '事件:', state.todayEventCodes);
        } catch (e) {
            console.warn('[qx4] 拉取今日感知失败（不阻断）', e);
        }
    }

    async function loadQx4Data() {
        const cats = await restGet(
            `emobao_assessment_category?categorycode=like.QX4_*&isactive=eq.true&order=categoryid`
        );
        state.categories = cats.map(c => ({
            categoryid: c.categoryid,
            categorycode: c.categorycode,
            name_cn: c.categoryname_cn,
            name_en: c.categoryname_en,
        }));

        const assessments = await restGet(
            `emobao_assessment?enginecode=eq.${ENGINE}&select=assessmentid,categoryid,title_cn,title_en,questioncount`
        );
        state.assessmentByCat = {};
        assessments.forEach(a => {
            const cat = state.categories.find(c => c.categoryid === a.categoryid);
            if (cat) state.assessmentByCat[cat.categorycode] = a.assessmentid;
        });

        state.questionsByCat = {};
        state.questionById = {};
        state.categories.forEach(c => {
            state.questionsByCat[c.categorycode] = [];
            state.treeExpanded[c.categorycode] = false;
        });

        const ids = Object.values(state.assessmentByCat);
        if (ids.length === 0) return;

        const idList = ids.map(x => `"${x}"`).join(',');
        const questions = await restGet(
            `emobao_assessment_question?assessmentid=in.(${idList})&select=questionid,assessmentid,questionno,questiontext_cn,questiontext_en,optionconfig,dimension&order=questionno`
        );

        const idToCat = {};
        Object.keys(state.assessmentByCat).forEach(code => {
            idToCat[state.assessmentByCat[code]] = code;
        });

        questions.forEach(q => {
            const catCode = idToCat[q.assessmentid];
            if (!catCode) return;
            const cfg = q.optionconfig || {};
            const codes = Array.isArray(cfg.event_codes) ? cfg.event_codes : [];
            const hit = codes.filter(c => state.todayEventCodes.indexOf(c) !== -1);

            q._event_codes = codes;
            q._hit_events = hit;
            q._hit_count = hit.length;

            state.questionsByCat[catCode].push(q);
            state.questionById[q.questionid] = q;
        });

        Object.keys(state.questionsByCat).forEach(code => {
            const arr = state.questionsByCat[code];
            arr.sort((a, b) => {
                if (b._hit_count !== a._hit_count) return b._hit_count - a._hit_count;
                return a.questionno - b.questionno;
            });
        });

        Object.keys(state.questionsByCat).forEach(code => {
            const has = state.questionsByCat[code].some(q => q._hit_count > 0);
            if (has) state.treeExpanded[code] = true;
        });
    }

    function renderTitle() {
        const hintEl  = document.getElementById('qx4_hint');
        const userEl  = document.getElementById('qx4_user');

        if (hintEl) {
            const n = state.todayEventCodes.length;
            hintEl.innerText = n > 0 ? t('请关注为您提示的知识', 'See highlighted answers') : '';
        }

        if (userEl) {
            const name = (window.mQxb && window.mQxb.Username) || '';
            userEl.innerText = state.isGuest
                ? t('访客', 'Guest')
                : (name || t('已登录', 'Logged in'));
        }
    }

    function renderTree() {
        const tree = document.getElementById('qx4_tree');
        if (!tree) return;
        const lang = getLang();
        tree.innerHTML = '';

        state.categories.forEach(c => {
            const catDiv = document.createElement('div');
            catDiv.className = 'qx4-tree-cat';

            const children = state.questionsByCat[c.categorycode] || [];
            const catHasHit = children.some(q => q._hit_count > 0);

            const titleDiv = document.createElement('div');
            titleDiv.className = 'qx4-tree-cat-title' + (catHasHit ? ' cat-hit' : '');
            const expanded = !!state.treeExpanded[c.categorycode];
            titleDiv.innerHTML =
                `<span class="qx4-tree-arrow">${expanded ? '▼' : '▶'}</span>` +
                `<span>${lang === 1 ? c.name_cn : c.name_en}</span>` +
                (catHasHit ? ' <span class="qx4-tree-hit-dot">●</span>' : '');
            titleDiv.addEventListener('click', () => {
                state.treeExpanded[c.categorycode] = !state.treeExpanded[c.categorycode];
                renderTree();
            });
            catDiv.appendChild(titleDiv);

            if (expanded) {
                const childDiv = document.createElement('div');
                childDiv.className = 'qx4-tree-children';
                children.forEach(q => {
                    const item = document.createElement('div');
                    item.className = 'qx4-tree-item' + (q._hit_count > 0 ? ' hit' : '');
                    item.dataset.questionid = q.questionid;
                    item.innerText = lang === 1 ? q.questiontext_cn : q.questiontext_en;
                    item.addEventListener('click', () => {
                        selectQuestion(q.questionid, false);
                    });
                    item.addEventListener('dblclick', () => {
                        selectQuestion(q.questionid, true);
                    });
                    childDiv.appendChild(item);
                });
                catDiv.appendChild(childDiv);
            }
            tree.appendChild(catDiv);
        });

        if (state.selectedQuestionId) {
            tree.querySelectorAll('.qx4-tree-item').forEach(el => {
                el.classList.toggle('selected', el.dataset.questionid === state.selectedQuestionId);
            });
        }
    }

    function selectQuestion(questionid, openNow) {
        state.selectedQuestionId = questionid;
        const tree = document.getElementById('qx4_tree');
        if (tree) {
            tree.querySelectorAll('.qx4-tree-item').forEach(el => {
                el.classList.toggle('selected', el.dataset.questionid === questionid);
            });
        }
        if (openNow) showQuestion(questionid);
    }

    function buildBody(q) {
        const lang = getLang();
        const cfg = q.optionconfig || {};
        const questionTitle = lang === 1 ? q.questiontext_cn : q.questiontext_en;
        const answerBody    = lang === 1 ? (cfg.answer_cn || '') : (cfg.answer_en || '');
        return questionTitle + '\n\n' + answerBody;
    }

    function buildTitle(q) {
        const lang = getLang();
        const cat = state.categories.find(c => state.assessmentByCat[c.categorycode] === q.assessmentid);
        if (cat) return lang === 1 ? cat.name_cn : cat.name_en;
        const dim = q.dimension || '';
        if (!dim) return '';
        return lang === 1 ? dim : (DIMENSION_EN[dim] || dim);
    }

    function showQuestion(questionid) {
        const q = state.questionById[questionid];
        if (!q) { toast(t('题目未找到', 'Question not found'), 'error'); return; }
        
        const title = buildTitle(q);
        const body = buildBody(q);

        // 1. 打开卡片
        if (window.qxHelpCard && typeof qxHelpCard.show === 'function') {
            qxHelpCard.show({ title: title, body: body });
        } else {
            alert(title + '\n\n' + body);
        }

        // 2. 自动朗读
        if (window.qxSpeak) {
            const lang = getLang();
            // 文本清洗：把换行替换成逗号，读起来更顺畅
            const cleanText = body.replace(/\n+/g, lang === 1 ? '。' : '. ');
            const prefix = lang === 1 ? '您的问题是关于：' : 'Your question is about: ';
            const fullText = prefix + title + (lang === 1 ? '。' : '. ') + cleanText;
            
            window.qxSpeak(fullText);
        }
    }

    function bindUI() {
        const btnPick = document.getElementById('qx4_btn_pick');
        if (btnPick) {
            btnPick.onclick = () => {
                if (!state.selectedQuestionId) {
                    toast(t('请先选择一条问答', 'Please select a Q&A first'), 'warning');
                    return;
                }
                showQuestion(state.selectedQuestionId);
            };
        }

        const btnExit = document.getElementById('qx4_btn_exit');
        if (btnExit) {
            btnExit.onclick = () => {
                if (window.qxSpeak) window.speechSynthesis.cancel(); // 退出时停止语音
                if (window.returnToMain) window.returnToMain();
            };
        }
    }

    async function qx4_init() {
        console.log('[qx4] init');
        if (state.initialized) return;

        state.selectedQuestionId = null;
        state.treeExpanded = {};
        state.questionsByCat = {};
        state.questionById = {};
        state.todayEventCodes = [];

        renderTitle();
        bindUI();

        try {
            await loadIdentityAndEvents();
            await loadQx4Data();
            renderTitle();
            renderTree();
        } catch (e) {
            console.error('[qx4] 加载失败', e);
            toast(t('加载问答失败，请稍后重试', 'Load failed'), 'error');
        }

        state.initialized = true;
    }

    function qx4_destroy() {
        console.log('[qx4] destroy');
        state.initialized = false;
        state.categories = [];
        state.assessmentByCat = {};
        state.questionsByCat = {};
        state.questionById = {};
        state.treeExpanded = {};
        state.selectedQuestionId = null;
        state.todayEmotionCode = null;
        state.todayEvents = [];
        state.todayEventCodes = [];

        if (window.speechSynthesis) window.speechSynthesis.cancel();

        const tree = document.getElementById('qx4_tree');
        if (tree) tree.innerHTML = '';

        if (window.qxHelpCard) {
            try { qxHelpCard.hide(); } catch (e) {}
        }
    }

    window.qx4_init = qx4_init;
    window.qx4_destroy = qx4_destroy;

})();