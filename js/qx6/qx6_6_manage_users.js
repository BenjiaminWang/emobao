/* ================================================================
   情绪宝 - qx6-6 用户管理面板
   路径：js/qx6/qx6_6_manage_users.js
   日期：2026-10-13
   说明：
   - 仅系统管理员可访问
   - 搜索 / 分页列出用户
   - 编辑弹窗：改身份 + 改期限 / 延长天数
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_6_manage_users] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    const PAGE_SIZE = 50;

    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        let st = { keyword: '', page: 0, total: 0, users: [] };

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-mu-toolbar">
                    <input type="text" class="qx6-input qx6-mu-search" id="qx6_mu_search"
                           placeholder="${t('搜索用户名…', 'Search username…')}" autocomplete="off">
                    <button class="qx6-btn qx6-btn-primary qx6-mu-refresh" id="qx6_mu_refresh">
                        ${t('刷新', 'Refresh')}
                    </button>
                </div>
                <div class="qx6-mu-status qx6-status" id="qx6_mu_status"></div>
                <div class="qx6-mu-list" id="qx6_mu_list">
                    <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                </div>
                <div class="qx6-mu-pager" id="qx6_mu_pager"></div>
            </div>
        `;

        const searchEl  = bodyEl.querySelector('#qx6_mu_search');
        const refreshEl = bodyEl.querySelector('#qx6_mu_refresh');
        const statusEl  = bodyEl.querySelector('#qx6_mu_status');
        const listEl    = bodyEl.querySelector('#qx6_mu_list');
        const pagerEl   = bodyEl.querySelector('#qx6_mu_pager');

        function showStatus(text, type) {
            statusEl.innerText = text || '';
            statusEl.className = 'qx6-mu-status' + (text ? ' qx6-status-' + type : '');
        }

        async function loadUsers() {
            showStatus(t('加载中…', 'Loading…'), 'info');
            listEl.innerHTML = `<div class="qx6-empty">${t('加载中…', 'Loading…')}</div>`;

            try {
                const countFilter = st.keyword
                    ? `username=ilike.*${encodeURIComponent(st.keyword)}*`
                    : `userid=not.is.null`;
                const countRes = await fetch(
                    `${U.SUPABASE_URL}/rest/v1/emobao_user?${countFilter}&select=userid`,
                    {
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                            'Prefer': 'count=exact',
                            'Range-Unit': 'items',
                            'Range': '0-0',
                        },
                    }
                );
                const contentRange = countRes.headers.get('content-range') || '';
                st.total = parseInt((contentRange.split('/')[1] || '0'), 10);

                const offset = st.page * PAGE_SIZE;
                const listFilter = st.keyword
                    ? `username=ilike.*${encodeURIComponent(st.keyword)}*`
                    : `userid=not.is.null`;
                const listRes = await fetch(
                    `${U.SUPABASE_URL}/rest/v1/emobao_user?${listFilter}&select=userid,username,usertypekey,expirydate,isactive,isguest,createdat&order=createdat.desc&limit=${PAGE_SIZE}&offset=${offset}`,
                    {
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                        },
                    }
                );
                st.users = (await listRes.json()) || [];
                showStatus('', '');
                renderList();
                renderPager();
            } catch (e) {
                console.error(e);
                showStatus(t('加载失败', 'Load failed'), 'error');
                listEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
            }
        }

        function renderList() {
            if (!st.users.length) {
                listEl.innerHTML = `<div class="qx6-empty">${t('无用户', 'No users')}</div>`;
                return;
            }
            listEl.innerHTML = '';
            st.users.forEach(u => {
                const row = document.createElement('div');
                row.className = 'qx6-mu-row';

                const nameEl = document.createElement('div');
                nameEl.className = 'qx6-mu-name';
                nameEl.innerText = u.username + (u.isguest ? ' 👤' : '');

                const typeEl = document.createElement('div');
                typeEl.className = 'qx6-mu-type';
                typeEl.innerText = U.typeLabel(u.usertypekey);

                const expiryEl = document.createElement('div');
                expiryEl.className = 'qx6-mu-expiry';
                expiryEl.innerText = u.expirydate || '—';

                const btnEl = document.createElement('button');
                btnEl.className = 'qx6-mu-edit';
                btnEl.innerText = t('编辑', 'Edit');
                btnEl.onclick = () => openEditModal(u);

                row.appendChild(nameEl);
                row.appendChild(typeEl);
                row.appendChild(expiryEl);
                row.appendChild(btnEl);
                listEl.appendChild(row);
            });
        }

        function renderPager() {
            const totalPages = Math.max(1, Math.ceil(st.total / PAGE_SIZE));
            const cur = st.page + 1;
            pagerEl.innerHTML = '';

            const prevBtn = document.createElement('button');
            prevBtn.className = 'qx6-mu-pager-btn';
            prevBtn.innerText = '‹';
            prevBtn.disabled = st.page === 0;
            prevBtn.onclick = () => { st.page--; loadUsers(); };

            const info = document.createElement('span');
            info.className = 'qx6-mu-pager-info';
            info.innerText = `${cur} / ${totalPages}`;

            const nextBtn = document.createElement('button');
            nextBtn.className = 'qx6-mu-pager-btn';
            nextBtn.innerText = '›';
            nextBtn.disabled = cur >= totalPages;
            nextBtn.onclick = () => { st.page++; loadUsers(); };

            pagerEl.appendChild(prevBtn);
            pagerEl.appendChild(info);
            pagerEl.appendChild(nextBtn);
        }

        function openEditModal(user) {
            const lang = (window.mQxb && window.mQxb.Language) || 1;
            const map = U.typeMap();

            const overlay = document.createElement('div');
            overlay.className = 'qx6-mu-modal';
            overlay.innerHTML = `
                <div class="qx6-mu-modal-inner">
                    <div class="qx6-mu-modal-title">${t('编辑用户', 'Edit User')}：${user.username}</div>
                    <div class="qx6-mu-field">
                        <label>${t('当前身份', 'Current Type')}</label>
                        <div class="qx6-mu-readonly">${U.typeLabel(user.usertypekey)}</div>
                    </div>
                    <div class="qx6-mu-field">
                        <label>${t('新身份', 'New Type')}</label>
                        <select class="qx6-input" id="qx6_mu_new_type">
                            ${U.typeKeysSorted().map(k => {
                                const lb = map[k];
                                const label = lang === 1 ? lb.cn : lb.en;
                                return `<option value="${k}" ${parseInt(k) === user.usertypekey ? 'selected' : ''}>${k} - ${label}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="qx6-mu-field">
                        <label>${t('当前期限', 'Current Expiry')}</label>
                        <div class="qx6-mu-readonly">${user.expirydate || '—'}</div>
                    </div>
                    <div class="qx6-mu-field">
                        <label>${t('新期限', 'New Expiry')}</label>
                        <input type="date" class="qx6-input" id="qx6_mu_new_expiry" value="${user.expirydate || ''}">
                    </div>
                    <div class="qx6-mu-field">
                        <label>${t('或：延长天数', 'Or: extend days')}</label>
                        <input type="number" class="qx6-input" id="qx6_mu_extend_days"
                               placeholder="${t('如 3650', 'e.g. 3650')}" min="1">
                    </div>
                    <div class="qx6-mu-modal-status qx6-status" id="qx6_mu_modal_status"></div>
                    <div class="qx6-mu-modal-actions">
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_mu_cancel">${t('取消', 'Cancel')}</button>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_mu_save">${t('保存', 'Save')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const typeEl   = overlay.querySelector('#qx6_mu_new_type');
            const expiryEl = overlay.querySelector('#qx6_mu_new_expiry');
            const extendEl = overlay.querySelector('#qx6_mu_extend_days');
            const mStatus  = overlay.querySelector('#qx6_mu_modal_status');
            const cancelEl = overlay.querySelector('#qx6_mu_cancel');
            const saveEl   = overlay.querySelector('#qx6_mu_save');

            extendEl.addEventListener('input', () => {
                const days = parseInt(extendEl.value);
                if (!days || days < 1) return;
                const base = new Date();
                base.setDate(base.getDate() + days);
                expiryEl.value = base.toISOString().slice(0, 10);
            });

            cancelEl.onclick = () => overlay.remove();

            saveEl.onclick = async () => {
                const newType = parseInt(typeEl.value);
                const newExpiry = expiryEl.value;

                if (!newType || !map[newType]) {
                    mStatus.innerText = t('身份无效', 'Invalid type');
                    mStatus.className = 'qx6-mu-modal-status qx6-status-error';
                    return;
                }
                if (!newExpiry || !/^\d{4}-\d{2}-\d{2}$/.test(newExpiry)) {
                    mStatus.innerText = t('日期格式错误', 'Invalid date');
                    mStatus.className = 'qx6-mu-modal-status qx6-status-error';
                    return;
                }

                saveEl.disabled = true;
                mStatus.innerText = t('保存中…', 'Saving…');
                mStatus.className = 'qx6-mu-modal-status qx6-status-info';

                try {
                    const res = await fetch(
                        `${U.SUPABASE_URL}/rest/v1/emobao_user?userid=eq.${encodeURIComponent(user.userid)}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'apikey': U.SUPABASE_KEY,
                                'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal',
                            },
                            body: JSON.stringify({
                                usertypekey: newType,
                                expirydate: newExpiry,
                                updatedat: new Date().toISOString(),
                            }),
                        }
                    );
                    if (!res.ok) throw new Error(await res.text());

                    mStatus.innerText = t('已保存', 'Saved');
                    mStatus.className = 'qx6-mu-modal-status qx6-status-success';

                    setTimeout(() => { overlay.remove(); loadUsers(); }, 600);
                } catch (e) {
                    mStatus.innerText = t('保存失败：', 'Save failed: ') + e.message;
                    mStatus.className = 'qx6-mu-modal-status qx6-status-error';
                    saveEl.disabled = false;
                }
            };
        }

        let searchTimer = null;
        searchEl.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                st.keyword = searchEl.value.trim();
                st.page = 0;
                loadUsers();
            }, 300);
        });

        refreshEl.onclick = () => {
            st.keyword = searchEl.value.trim();
            st.page = 0;
            loadUsers();
        };

        loadUsers();
    }

    window.qx6Register('manage_users', render);
})();