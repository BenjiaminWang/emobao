/* ================================================================
   情绪宝 - qx6-10 组曲规则管理面板（定稿版）
   路径：js/qx6/qx6_10_rule_edit.js
   说明：
   - 仅系统管理员可访问
   - 对 emobao_regulationrule 增删改查
   - 表结构（已确认）：
       ruleid uuid, emotioncode int4, rulename varchar, ruletype varchar,
       sequence jsonb, createdby uuid, createdbyname varchar,
       usecount int4, likecount int4, isactive bool, createdat timestamp
   - ruletype 当前取值：system
   - sequence 为 jsonb → 写入用 JSON.stringify，读出为数组
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_10_rule_edit] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    // ================= 可调常量 =================
    const TABLE      = 'emobao_regulationrule';
    const PK         = 'ruleid';
    // 若 ruleid 列无 DEFAULT，把下面改成 true，前端生成 uuid
    const NEED_CLIENT_UUID = false;

    const EMO_TABLE  = 'emobao_emotiontype';
    // 曲目表（当前查询无列返回，可能表名不同或被 RLS 拦；拿不到则降级只显示 id）
    const SONG_TABLE = 'emobao_song';
    const SONG_ID    = 'songid';
    const SONG_NAME  = 'songname_cn';

    const RULETYPE_FALLBACK = ['system'];

    // ================= 自建 REST（不改 utils） =================
    const SB_URL = U.SUPABASE_URL;
    const SB_KEY = U.SUPABASE_KEY;

    async function sbFetch(path, { method = 'GET', body, prefer } = {}) {
        const headers = {
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
        };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (prefer) headers['Prefer'] = prefer;

        const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST ${method} ${path}: ${res.status} ${txt}`);
        }
        const ct = res.headers.get('content-type') || '';
        if (res.status === 204 || !ct.includes('application/json')) return null;
        return res.json();
    }

    const api = {
        get:   (q)        => sbFetch(q),
        post:  (table, r) => sbFetch(table, { method: 'POST',  body: r, prefer: 'return=representation' }),
        patch: (q, r)     => sbFetch(q,      { method: 'PATCH', body: r, prefer: 'return=representation' }),
        del:   (q)        => sbFetch(q,      { method: 'DELETE' }),
    };

    // ================= 小工具 =================
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function normalizeSeq(seq) {
        if (seq == null) return [];
        if (Array.isArray(seq)) return seq.map(String).filter(Boolean);
        if (typeof seq === 'string') {
            const s = seq.trim();
            if (!s) return [];
            if (s[0] === '[') {
                try {
                    const arr = JSON.parse(s);
                    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
                } catch (_) {}
            }
            return s.split(',').map(x => x.trim()).filter(Boolean);
        }
        return [];
    }

    function seqToDb(arr) {
        return JSON.stringify(arr); // jsonb 确认
    }

    // ================= 渲染 =================
    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-re-toolbar">
                    <button class="qx6-btn qx6-btn-primary" id="qx6_re_refresh">${t('刷新', 'Refresh')}</button>
                    <button class="qx6-btn" id="qx6_re_new">${t('新建规则', 'New rule')}</button>
                    <button class="qx6-btn" id="qx6_re_export">${t('导出 JSON', 'Export JSON')}</button>
                    <label class="qx6-btn" style="cursor:pointer">
                        ${t('导入 JSON', 'Import JSON')}
                        <input type="file" id="qx6_re_import" accept="application/json" style="display:none">
                    </label>
                </div>
                <div class="qx6-status" id="qx6_re_status"></div>
                <div id="qx6_re_form" style="display:none"></div>
                <div class="qx6-re-list" id="qx6_re_list">
                    <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                </div>
            </div>
        `;

        const statusEl  = bodyEl.querySelector('#qx6_re_status');
        const listEl    = bodyEl.querySelector('#qx6_re_list');
        const formEl    = bodyEl.querySelector('#qx6_re_form');
        const refreshBtn= bodyEl.querySelector('#qx6_re_refresh');
        const newBtn    = bodyEl.querySelector('#qx6_re_new');
        const exportBtn = bodyEl.querySelector('#qx6_re_export');
        const importInp = bodyEl.querySelector('#qx6_re_import');

        let rulesCache  = [];
        let emotionList = [];
        let emotionMap  = {};   // key: String(emotioncode)
        let songNameMap = {};   // songid -> name（拿不到为空）
        let ruleTypeOptions = RULETYPE_FALLBACK.slice();

        function showStatus(text, type) {
            statusEl.innerText = text || '';
            statusEl.className = 'qx6-status' + (text ? ' qx6-status-' + type : '');
        }

        function emoNameOf(code) {
            const e = emotionMap[String(code)];
            return e ? (e.emotionname_cn || e.emotionname_en || `#${code}`) : `情绪 ${code}`;
        }

        function seqLabel(arr) {
            if (!arr.length) return t('（空）', '(empty)');
            return arr.map(id => {
                const nm = songNameMap[id];
                return nm
                    ? `${esc(nm)}<span class="qx6-re-id">(${esc(id)})</span>`
                    : esc(id);
            }).join(' ');
        }

        // ---------- 加载 ----------
        async function loadRules() {
            showStatus(t('加载中…', 'Loading…'), 'info');
            try {
                const [rules, emotions] = await Promise.all([
                    api.get(`${TABLE}?select=*&order=createdat.desc`).catch(() => []),
                    api.get(`${EMO_TABLE}?select=emotioncode,emotionname_cn,emotionname_en&order=sortorder.asc`).catch(() => []),
                ]);

                // 曲目名（可失败）
                let songs = [];
                try {
                    songs = await api.get(`${SONG_TABLE}?select=${SONG_ID},${SONG_NAME}`) || [];
                } catch (_) { songs = []; }

                songNameMap = {};
                songs.forEach(s => { if (s[SONG_ID] != null) songNameMap[String(s[SONG_ID])] = s[SONG_NAME]; });

                rulesCache  = Array.isArray(rules) ? rules : [];
                emotionList = Array.isArray(emotions) ? emotions : [];
                emotionMap  = {};
                emotionList.forEach(e => { emotionMap[String(e.emotioncode)] = e; });

                // ruletype 选项 = 实际值 ∪ 兜底
                const types = new Set(RULETYPE_FALLBACK);
                rulesCache.forEach(r => { if (r.ruletype) types.add(r.ruletype); });
                ruleTypeOptions = Array.from(types);

                if (!rulesCache.length) {
                    listEl.innerHTML = `<div class="qx6-empty">${t('暂无规则', 'No rules yet')}</div>`;
                    showStatus('', '');
                    return;
                }

                listEl.innerHTML = '';
                rulesCache.forEach(r => {
                    const seq   = normalizeSeq(r.sequence);
                    const name  = r.rulename || t('（未命名）', '(unnamed)');
                    const active = r.isactive !== false;

                    const row = document.createElement('div');
                    row.className = 'qx6-re-row' + (active ? '' : ' qx6-re-inactive');
                    row.dataset.id = r[PK];
                    row.innerHTML = `
                        <div class="qx6-re-head">
                            <span class="qx6-re-name">${esc(name)}</span>
                            <span class="qx6-re-emo">${esc(emoNameOf(r.emotioncode))}</span>
                            <span class="qx6-re-badge">${esc(r.ruletype || '-')}</span>
                            <span class="qx6-re-meta">${seq.length} ${t('首', 'songs')} · ${t('用', 'used')} ${r.usecount || 0} · ${t('赞', 'likes')} ${r.likecount || 0}</span>
                            <span class="qx6-re-state">${active ? t('启用', 'Active') : t('停用', 'Inactive')}</span>
                            <span class="qx6-re-actions">
                                <button class="qx6-btn qx6-btn-sm" data-act="toggle">${active ? t('停用', 'Disable') : t('启用', 'Enable')}</button>
                                <button class="qx6-btn qx6-btn-sm" data-act="edit">${t('编辑', 'Edit')}</button>
                                <button class="qx6-btn qx6-btn-sm qx6-btn-danger" data-act="del">${t('删除', 'Delete')}</button>
                            </span>
                        </div>
                        <div class="qx6-re-detail">${seqLabel(seq)}</div>
                    `;
                    listEl.appendChild(row);
                });

                showStatus(t(`共 ${rulesCache.length} 条规则`, `${rulesCache.length} rules`), 'success');

            } catch (e) {
                console.error('[rule_edit] load fail', e);
                showStatus(t('加载失败：', 'Load failed: ') + (e.message || e), 'error');
                listEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
            }
        }

        // ---------- 表单 ----------
        function openForm(rule) {
            const editing = !!rule;
            const curEmo  = editing ? String(rule.emotioncode) : '';
            const curSeq  = editing ? normalizeSeq(rule.sequence) : [];
            const curName = editing ? (rule.rulename || '') : '';
            const curType = editing ? (rule.ruletype || 'system') : 'system';
            const curActive = editing ? (rule.isactive !== false) : true;

            // 同情绪唯一（排除自身）
            const usedEmo = new Set(
                rulesCache
                    .filter(r => !editing || r[PK] !== rule[PK])
                    .map(r => String(r.emotioncode))
            );

            const emoOptions = emotionList.map(e => {
                const code = String(e.emotioncode);
                const dis = usedEmo.has(code) && code !== curEmo ? 'disabled' : '';
                const sel = code === curEmo ? 'selected' : '';
                return `<option value="${esc(code)}" ${dis} ${sel}>${esc(e.emotionname_cn || e.emotionname_en || code)}</option>`;
            }).join('') || `<option value="">${t('（无情绪字典）', '(no emotion dict)')}</option>`;

            const typeOptions = ruleTypeOptions.map(ty =>
                `<option value="${esc(ty)}" ${ty === curType ? 'selected' : ''}>${esc(ty)}</option>`
            ).join('');

            formEl.style.display = '';
            formEl.innerHTML = `
                <div class="qx6-card qx6-re-form">
                    <div class="qx6-re-field">
                        <label>${t('规则名称', 'Rule name')}</label>
                        <input type="text" id="qx6_re_f_name" value="${esc(curName)}" maxlength="80">
                    </div>
                    <div class="qx6-re-field">
                        <label>${t('情绪', 'Emotion')}</label>
                        <select id="qx6_re_f_emo">${emoOptions}</select>
                    </div>
                    <div class="qx6-re-field">
                        <label>${t('规则类型', 'Rule type')}</label>
                        <select id="qx6_re_f_type">${typeOptions}</select>
                    </div>
                    <div class="qx6-re-field">
                        <label>${t('曲目 ID（逗号或换行分隔）', 'Song IDs (comma / newline)')}</label>
                        <textarea id="qx6_re_f_seq" rows="4" placeholder="song001, song002">${esc(curSeq.join(', '))}</textarea>
                    </div>
                    <div class="qx6-re-field qx6-re-inline">
                        <label><input type="checkbox" id="qx6_re_f_active" ${curActive ? 'checked' : ''}> ${t('启用', 'Active')}</label>
                    </div>
                    <div class="qx6-re-err" id="qx6_re_f_err"></div>
                    <div class="qx6-re-field qx6-re-form-actions">
                        <button class="qx6-btn qx6-btn-primary" id="qx6_re_f_save">${editing ? t('保存', 'Save') : t('创建', 'Create')}</button>
                        <button class="qx6-btn" id="qx6_re_f_cancel">${t('取消', 'Cancel')}</button>
                    </div>
                </div>
            `;

            const nameInp = formEl.querySelector('#qx6_re_f_name');
            const emoSel  = formEl.querySelector('#qx6_re_f_emo');
            const typeSel = formEl.querySelector('#qx6_re_f_type');
            const seqTa   = formEl.querySelector('#qx6_re_f_seq');
            const actChk  = formEl.querySelector('#qx6_re_f_active');
            const errEl   = formEl.querySelector('#qx6_re_f_err');

            formEl.querySelector('#qx6_re_f_cancel').onclick = () => {
                formEl.style.display = 'none';
                formEl.innerHTML = '';
            };

            formEl.querySelector('#qx6_re_f_save').onclick = async () => {
                errEl.innerText = '';
                const emoCode = parseInt(emoSel.value, 10);
                const seq = Array.from(new Set(
                    seqTa.value.split(/[\n,，]/).map(x => x.trim()).filter(Boolean)
                ));
                const rulename = nameInp.value.trim();
                const ruletype = typeSel.value || 'system';
                const isactive = actChk.checked;

                if (!rulename) return (errEl.innerText = t('请填写规则名称', 'Rule name required'));
                if (isNaN(emoCode)) return (errEl.innerText = t('请选择有效情绪', 'Valid emotion required'));
                if (!seq.length) return (errEl.innerText = t('至少填写一个曲目 ID', 'At least one song ID'));
                if (seq.some(id => !/^[\w\-]+$/.test(id))) {
                    return (errEl.innerText = t('曲目 ID 含非法字符', 'Invalid song ID'));
                }

                const clash = rulesCache.find(r =>
                    Number(r.emotioncode) === emoCode && (!editing || r[PK] !== rule[PK])
                );
                if (clash) return (errEl.innerText = t('该情绪已有规则', 'Rule for this emotion already exists'));

                const payload = {
                    emotioncode: emoCode,
                    rulename,
                    ruletype,
                    sequence: seqToDb(seq),
                    isactive,
                };

                if (!editing) {
                    if (NEED_CLIENT_UUID) {
                        payload[PK] = (crypto.randomUUID && crypto.randomUUID()) ||
                            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                                const r = Math.random() * 16 | 0;
                                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                            });
                    }
                    const uid = U.getUserId();
                    if (uid && /^[0-9a-f-]{36}$/i.test(String(uid))) payload.createdby = uid;
                    payload.createdbyname = U.getUserName() || '';
                }

                try {
                    showStatus(t('保存中…', 'Saving…'), 'info');
                    if (editing) {
                        await api.patch(`${TABLE}?${PK}=eq.${encodeURIComponent(rule[PK])}`, payload);
                    } else {
                        await api.post(TABLE, payload);
                    }
                    formEl.style.display = 'none';
                    formEl.innerHTML = '';
                    await loadRules();
                    showStatus(t('已保存', 'Saved'), 'success');
                } catch (e) {
                    console.error(e);
                    errEl.innerText = t('保存失败：', 'Save failed: ') + (e.message || e);
                    showStatus('', '');
                }
            };
        }

        // ---------- 事件 ----------
        refreshBtn.onclick = loadRules;
        newBtn.onclick = () => openForm(null);

        listEl.addEventListener('click', async (ev) => {
            const btn = ev.target.closest('button[data-act]');
            if (!btn) return;
            const rowEl = btn.closest('.qx6-re-row');
            const id = rowEl && rowEl.dataset.id;
            const rule = rulesCache.find(r => String(r[PK]) === String(id));
            if (!rule) return;

            if (btn.dataset.act === 'edit') {
                openForm(rule);
            } else if (btn.dataset.act === 'toggle') {
                const next = !(rule.isactive !== false);
                try {
                    showStatus(t('更新中…', 'Updating…'), 'info');
                    await api.patch(`${TABLE}?${PK}=eq.${encodeURIComponent(rule[PK])}`, { isactive: next });
                    await loadRules();
                    showStatus(t('已更新', 'Updated'), 'success');
                } catch (e) {
                    console.error(e);
                    showStatus(t('更新失败：', 'Update failed: ') + (e.message || e), 'error');
                }
            } else if (btn.dataset.act === 'del') {
                if (!confirm(t('确认删除该规则？', 'Delete this rule?'))) return;
                try {
                    showStatus(t('删除中…', 'Deleting…'), 'info');
                    await api.del(`${TABLE}?${PK}=eq.${encodeURIComponent(rule[PK])}`);
                    await loadRules();
                    showStatus(t('已删除', 'Deleted'), 'success');
                } catch (e) {
                    console.error(e);
                    showStatus(t('删除失败：', 'Delete failed: ') + (e.message || e), 'error');
                }
            }
        });

        exportBtn.onclick = () => {
            const data = rulesCache.map(r => ({
                emotioncode: r.emotioncode,
                rulename: r.rulename,
                ruletype: r.ruletype,
                sequence: normalizeSeq(r.sequence),
                isactive: r.isactive !== false,
            }));
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `regulation_rules_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(a.href);
        };

        importInp.onchange = async (ev) => {
            const file = ev.target.files && ev.target.files[0];
            ev.target.value = '';
            if (!file) return;
            let arr;
            try {
                arr = JSON.parse(await file.text());
                if (!Array.isArray(arr)) throw new Error('root must be array');
            } catch (e) {
                showStatus(t('导入失败：JSON 格式错误', 'Import failed: bad JSON'), 'error');
                return;
            }
            if (!confirm(t(`将导入 ${arr.length} 条规则（按情绪覆盖），继续？`,
                            `Import ${arr.length} rules (overwrite by emotion). Continue?`))) return;

            let ok = 0, fail = 0;
            for (const item of arr) {
                const emoCode = parseInt(item && item.emotioncode, 10);
                if (isNaN(emoCode)) { fail++; continue; }
                const seq = normalizeSeq(item.sequence);
                const exist = rulesCache.find(r => Number(r.emotioncode) === emoCode);
                const body = {
                    emotioncode: emoCode,
                    rulename: item.rulename || '',
                    ruletype: item.ruletype || 'system',
                    sequence: seqToDb(seq),
                    isactive: item.isactive !== false,
                };
                try {
                    if (exist) {
                        await api.patch(`${TABLE}?${PK}=eq.${encodeURIComponent(exist[PK])}`, body);
                    } else {
                        const uid = U.getUserId();
                        if (uid && /^[0-9a-f-]{36}$/i.test(String(uid))) body.createdby = uid;
                        body.createdbyname = U.getUserName() || '';
                        if (NEED_CLIENT_UUID && crypto.randomUUID) body[PK] = crypto.randomUUID();
                        await api.post(TABLE, body);
                    }
                    ok++;
                } catch (_) { fail++; }
            }
            await loadRules();
            showStatus(t(`导入完成：成功 ${ok}，失败 ${fail}`, `Imported: ${ok} ok, ${fail} failed`), 'success');
        };

        loadRules();
    }

    window.qx6Register('rule_edit', render);
})();