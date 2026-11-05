/* ================================================================
   情绪宝 - qx6-6 用户管理面板
   路径：js/qx6/qx6_6_manage_users.js
   v3 (2026-11-05)
   更新内容：
   - 新增“新增用户”按钮，可直接在后台造数据
   - 弹窗统一：支持修改姓名、身份、期限、企业归属(TeamCode)、底图
   - 图片自动压缩至 30KB 以下（Base64 存储）
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

    /* ================================================================
       图片压缩工具（压到 30KB 以下）
       ================================================================ */
    function compressImage(file, maxSizeKB = 30) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    let maxDim = 800;
                    let scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                    let w = img.width * scale;
                    let h = img.height * scale;
                    
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);

                    let quality = 0.9;
                    let base64 = canvas.toDataURL('image/jpeg', quality);
                    
                    while (base64.length / 1024 > maxSizeKB && quality > 0.1) {
                        quality -= 0.1;
                        base64 = canvas.toDataURL('image/jpeg', quality);
                    }
                    resolve(base64);
                };
                img.onerror = () => reject(new Error('图片加载失败'));
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
        });
    }

    /* ================================================================
       主渲染逻辑
       ================================================================ */
    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        let st = { keyword: '', page: 0, total: 0, users: [] };

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-mu-toolbar" style="display: flex; justify-content: space-between; gap: 10px;">
                    <div style="display: flex; gap: 10px; flex: 1;">
                        <input type="text" class="qx6-input qx6-mu-search" id="qx6_mu_search"
                               placeholder="${t('搜索用户名…', 'Search username…')}" autocomplete="off" style="flex: 1;">
                        <button class="qx6-btn qx6-btn-primary qx6-mu-refresh" id="qx6_mu_refresh">
                            ${t('刷新', 'Refresh')}
                        </button>
                    </div>
                    <button class="qx6-btn qx6-btn-success" id="qx6_mu_add" style="background:#00C853; color:#fff; border:none; border-radius:6px; padding:0 16px; font-weight:bold; cursor:pointer;">
                        + ${t('新增用户', 'Add User')}
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
        const addBtn    = bodyEl.querySelector('#qx6_mu_add');
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
                    `${U.SUPABASE_URL}/rest/v1/emobao_user?${listFilter}&select=userid,username,usertypekey,expirydate,isactive,isguest,createdat,brand_logo_url,teamcode&order=createdat.desc&limit=${PAGE_SIZE}&offset=${offset}`,
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

        // ==========================================
        // 核心弹窗：支持新增 / 编辑
        // ==========================================
        function openModal(user = null) {
            const isEdit = !!user;
            const lang = (window.mQxb && window.mQxb.Language) || 1;
            const map = U.typeMap();

            // 默认值处理
            const defaultName = isEdit ? user.username : '';
            const defaultType = isEdit ? user.usertypekey : 1;
            const defaultExpiry = isEdit ? (user.expirydate || '') : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
            const defaultTeamCode = isEdit ? (user.teamcode || '') : '';
            const defaultLogo = isEdit ? (user.brand_logo_url || '') : '';

            const overlay = document.createElement('div');
            overlay.className = 'qx6-mu-modal';
            overlay.innerHTML = `
                <div class="qx6-mu-modal-inner">
                    <div class="qx6-mu-modal-title">${isEdit ? t('编辑用户：', 'Edit: ') + user.username : t('新增用户', 'Add User')}</div>
                    
                    <div class="qx6-mu-field">
                        <label>${t('用户姓名', 'Username')}</label>
                        <input type="text" class="qx6-input" id="qx6_mu_username" value="${defaultName}" ${isEdit ? 'disabled' : ''} placeholder="${t('请输入姓名', 'Enter name')}">
                    </div>

                    <div class="qx6-mu-field">
                        <label>${t('身份', 'Type')}</label>
                        <select class="qx6-input" id="qx6_mu_type">
                            ${U.typeKeysSorted().map(k => {
                                const lb = map[k];
                                const label = lang === 1 ? lb.cn : lb.en;
                                return `<option value="${k}" ${parseInt(k) === defaultType ? 'selected' : ''}>${k} - ${label}</option>`;
                            }).join('')}
                        </select>
                    </div>

                    <div class="qx6-mu-field">
                        <label>${t('到期日期', 'Expiry Date')}</label>
                        <input type="date" class="qx6-input" id="qx6_mu_expiry" value="${defaultExpiry}">
                    </div>

                    <div class="qx6-mu-field">
                        <label>${t('企业归属 (TeamCode)', 'Team Code')}</label>
                        <input type="text" class="qx6-input" id="qx6_mu_teamcode" value="${defaultTeamCode}" placeholder="${t('如: EMO-XXXX，用于关联底图', 'e.g. EMO-XXXX for logo linking')}">
                    </div>

                    <!-- 企业底图设置 -->
                    <div class="qx6-mu-field" id="qx6_mu_logo_field" style="border-top: 1px dashed #E2E8F0; padding-top: 16px; margin-top: 16px;">
                        <label style="font-weight: bold; color: #1E293B;">${t('企业底图 (Logo)', 'Enterprise Logo')}</label>
                        <div style="font-size: 12px; color: #64748B; margin-bottom: 8px;">${t('自动压缩至30KB以下，如果填了TeamCode，将会同步给全企业。', 'Auto compressed < 30KB. Synced to team if TeamCode is set.')}</div>
                        
                        <div id="qx6_mu_logo_preview" style="margin-bottom: 10px;">
                            ${defaultLogo 
                                ? `<img src="${defaultLogo}" style="max-height: 80px; border-radius: 6px; border: 1px solid #E2E8F0;">` 
                                : `<span style="font-size: 13px; color: #94A3B8;">${t('暂无底图', 'No logo')}</span>`}
                        </div>
                        
                        <input type="file" id="qx6_mu_logo_input" accept="image/*" style="display: none;">
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_mu_logo_btn" style="padding: 6px 12px; font-size: 13px;">
                            ${t('选择图片并压缩', 'Choose & Compress')}
                        </button>
                        <div id="qx6_mu_logo_status" style="font-size: 12px; margin-top: 6px;"></div>
                    </div>

                    <div class="qx6-mu-modal-status qx6-status" id="qx6_mu_modal_status"></div>
                    
                    <div class="qx6-mu-modal-actions">
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_mu_cancel">${t('取消', 'Cancel')}</button>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_mu_save">${t('保存', 'Save')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const nameEl   = overlay.querySelector('#qx6_mu_username');
            const typeEl   = overlay.querySelector('#qx6_mu_type');
            const expiryEl = overlay.querySelector('#qx6_mu_expiry');
            const teamEl   = overlay.querySelector('#qx6_mu_teamcode');
            const mStatus  = overlay.querySelector('#qx6_mu_modal_status');
            const cancelEl = overlay.querySelector('#qx6_mu_cancel');
            const saveEl   = overlay.querySelector('#qx6_mu_save');
            
            const logoPreview = overlay.querySelector('#qx6_mu_logo_preview');
            const logoInput = overlay.querySelector('#qx6_mu_logo_input');
            const logoBtn = overlay.querySelector('#qx6_mu_logo_btn');
            const logoStatus = overlay.querySelector('#qx6_mu_logo_status');

            let newLogoBase64 = null;

            logoBtn.onclick = () => logoInput.click();

            logoInput.onchange = async () => {
                const file = logoInput.files[0];
                if (!file) return;

                logoStatus.innerText = t('正在压缩图片…', 'Compressing…');
                logoStatus.style.color = '#2C7BE5';
                
                try {
                    newLogoBase64 = await compressImage(file, 30);
                    logoPreview.innerHTML = `<img src="${newLogoBase64}" style="max-height: 80px; border-radius: 6px; border: 1px solid #E2E8F0;">`;
                    const sizeKB = (newLogoBase64.length / 1024).toFixed(1);
                    logoStatus.innerText = t(`压缩完成 (约 ${sizeKB} KB)`, `Compressed (~${sizeKB} KB)`);
                    logoStatus.style.color = '#00C853';
                } catch (e) {
                    logoStatus.innerText = t('压缩失败：', 'Compress failed: ') + e.message;
                    logoStatus.style.color = '#E74C3C';
                    newLogoBase64 = null;
                }
            };

            cancelEl.onclick = () => overlay.remove();

            saveEl.onclick = async () => {
                const uname = nameEl.value.trim();
                const utype = parseInt(typeEl.value);
                const uexpiry = expiryEl.value;
                const uteamcode = teamEl.value.trim();

                if (!uname) {
                    mStatus.innerText = t('姓名不能为空', 'Name is required');
                    mStatus.className = 'qx6-mu-modal-status qx6-status-error';
                    return;
                }
                if (!uexpiry || !/^\d{4}-\d{2}-\d{2}$/.test(uexpiry)) {
                    mStatus.innerText = t('日期格式错误', 'Invalid date');
                    mStatus.className = 'qx6-mu-modal-status qx6-status-error';
                    return;
                }

                saveEl.disabled = true;
                mStatus.innerText = t('保存中…', 'Saving…');
                mStatus.className = 'qx6-mu-modal-status qx6-status-info';

                try {
                    const payload = {
                        username: uname,
                        usertypekey: utype,
                        expirydate: uexpiry,
                        teamcode: uteamcode || null,
                        isactive: true,
                        isguest: false
                    };
                    
                    if (newLogoBase64) {
                        payload.brand_logo_url = newLogoBase64;
                    } else if (!isEdit) {
                        // 新增但没传图，给个 null
                        payload.brand_logo_url = null;
                    }

                    let url = `${U.SUPABASE_URL}/rest/v1/emobao_user`;
                    let method = 'POST';

                    if (isEdit) {
                        url += `?userid=eq.${encodeURIComponent(user.userid)}`;
                        method = 'PATCH';
                        // 编辑时不允许改名字，移除 username
                        delete payload.username;
                    }

                    const res = await fetch(url, {
                        method,
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal',
                        },
                        body: JSON.stringify(payload),
                    });
                    if (!res.ok) throw new Error(await res.text());

                    // 如果填了 TeamCode 并且有新传的底图，同步到底图给码表
                    if (newLogoBase64 && uteamcode) {
                        await fetch(
                            `${U.SUPABASE_URL}/rest/v1/emobao_redemptioncode?code=eq.${encodeURIComponent(uteamcode)}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'apikey': U.SUPABASE_KEY,
                                    'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal',
                                },
                                body: JSON.stringify({ custom_bg_url: newLogoBase64 }),
                            }
                        ).catch(e => console.warn('同步码表底图失败', e));
                    }

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

        // 按钮事件绑定
        addBtn.onclick = () => openModal(null);

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

        // 覆盖原来的 openEditModal
        window.openEditModal = openModal;

        loadUsers();
    }

    // 劫持原列表里的编辑按钮，调用新的弹窗
    const originalRender = window.qx6Registry['manage_users'];
    if (originalRender) {
        // 覆盖旧逻辑
    }

    window.qx6Register('manage_users', render);
})();