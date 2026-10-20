/* ================================================================
   情绪宝 - qx6-7 知识库维护
   路径：js/qx6/qx6_7_qa_engine.js
   日期：2026-10-15
   说明：
   - 仅系统管理员可访问
   - 列表不拉 optionconfig；点题才拉该题完整数据
   - 新增/编辑走右侧详情区；加事件用正式弹层
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_7_qa_engine] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    const state = {
        categories: [],
        assessments: {},          // categorycode -> assessmentid
        questionsByCat: {},       // categorycode -> [ {questionid, questionno, questiontext_cn, questiontext_en, dimension} ]
        questionById: {},         // questionid -> 列表行
        detailCache: {},          // questionid -> 完整 optionconfig
        lifeevents: null,         // 懒加载
        lifeeventByCode: {},
        expanded: {},             // categorycode -> bool
        selectedId: null,
        isCreating: false,
        filterText: '',
        filterCat: '__all__',
    };

    function getEl(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ============ 事件字典懒加载 ============ */
    async function ensureLifeevents() {
        if (state.lifeevents) return;
        const events = await U.restGet('emobao_lifeevent?isactive=eq.true&order=sortorder');
        state.lifeevents = [];
        state.lifeeventByCode = {};
        events.forEach(e => {
            const code = e.eventcode || '';
            if (!/^EV[A-Z]\d{3}$/.test(code)) return;
            const item = { eventcode: code, cn: e.eventname_cn || '', en: e.eventname_en || '' };
            state.lifeevents.push(item);
            state.lifeeventByCode[code] = item;
        });
    }

    function eventName(code) {
        const e = state.lifeeventByCode[code];
        if (!e) return code;
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? e.cn : (e.en || e.cn);
    }

    /* ============ 首屏：只拉分类 + assessment + 题目列表（不含 optionconfig）============ */
    async function loadIndex() {
        const cats = await U.restGet(
            'emobao_assessment_category?categorycode=like.QX4_*&isactive=eq.true&order=categoryid'
        );
        state.categories = cats.map(c => ({
            categoryid: c.categoryid,
            categorycode: c.categorycode,
            name_cn: c.categoryname_cn || '',
            name_en: c.categoryname_en || '',
        }));

        const assessments = await U.restGet(
            'emobao_assessment?enginecode=eq.QX4_KNOWLEDGE&select=assessmentid,categoryid,title_cn,title_en'
        );
        state.assessments = {};
        assessments.forEach(a => {
            const cat = state.categories.find(c => c.categoryid === a.categoryid);
            if (cat) state.assessments[cat.categorycode] = a.assessmentid;
        });

        const ids = Object.values(state.assessments);
        state.questionsByCat = {};
        state.questionById = {};
        state.categories.forEach(c => { state.questionsByCat[c.categorycode] = []; });

        if (ids.length > 0) {
            const idList = ids.map(x => `"${x}"`).join(',');
            // 关键：不 select optionconfig
            const rows = await U.restGet(
                `emobao_assessment_question?assessmentid=in.(${idList})` +
                `&select=questionid,assessmentid,questionno,questiontext_cn,questiontext_en,dimension` +
                `&order=assessmentid,questionno`
            );
            const idToCat = {};
            Object.keys(state.assessments).forEach(code => {
                idToCat[state.assessments[code]] = code;
            });
            rows.forEach(q => {
                const catCode = idToCat[q.assessmentid];
                if (!catCode) return;
                state.questionsByCat[catCode].push(q);
                state.questionById[q.questionid] = q;
            });
        }
    }

    async function fetchDetail(questionid) {
        if (state.detailCache[questionid]) return state.detailCache[questionid];
        const rows = await U.restGet(
            `emobao_assessment_question?questionid=eq.${questionid}&select=questionid,optionconfig&limit=1`
        );
        const row = rows && rows[0];
        const cfg = (row && row.optionconfig) || {};
        state.detailCache[questionid] = cfg;
        return cfg;
    }

    /* ============ 主界面 ============ */
    function renderRoot(bodyEl) {
        bodyEl.innerHTML = `
            <div class="qx6-kb-root">
                <div class="qx6-kb-toolbar">
                    <input type="text" id="qx6_kb_search" class="qx6-input qx6-kb-search" placeholder="${esc(t('搜索题目…', 'Search…'))}">
                    <select id="qx6_kb_filter" class="qx6-input qx6-kb-filter">
                        <option value="__all__">${esc(t('全部大类', 'All categories'))}</option>
                    </select>
                    <button id="qx6_kb_add" class="qx6-btn qx6-btn-primary qx6-kb-add">${esc(t('+ 增加题目', '+ Add'))}</button>
                </div>
                <div class="qx6-kb-body">
                    <div class="qx6-kb-tree" id="qx6_kb_tree"></div>
                    <div class="qx6-kb-detail" id="qx6_kb_detail"></div>
                </div>
            </div>
        `;

        const sel = getEl('qx6_kb_filter');
        state.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.categorycode;
            opt.innerText = c.name_cn + ' / ' + c.name_en;
            sel.appendChild(opt);
        });

        getEl('qx6_kb_search').addEventListener('input', e => {
            state.filterText = (e.target.value || '').trim().toLowerCase();
            renderTree();
        });
        getEl('qx6_kb_filter').addEventListener('change', e => {
            state.filterCat = e.target.value;
            renderTree();
        });
        getEl('qx6_kb_add').onclick = () => startCreate();

        renderTree();
        renderDetail();
    }

    function renderTree() {
        const tree = getEl('qx6_kb_tree');
        if (!tree) return;
        tree.innerHTML = '';

        const catList = state.filterCat === '__all__'
            ? state.categories
            : state.categories.filter(c => c.categorycode === state.filterCat);

        catList.forEach(c => {
            const catDiv = document.createElement('div');
            catDiv.className = 'qx6-kb-cat';

            const head = document.createElement('div');
            head.className = 'qx6-kb-cat-head';
            const expanded = !!state.expanded[c.categorycode];
            head.innerHTML = `
                <span class="qx6-kb-arrow">${expanded ? '▼' : '▶'}</span>
                <span class="qx6-kb-cat-name">${esc(c.name_cn)}</span>
                <span class="qx6-kb-cat-en">${esc(c.name_en)}</span>
                <button class="qx6-kb-cat-edit" title="${esc(t('改大类名（不改题）', 'Rename category'))}">✎</button>
            `;
            head.querySelector('.qx6-kb-arrow').parentElement.addEventListener('click', (ev) => {
                if (ev.target.classList.contains('qx6-kb-cat-edit')) return;
                state.expanded[c.categorycode] = !state.expanded[c.categorycode];
                renderTree();
            });
            head.querySelector('.qx6-kb-cat-edit').addEventListener('click', (ev) => {
                ev.stopPropagation();
                onEditCategory(c);
            });
            catDiv.appendChild(head);

            if (expanded) {
                const list = document.createElement('div');
                list.className = 'qx6-kb-list';
                let items = state.questionsByCat[c.categorycode] || [];
                if (state.filterText) {
                    items = items.filter(q =>
                        (q.questiontext_cn || '').toLowerCase().includes(state.filterText) ||
                        (q.questiontext_en || '').toLowerCase().includes(state.filterText)
                    );
                }
                items.forEach(q => {
                    const row = document.createElement('div');
                    row.className = 'qx6-kb-item' + (state.selectedId === q.questionid ? ' selected' : '');
                    row.innerText = q.questiontext_cn || q.questiontext_en || '(无题)';
                    row.onclick = () => selectQuestion(q.questionid);
                    list.appendChild(row);
                });
                if (items.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'qx6-kb-empty';
                    empty.innerText = state.filterText
                        ? t('无匹配', 'No match')
                        : t('暂无题目', 'No questions');
                    list.appendChild(empty);
                }
                catDiv.appendChild(list);
            }

            tree.appendChild(catDiv);
        });
    }

    /* ============ 右侧详情 ============ */
    let editing = null;   // { mode:'edit'|'create', questionid, catCode, cfg, codes }

    function selectQuestion(qid) {
        state.isCreating = false;
        state.selectedId = qid;
        editing = null;
        renderTree();
        renderDetail();
    }

    function startCreate() {
        state.selectedId = null;
        state.isCreating = true;
        const catCode = (state.filterCat !== '__all__')
            ? state.filterCat
            : (state.categories[0] ? state.categories[0].categorycode : '');
        editing = {
            mode: 'create',
            questionid: null,
            catCode: catCode,
            cfg: { answer_cn: '', answer_en: '', event_codes: [] },
            codes: [],
        };
        renderTree();
        renderDetail();
    }

    async function renderDetail() {
        const box = getEl('qx6_kb_detail');
        if (!box) return;

        if (editing && editing.mode === 'create') {
            renderEditForm(box, null, editing);
            return;
        }

        const q = state.selectedId ? state.questionById[state.selectedId] : null;
        if (!q) {
            box.innerHTML = `<div class="qx6-kb-detail-empty">${esc(t('请点上方大类标题那一行（▶ 处）展开，再点具体题目；或点右上角 [ + 增加题目 ] 新建。', 'Click the category row (▶) above to expand, then click a question; or click [ + Add ] at top right.'))}</div>`;
            return;
        }

        box.innerHTML = `<div class="qx6-kb-detail-empty">${esc(t('加载题目数据…', 'Loading…'))}</div>`;
        try {
            const cfg = await fetchDetail(q.questionid);
            const codes = Array.isArray(cfg.event_codes) ? cfg.event_codes : [];
            editing = {
                mode: 'edit',
                questionid: q.questionid,
                catCode: findCatCodeByAssessment(q.assessmentid),
                cfg: cfg,
                codes: codes.slice(),
            };
            renderEditForm(box, q, editing);
        } catch (e) {
            box.innerHTML = `<div class="qx6-kb-detail-empty">${esc(t('加载失败：', 'Load failed: '))}${esc(e.message)}</div>`;
        }
    }

    function findCatCodeByAssessment(assessmentid) {
        const found = Object.keys(state.assessments).find(k => state.assessments[k] === assessmentid);
        return found || '';
    }

    function renderEditForm(box, q, ed) {
        const title = ed.mode === 'create'
            ? t('新增题目', 'New Question')
            : t('题目详情', 'Question Detail');

        box.innerHTML = `
            <div class="qx6-kb-detail-title">${esc(title)}</div>

            <label class="qx6-kb-field">
                <span>${esc(t('所属大类', 'Category'))}</span>
                <select id="qx6_kb_f_cat" class="qx6-input">
                    ${state.categories.map(c =>
                        `<option value="${c.categorycode}" ${c.categorycode === ed.catCode ? 'selected' : ''}>${esc(c.name_cn)} / ${esc(c.name_en)}</option>`
                    ).join('')}
                </select>
            </label>

            <label class="qx6-kb-field">
                <span>${esc(t('题目中文', 'Question (CN)'))}</span>
                <input id="qx6_kb_f_qt_cn" class="qx6-input" value="${esc(q ? (q.questiontext_cn || '') : '')}">
            </label>

            <label class="qx6-kb-field">
                <span>${esc(t('题目英文', 'Question (EN)'))}</span>
                <input id="qx6_kb_f_qt_en" class="qx6-input" value="${esc(q ? (q.questiontext_en || '') : '')}">
            </label>

            <label class="qx6-kb-field">
                <span>${esc(t('答案中文', 'Answer (CN)'))}</span>
                <textarea id="qx6_kb_f_ans_cn" class="qx6-input qx6-kb-textarea">${esc(ed.cfg.answer_cn || '')}</textarea>
            </label>

            <label class="qx6-kb-field">
                <span>${esc(t('答案英文', 'Answer (EN)'))}</span>
                <textarea id="qx6_kb_f_ans_en" class="qx6-input qx6-kb-textarea">${esc(ed.cfg.answer_en || '')}</textarea>
            </label>

            <div class="qx6-kb-field">
                <span>${esc(t('事件关联', 'Event Links'))}</span>
                <div class="qx6-kb-events" id="qx6_kb_events"></div>
                <button id="qx6_kb_add_event" class="qx6-btn qx6-btn-small">${esc(t('+ 添加事件', '+ Add event'))}</button>
            </div>

            <div class="qx6-kb-actions">
                <button id="qx6_kb_save" class="qx6-btn qx6-btn-primary">${esc(t('保存', 'Save'))}</button>
                ${ed.mode === 'edit'
                    ? `<button id="qx6_kb_delete" class="qx6-btn qx6-btn-danger">${esc(t('删除此题', 'Delete'))}</button>`
                    : `<button id="qx6_kb_cancel" class="qx6-btn qx6-btn-secondary">${esc(t('取消', 'Cancel'))}</button>`}
            </div>
        `;

        renderEventChips(ed.codes);
        getEl('qx6_kb_add_event').onclick = () => openEventPicker(ed.codes, (newCodes) => {
            ed.codes = newCodes;
            renderEventChips(ed.codes);
        });
        getEl('qx6_kb_save').onclick = () => onSave(q, ed);
        if (ed.mode === 'edit') {
            getEl('qx6_kb_delete').onclick = () => onDelete(q);
        } else {
            getEl('qx6_kb_cancel').onclick = () => {
                editing = null;
                state.isCreating = false;
                renderDetail();
            };
        }
    }

    function renderEventChips(codes) {
        const box = getEl('qx6_kb_events');
        if (!box) return;
        box.innerHTML = '';
        if (!codes || codes.length === 0) {
            box.innerHTML = `<span class="qx6-kb-events-empty">${esc(t('未关联任何事件（保存前必须至少加一个）', 'No events linked (must add at least one before saving)'))}</span>`;
            return;
        }
        codes.forEach(code => {
            const chip = document.createElement('span');
            chip.className = 'qx6-kb-chip';
            chip.title = code;
            chip.innerHTML = `<span class="qx6-kb-chip-name">${esc(eventName(code))}</span><span class="qx6-kb-chip-x">✕</span>`;
            chip.querySelector('.qx6-kb-chip-x').onclick = () => {
                const newCodes = codes.filter(x => x !== code);
                if (newCodes.length === 0) {
                    alert(t('每题至少要挂一个事件', 'At least one event required'));
                    return;
                }
                if (editing) editing.codes = newCodes;
                renderEventChips(newCodes);
            };
            box.appendChild(chip);
        });
    }

    /* ============ 事件选择弹层 ============ */
    function openEventPicker(currentCodes, onConfirm) {
        ensureLifeevents().then(() => {
            const overlay = document.createElement('div');
            overlay.className = 'qx6-kb-overlay';

            // 按 categorycode 前缀分组
            const groups = {};
            state.lifeevents.forEach(e => {
                const prefix = e.eventcode.slice(0, 3);   // 'EVW' 'EVF' 'EVH' ...
                if (!groups[prefix]) groups[prefix] = [];
                groups[prefix].push(e);
            });

            overlay.innerHTML = `
                <div class="qx6-kb-picker">
                    <div class="qx6-kb-picker-head">
                        <span>${esc(t('选择生活事件', 'Select Life Events'))}</span>
                        <button class="qx6-kb-picker-close">✕</button>
                    </div>
                    <div class="qx6-kb-picker-search">
                        <input type="text" id="qx6_kb_picker_search" class="qx6-input" placeholder="${esc(t('搜索…', 'Search…'))}">
                    </div>
                    <div class="qx6-kb-picker-body" id="qx6_kb_picker_body"></div>
                    <div class="qx6-kb-picker-foot">
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_kb_picker_cancel">${esc(t('取消', 'Cancel'))}</button>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_kb_picker_ok">${esc(t('确定', 'OK'))}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const body = overlay.querySelector('#qx6_kb_picker_body');
            const search = overlay.querySelector('#qx6_kb_picker_search');

            function paint(filter) {
                const q = (filter || '').toLowerCase();
                body.innerHTML = '';
                Object.keys(groups).sort().forEach(prefix => {
                    const items = groups[prefix].filter(e =>
                        !q || (e.cn || '').toLowerCase().includes(q) || (e.en || '').toLowerCase().includes(q)
                    );
                    if (items.length === 0) return;
                    const grp = document.createElement('div');
                    grp.className = 'qx6-kb-picker-group';
                    const title = document.createElement('div');
                    title.className = 'qx6-kb-picker-group-title';
                    title.innerText = prefix;
                    grp.appendChild(title);
                    items.forEach(e => {
                        const row = document.createElement('label');
                        row.className = 'qx6-kb-picker-row';
                        row.innerHTML = `
                            <input type="checkbox" value="${e.eventcode}" ${currentCodes.includes(e.eventcode) ? 'checked' : ''}>
                            <span>${esc(eventName(e.eventcode))}</span>
                        `;
                        grp.appendChild(row);
                    });
                    body.appendChild(grp);
                });
            }

            paint('');

            search.addEventListener('input', (e) => paint(e.target.value));
            overlay.querySelector('.qx6-kb-picker-close').onclick = () => overlay.remove();
            overlay.querySelector('#qx6_kb_picker_cancel').onclick = () => overlay.remove();
            overlay.querySelector('#qx6_kb_picker_ok').onclick = () => {
                const checked = [...body.querySelectorAll('input[type="checkbox"]:checked')].map(x => x.value);
                if (checked.length === 0) {
                    alert(t('至少要选一个事件', 'Select at least one'));
                    return;
                }
                onConfirm(checked);
                overlay.remove();
            };
        });
    }

    /* ============ 保存 / 删除 / 改名 ============ */
    function onSave(q, ed) {
        const catCode = getEl('qx6_kb_f_cat').value;
        const assessmentid = state.assessments[catCode];
        const text_cn = getEl('qx6_kb_f_qt_cn').value.trim();
        const text_en = getEl('qx6_kb_f_qt_en').value.trim();
        const ans_cn = getEl('qx6_kb_f_ans_cn').value.trim();
        const ans_en = getEl('qx6_kb_f_ans_en').value.trim();
        const codes = editing.codes.slice();

        if (!assessmentid) { alert(t('请选择大类', 'Select category')); return; }
        if (!text_cn) { alert(t('题目中文不能为空', 'CN question required')); return; }
        if (!text_en) { alert(t('题目英文不能为空', 'EN question required')); return; }
        if (codes.length === 0) { alert(t('每题至少挂一个事件', 'At least one event required')); return; }

        U.rpc('emobao_qx6_upsert_question', {
            p_userid: U.getUserId(),
            p_questionid: ed.questionid,
            p_assessmentid: assessmentid,
            p_questionno: q ? (q.questionno || 1) : 999,
            p_questiontext_cn: text_cn,
            p_questiontext_en: text_en,
            p_answer_cn: ans_cn,
            p_answer_en: ans_en,
            p_event_codes: codes,
            p_dimension: q ? (q.dimension || '') : '',
            p_global_no: (ed.cfg && ed.cfg.global_no) || 0,
        }).then(res => {
            const row = Array.isArray(res) ? res[0] : res;
            if (!row || !row.success) {
                alert(t('保存失败：', 'Save failed: ') + (row && row.message));
                return;
            }
            const newQid = row.new_questionid || ed.questionid;

            // 局部更新本地缓存
            if (ed.mode === 'create') {
                const newQ = {
                    questionid: newQid,
                    assessmentid: assessmentid,
                    questionno: 999,
                    questiontext_cn: text_cn,
                    questiontext_en: text_en,
                    dimension: q ? (q.dimension || '') : '',
                };
                if (!state.questionsByCat[catCode]) state.questionsByCat[catCode] = [];
                state.questionsByCat[catCode].push(newQ);
                state.questionById[newQid] = newQ;
                state.detailCache[newQid] = {
                    global_no: ed.cfg.global_no || 0,
                    answer_cn: ans_cn, answer_en: ans_en,
                    event_codes: codes.slice(),
                };
                state.selectedId = newQid;
                state.isCreating = false;
            } else {
                const qObj = state.questionById[q.questionid];
                if (qObj) {
                    qObj.questiontext_cn = text_cn;
                    qObj.questiontext_en = text_en;
                    const oldCat = findCatCodeByAssessment(qObj.assessmentid);
                    if (oldCat !== catCode) {
                        // 分类移动：本地列表移动
                        state.questionsByCat[oldCat] = (state.questionsByCat[oldCat] || [])
                            .filter(x => x.questionid !== qObj.questionid);
                        qObj.assessmentid = assessmentid;
                        if (!state.questionsByCat[catCode]) state.questionsByCat[catCode] = [];
                        state.questionsByCat[catCode].push(qObj);
                    }
                }
                state.detailCache[q.questionid] = {
                    global_no: ed.cfg.global_no || 0,
                    answer_cn: ans_cn, answer_en: ans_en,
                    event_codes: codes.slice(),
                };
            }

            alert(t('已保存', 'Saved'));
            renderTree();
            renderDetail();
        }).catch(e => {
            alert(t('保存失败：', 'Save failed: ') + e.message);
        });
    }

    function onDelete(q) {
        if (!confirm(t('确定删除这道题？', 'Delete this question?'))) return;
        U.rpc('emobao_qx6_delete_question', {
            p_userid: U.getUserId(),
            p_questionid: q.questionid,
        }).then(res => {
            const row = Array.isArray(res) ? res[0] : res;
            if (!row || !row.success) {
                alert(t('删除失败：', 'Delete failed: ') + (row && row.message));
                return;
            }
            // 局部移除
            const catCode = findCatCodeByAssessment(q.assessmentid);
            state.questionsByCat[catCode] = (state.questionsByCat[catCode] || [])
                .filter(x => x.questionid !== q.questionid);
            delete state.questionById[q.questionid];
            delete state.detailCache[q.questionid];
            state.selectedId = null;
            editing = null;
            renderTree();
            renderDetail();
        }).catch(e => {
            alert(t('删除失败：', 'Delete failed: ') + e.message);
        });
    }

    function onEditCategory(cat) {
        const nameCn = prompt(t('新中文名：', 'New CN name:'), cat.name_cn);
        if (nameCn == null) return;
        const nameEn = prompt(t('新英文名：', 'New EN name:'), cat.name_en);
        if (nameEn == null) return;

        U.rpc('emobao_qx6_update_category', {
            p_userid: U.getUserId(),
            p_categoryid: parseInt(cat.categoryid),
            p_name_cn: nameCn.trim(),
            p_name_en: nameEn.trim(),
        }).then(res => {
            const row = Array.isArray(res) ? res[0] : res;
            if (!row || !row.success) {
                alert(t('改名失败：', 'Rename failed: ') + (row && row.message));
                return;
            }
            cat.name_cn = nameCn.trim();
            cat.name_en = nameEn.trim();
            renderTree();
        }).catch(e => {
            alert(t('改名失败：', 'Rename failed: ') + e.message);
        });
    }

    /* ============ 入口 ============ */
    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }
        bodyEl.innerHTML = `<div class="qx6-empty">${t('加载中… 请稍候', 'Loading… please wait')}</div>`;

        loadIndex().then(() => {
            renderRoot(bodyEl);
        }).catch(e => {
            console.error('[qx6_7_qa_engine] 加载失败', e);
            bodyEl.innerHTML = `<div class="qx6-empty">${t('加载失败：', 'Load failed: ')}${esc(e.message)}</div>`;
        });
    }

    window.qx6Register('qa_engine', render);
})();