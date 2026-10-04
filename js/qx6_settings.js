/* ================================================================
   情绪宝 - qx6 设置（v5 完整版）
   日期：2026-09-30
   改动：
   - music_lib 音乐库管理完整实现
     · 两层树形（12 大类 + 曲目，可折叠）
     · 试听 / 改名 / 删除（三次确认）/ 增加
     · 补齐时长按钮（批量 UPDATE）
     · 上传 R2 函数占位（待 Worker 部署）
   - 其余同 v4
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://lmmnwmueppkdbzvufxar.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';
    const PASSWORD_SALT = 'emobao_salt_2026';

    /* 上传 Worker 地址（待 R2 部署后填写） */
    const UPLOAD_WORKER_URL = '';  // 例：'https://api.emobao.com/upload'

    /* ================================================================
       身份简称映射（对齐 emobao_usertype 库）
       ================================================================ */
    const TYPE_LABEL = {
        1:  { cn: '普通',    en: 'Normal' },
        2:  { cn: 'VIP',     en: 'VIP' },
        3:  { cn: 'VIP',     en: 'VIP' },
        4:  { cn: 'VIP',     en: 'VIP' },
        5:  { cn: 'VIP',     en: 'VIP' },
        6:  { cn: '家庭',    en: 'Family' },
        7:  { cn: '辅导员',  en: 'Counselor' },
        8:  { cn: '音乐管理', en: 'Music Admin' },
        9:  { cn: '系统管理', en: 'System Admin' },
        10: { cn: '财务',    en: 'Finance' },
        11: { cn: '企业',    en: 'Enterprise' },
        12: { cn: '学生',    en: 'Student' },
        13: { cn: '待用身份', en: 'Reserved' },
        14: { cn: '访客',    en: 'Guest' },
    };

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getUserId()   { return (window.mQxb && window.mQxb.user_id) || null; }
    function getUserName() { return (window.mQxb && window.mQxb.Username) || ''; }
    function getExpiry()   { return (window.mQxb && window.mQxb.ExpiryDate) || ''; }
    function isGuest()     { return getUserType() === 14; }
    function isAdmin()     { return getUserType() === 9; }
    function isMusician()  { return getUserType() === 8; }
    function isFinance()   { return getUserType() === 10; }

    async function hashPassword(plain) {
        const buf = new TextEncoder().encode(plain + PASSWORD_SALT);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function restGet(path) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST GET ${path}: ${res.status} ${txt}`);
        }
        return res.json();
    }
    async function rpc(fnName, params) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify(params),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`RPC ${fnName}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    /* ============ 通用工具 ============ */
    function formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    function formatSize(bytes) {
        if (!bytes) return '--';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
        return `${(bytes/1024/1024).toFixed(1)} MB`;
    }
    function readAudioDuration(url) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.preload = 'metadata';
            audio.src = url;
            const timer = setTimeout(() => {
                audio.src = '';
                resolve(null);
            }, 15000);
            audio.addEventListener('loadedmetadata', () => {
                clearTimeout(timer);
                const d = Math.round(audio.duration);
                audio.src = '';
                resolve(isFinite(d) && d > 0 ? d : null);
            });
            audio.addEventListener('error', () => {
                clearTimeout(timer);
                audio.src = '';
                resolve(null);
            });
        });
    }
    async function fetchFileSize(url) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (!res.ok) return null;
            const cl = res.headers.get('content-length');
            return cl ? parseInt(cl) : null;
        } catch (e) {
            return null;
        }
    }

    /* ============ 菜单定义 ============ */
    function buildMenuConfig() {
        const ut = getUserType();
        const sections = [];

        const accountItems = [
            { id: 'account',  icon: '👤', cn: '账户',     en: 'Account' },
        ];
        if (!isGuest()) {
            accountItems.push({ id: 'password', icon: '🔑', cn: '修改口令', en: 'Change Password' });
        }
        accountItems.push({ id: 'device', icon: '📱', cn: '设备管理', en: 'Devices' });
        sections.push({ title: '', items: accountItems });

        if (isAdmin()) {
            sections.push({
                title: { cn: '管理', en: 'Admin' },
                items: [
                    { id: 'stats_users',   icon: '📊', cn: '用户总体情况',   en: 'User Overview' },
                    { id: 'redeem',        icon: '🎫', cn: '兑换码管理',     en: 'Redeem Codes' },
                    { id: 'manage_users',  icon: '👥', cn: '用户管理',       en: 'Manage Users' },
                    { id: 'qa_engine',     icon: '💬', cn: '问答/推送管理',  en: 'Q&A / Engine' },
                ],
            });
        }

        if (isAdmin() || isMusician()) {
            const contentItems = [
                { id: 'music_lib', icon: '🎵', cn: '音乐库管理', en: 'Music Library' },
            ];
            if (isAdmin()) {
                contentItems.push({ id: 'rule_edit', icon: '🎼', cn: '组曲规则', en: 'Playlist Rules' });
            }
            sections.push({
                title: { cn: '内容', en: 'Content' },
                items: contentItems,
            });
        }

        if (isAdmin() || isFinance()) {
            sections.push({
                title: { cn: '财务', en: 'Finance' },
                items: [
                    { id: 'finance', icon: '💰', cn: '财务管理', en: 'Finance' },
                ],
            });
        }

        sections.push({
            title: '',
            danger: true,
            items: [
                { id: 'sys_exit', icon: '🚪', cn: '退出情绪宝', en: 'Exit Emo Treasure' },
            ],
        });

        return sections;
    }

    let state = {
        initialized: false,
        currentPanel: null,
        oldVerified: false,
    };

    function getEl(id) { return document.getElementById(id); }

    /* ============ 渲染菜单 ============ */
    function renderMenu() {
        const root = getEl('qx6_menu');
        if (!root) return;
        root.innerHTML = '';

        const sections = buildMenuConfig();

        sections.forEach(section => {
            const secEl = document.createElement('div');
            secEl.className = 'qx6-menu-section';
            if (section.danger) secEl.classList.add('qx6-menu-section-danger');

            if (section.title && (section.title.cn || section.title.en)) {
                const titleEl = document.createElement('div');
                titleEl.className = 'qx6-menu-section-title';
                titleEl.innerText = t(section.title.cn, section.title.en);
                secEl.appendChild(titleEl);
            }

            const rowsEl = document.createElement('div');
            rowsEl.className = 'qx6-menu-rows';

            section.items.forEach(item => {
                const row = document.createElement('button');
                row.className = 'qx6-menu-row';
                row.dataset.menuId = item.id;

                const iconEl = document.createElement('span');
                iconEl.className = 'qx6-menu-icon';
                iconEl.innerText = item.icon;

                const labelEl = document.createElement('span');
                labelEl.className = 'qx6-menu-label';
                labelEl.innerText = t(item.cn, item.en);

                const arrowEl = document.createElement('span');
                arrowEl.className = 'qx6-menu-arrow';
                arrowEl.innerText = '›';

                row.appendChild(iconEl);
                row.appendChild(labelEl);
                row.appendChild(arrowEl);

                row.onclick = () => openPanel(item.id);
                rowsEl.appendChild(row);
            });

            secEl.appendChild(rowsEl);
            root.appendChild(secEl);
        });
    }

    /* ============ 打开二级页面 ============ */
    function openPanel(panelId) {
        state.currentPanel = panelId;

        const listView = getEl('qx6_list_view');
        const panelView = getEl('qx6_panel_view');
        if (listView) listView.style.display = 'none';
        if (panelView) panelView.style.display = 'flex';

        const titleEl = getEl('qx6_panel_title');
        const bodyEl = getEl('qx6_panel_body');

        const map = {
            account:      { cn: '账户',       en: 'Account' },
            password:     { cn: '修改口令',   en: 'Change Password' },
            device:       { cn: '设备管理',   en: 'Devices' },
            stats_users:  { cn: '用户总体情况', en: 'User Overview' },
            redeem:       { cn: '兑换码管理', en: 'Redeem Codes' },
            manage_users: { cn: '用户管理',   en: 'User Management' },
            qa_engine:    { cn: '问答/推送管理', en: 'Q&A / Engine' },
            music_lib:    { cn: '音乐库管理', en: 'Music Library' },
            rule_edit:    { cn: '组曲规则',   en: 'Playlist Rules' },
            finance:      { cn: '财务管理',   en: 'Finance' },
            sys_exit:     { cn: '退出情绪宝', en: 'Exit' },
        };
        const info = map[panelId] || { cn: '功能', en: 'Feature' };
        if (titleEl) titleEl.innerText = t(info.cn, info.en);

        if (bodyEl) {
            bodyEl.innerHTML = '';
            const renderFn = PANEL_RENDERERS[panelId];
            if (typeof renderFn === 'function') {
                renderFn(bodyEl);
            } else {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('开发中…', 'Coming soon…')}</div>`;
            }
        }
    }

    function closePanel() {
        state.currentPanel = null;
        state.oldVerified = false;

        const listView = getEl('qx6_list_view');
        const panelView = getEl('qx6_panel_view');
        if (listView) listView.style.display = 'flex';
        if (panelView) panelView.style.display = 'none';
    }

    /* ============ 口令强度计算 ============ */
    function calcStrength(pwd) {
        if (!pwd || pwd.length < 8) return 0;
        const weakList = [
            '11111111','22222222','33333333','44444444','55555555',
            '66666666','77777777','88888888','99999999','00000000',
            '12345678','123456789','87654321','abcdefgh','aaaaaaaa',
            'qwertyui','password','passw0rd','iloveyou'
        ];
        if (weakList.includes(pwd)) return 0;
        let types = 0;
        if (/[a-z]/.test(pwd)) types++;
        if (/[A-Z]/.test(pwd)) types++;
        if (/[0-9]/.test(pwd)) types++;
        if (/[^a-zA-Z0-9]/.test(pwd)) types++;
        if (types <= 1) return 1;
        if (types === 2) return 2;
        if (types === 3) return 3;
        return 4;
    }

    /* ============ 面板渲染器 ============ */
    const PANEL_RENDERERS = {

        /* ---- 功能 1：查看账户 ---- */
        account: function (bodyEl) {
            const ut = getUserType();
            const lang = (window.mQxb && window.mQxb.Language) || 1;

            let uname, typeLabel, expiry;
            if (isGuest()) {
                const d = new Date();
                const dateStr = d.getFullYear() + '-' +
                    String(d.getMonth() + 1).padStart(2, '0') + '-' +
                    String(d.getDate()).padStart(2, '0');
                uname = t('访客', 'Guest');
                typeLabel = t('访客', 'Guest');
                expiry = dateStr;
            } else {
                uname = getUserName() || '—';
                const lb = TYPE_LABEL[ut] || TYPE_LABEL[1];
                typeLabel = lang === 1 ? lb.cn : lb.en;
                expiry = getExpiry() || '—';
            }

            bodyEl.innerHTML = `
                <div class="qx6-card">
                    <div class="qx6-info-row">
                        <div class="qx6-info-label">${t('用户名', 'Username')}</div>
                        <div class="qx6-info-value">${uname}</div>
                    </div>
                    <div class="qx6-info-row">
                        <div class="qx6-info-label">${t('身份', 'Type')}</div>
                        <div class="qx6-info-value">${typeLabel}</div>
                    </div>
                    <div class="qx6-info-row">
                        <div class="qx6-info-label">${t('使用期限', 'Expiry')}</div>
                        <div class="qx6-info-value">${expiry}</div>
                    </div>
                </div>

                <div class="qx6-card">
                    <div class="qx6-card-title">${t('中英文设置', 'Language')}</div>
                    <div class="qx6-lang-row">
                        <button class="qx6-lang-btn ${lang === 1 ? 'active' : ''}" data-lang="1">中文</button>
                        <button class="qx6-lang-btn ${lang === 2 ? 'active' : ''}" data-lang="2">English</button>
                    </div>
                </div>

                ${(!isGuest() && !(ut >= 2 && ut <= 5)) ? `
                <div class="qx6-card">
                    <div class="qx6-card-title">${t('购买订阅', 'Subscribe')}</div>
                    <div class="qx6-buy-desc">${t('成为 VIP，解锁完整功能。', 'Become VIP to unlock full features.')}</div>
                    <button class="qx6-btn qx6-btn-primary" id="qx6_btn_buy">${t('了解订阅', 'Learn more')}</button>
                </div>` : ''}
            `;

            bodyEl.querySelectorAll('.qx6-lang-btn').forEach(btn => {
                btn.onclick = () => {
                    const langNum = parseInt(btn.dataset.lang);
                    if (langNum !== 1 && langNum !== 2) return;
                    if (langNum === ((window.mQxb && window.mQxb.Language) || 1)) return;

                    window.mQxb.Language = langNum;
                    localStorage.setItem('emobao_lang', String(langNum));

                    if (typeof window.applyAllI18n === 'function') {
                        try { window.applyAllI18n(); } catch (e) {}
                    }
                    renderMenu();
                    const titleEl = getEl('qx6_panel_title');
                    if (titleEl) titleEl.innerText = t('账户', 'Account');
                    PANEL_RENDERERS.account(bodyEl);
                };
            });

            const buyBtn = bodyEl.querySelector('#qx6_btn_buy');
            if (buyBtn) {
                buyBtn.onclick = () => {
                    if (typeof window.showToast === 'function') {
                        window.showToast(t('订阅功能即将上线', 'Subscription coming soon'), 'info');
                    }
                };
            }
        },

        /* ---- 功能 2：修改口令 ---- */
        password: function (bodyEl) {
            if (isGuest()) {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('访客不能修改口令。', 'Guest cannot change password.')}</div>`;
                return;
            }

            state.oldVerified = false;

            bodyEl.innerHTML = `
                <div class="qx6-card">
                    <div class="qx6-card-title">${t('输入旧口令', 'Old Password')}</div>
                    <div class="qx6-pwd-wrap">
                        <input type="password" class="qx6-input" id="qx6_old_pwd"
                               placeholder="${t('旧口令', 'Old password')}" autocomplete="off">
                        <button class="qx6-eye" id="qx6_eye_old" type="button">
                            <span class="eye-open">👁️</span>
                            <span class="eye-closed" style="display:none;">🙈</span>
                        </button>
                    </div>
                    <div class="qx6-status" id="qx6_old_status"></div>
                </div>

                <div class="qx6-card" id="qx6_new_card" style="display:none;">
                    <div class="qx6-card-title">${t('设置新口令', 'New Password')}</div>
                    <div class="qx6-pwd-wrap">
                        <input type="password" class="qx6-input" id="qx6_new_pwd"
                               placeholder="${t('新口令（8 位以上）', 'New password (8+ chars)')}" autocomplete="off">
                        <button class="qx6-eye" id="qx6_eye_new" type="button">
                            <span class="eye-open">👁️</span>
                            <span class="eye-closed" style="display:none;">🙈</span>
                        </button>
                    </div>
                    <div class="qx6-strength-bar">
                        <div class="qx6-strength-fill" id="qx6_strength_fill"></div>
                    </div>
                    <div class="qx6-strength-text" id="qx6_strength_text"></div>

                    <div class="qx6-pwd-wrap">
                        <input type="password" class="qx6-input" id="qx6_new_pwd_confirm"
                               placeholder="${t('再次输入新口令', 'Confirm new password')}" autocomplete="off">
                        <button class="qx6-eye" id="qx6_eye_confirm" type="button">
                            <span class="eye-open">👁️</span>
                            <span class="eye-closed" style="display:none;">🙈</span>
                        </button>
                    </div>
                    <div class="qx6-status" id="qx6_new_status"></div>

                    <button class="qx6-btn qx6-btn-primary" id="qx6_btn_save_pwd" disabled>${t('确认修改', 'Confirm')}</button>
                </div>
            `;

            const oldInput     = bodyEl.querySelector('#qx6_old_pwd');
            const newInput     = bodyEl.querySelector('#qx6_new_pwd');
            const confirmInput = bodyEl.querySelector('#qx6_new_pwd_confirm');
            const oldStatus    = bodyEl.querySelector('#qx6_old_status');
            const newStatus    = bodyEl.querySelector('#qx6_new_status');
            const newCard      = bodyEl.querySelector('#qx6_new_card');
            const saveBtn      = bodyEl.querySelector('#qx6_btn_save_pwd');
            const strengthFill = bodyEl.querySelector('#qx6_strength_fill');
            const strengthText = bodyEl.querySelector('#qx6_strength_text');

            function showStatus(el, text, type) {
                if (!el) return;
                el.innerText = text || '';
                el.className = 'qx6-status' + (text ? ' qx6-status-' + type : '');
            }

            function renderStrength(level) {
                const colors = ['#C8CFD8','#C8CFD8','#2C7BE5','#2ECC71','#E53935'];
                const widths = ['0%','25%','50%','75%','100%'];
                const labels = [
                    t('口令太短','Too short'),
                    t('弱','Weak'),
                    t('中','Medium'),
                    t('强','Strong'),
                    t('壮','Very Strong'),
                ];
                if (strengthFill) {
                    strengthFill.style.width = widths[level];
                    strengthFill.style.background = colors[level];
                }
                if (strengthText) {
                    strengthText.innerText = labels[level];
                    strengthText.style.color = colors[level];
                }
            }

            const bindEye = (btnId, input) => {
                const btn = bodyEl.querySelector('#' + btnId);
                if (!btn || !input) return;
                btn.onclick = () => {
                    const open = btn.querySelector('.eye-open');
                    const closed = btn.querySelector('.eye-closed');
                    if (input.type === 'password') {
                        input.type = 'text';
                        open.style.display = 'none';
                        closed.style.display = '';
                    } else {
                        input.type = 'password';
                        open.style.display = '';
                        closed.style.display = 'none';
                    }
                };
            };
            bindEye('qx6_eye_old', oldInput);
            bindEye('qx6_eye_new', newInput);
            bindEye('qx6_eye_confirm', confirmInput);

            async function verifyOld() {
                const pwd = oldInput.value;
                if (!pwd) { showStatus(oldStatus, t('请输入旧口令','Please enter old password'), 'error'); return; }
                showStatus(oldStatus, t('校验中…','Checking…'), 'info');
                try {
                    const hash = await hashPassword(pwd);
                    const uid = getUserId();
                    const rows = await restGet(`emobao_user?userid=eq.${encodeURIComponent(uid)}&passwordhash=eq.${hash}&select=userid`);
                    if (rows && rows.length === 1) {
                        state.oldVerified = true;
                        showStatus(oldStatus, t('旧口令正确','Correct'), 'success');
                        newCard.style.display = 'block';
                    } else {
                        state.oldVerified = false;
                        showStatus(oldStatus, t('旧口令错误','Wrong'), 'error');
                        newCard.style.display = 'none';
                    }
                } catch (e) {
                    console.error(e);
                    showStatus(oldStatus, t('网络错误','Network error'), 'error');
                }
                updateSaveBtn();
            }

            function updateSaveBtn() {
                const level = calcStrength(newInput.value);
                const match = newInput.value && newInput.value === confirmInput.value;
                saveBtn.disabled = !(state.oldVerified && level >= 2 && match);
            }

            newInput.addEventListener('input', () => {
                renderStrength(calcStrength(newInput.value));
                updateSaveBtn();
            });
            confirmInput.addEventListener('input', updateSaveBtn);

            oldInput.addEventListener('blur', () => { if (oldInput.value) verifyOld(); });
            oldInput.addEventListener('input', () => {
                state.oldVerified = false;
                newCard.style.display = 'none';
                updateSaveBtn();
            });

            renderStrength(0);

            saveBtn.onclick = async () => {
                if (!state.oldVerified) {
                    await verifyOld();
                    if (!state.oldVerified) return;
                }
                const pwd = newInput.value;
                const level = calcStrength(pwd);
                if (level < 2) { showStatus(newStatus, t('口令太弱','Too weak'), 'error'); return; }
                if (pwd !== confirmInput.value) { showStatus(newStatus, t('两次输入不一致','Mismatch'), 'error'); return; }
                showStatus(newStatus, t('保存中…','Saving…'), 'info');
                try {
                    const hash = await hashPassword(pwd);
                    const result = await rpc('emobao_set_password', { p_userid: getUserId(), p_passwordhash: hash });
                    const row = Array.isArray(result) ? result[0] : result;
                    if (row && row.success) {
                        showStatus(newStatus, t('口令已修改','Password changed'), 'success');
                        setTimeout(() => {
                            oldInput.value = '';
                            newInput.value = '';
                            confirmInput.value = '';
                            newCard.style.display = 'none';
                            state.oldVerified = false;
                            renderStrength(0);
                            showStatus(oldStatus, '', '');
                            showStatus(newStatus, '', '');
                        }, 1500);
                    } else {
                        showStatus(newStatus, t('修改失败：','Failed: ') + (row && row.message), 'error');
                    }
                } catch (e) {
                    console.error(e);
                    showStatus(newStatus, t('网络错误','Network error'), 'error');
                }
            };
        },

        /* ---- 功能 3：用户总体情况 ---- */
        stats_users: function (bodyEl) {
            if (!isAdmin()) {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
                return;
            }

            bodyEl.innerHTML = `
                <div class="qx6-card">
                    <div class="qx6-sg-grid" id="qx6_sg_grid">
                        <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                    </div>
                </div>
                <div class="qx6-card">
                    <div class="qx6-card-title">${t('各类用户随时间变化', 'Users over time')}</div>
                    <div class="qx6-sg-chart" id="qx6_sg_chart">
                        <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                    </div>
                </div>
            `;

            const gridEl = bodyEl.querySelector('#qx6_sg_grid');
            const chartEl = bodyEl.querySelector('#qx6_sg_chart');

            (async function () {
                try {
                    const totalRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/emobao_user?select=userid`,
                        {
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Prefer': 'count=exact',
                                'Range-Unit': 'items',
                                'Range': '0-0',
                            },
                        }
                    );
                    const totalRange = totalRes.headers.get('content-range') || '';
                    const total = parseInt((totalRange.split('/')[1] || '0'), 10);

                    const guestRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/emobao_user?isguest=eq.true&select=userid`,
                        {
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Prefer': 'count=exact',
                                'Range-Unit': 'items',
                                'Range': '0-0',
                            },
                        }
                    );
                    const guestRange = guestRes.headers.get('content-range') || '';
                    const guestCount = parseInt((guestRange.split('/')[1] || '0'), 10);

                    let activeCount = 0;
                    try {
                        const diaryRes = await fetch(
                            `${SUPABASE_URL}/rest/v1/emobao_emotiondiary?select=userid`,
                            {
                                headers: {
                                    'apikey': SUPABASE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                                },
                            }
                        );
                        const diaries = await diaryRes.json();
                        const activeSet = new Set((diaries || []).map(d => d.userid));
                        activeCount = activeSet.size;
                    } catch (e) {
                        console.warn('活跃用户统计失败:', e);
                    }

                    gridEl.innerHTML = `
                        <div class="qx6-sg-item">
                            <div class="qx6-sg-num">${total}</div>
                            <div class="qx6-sg-label">${t('用户总数', 'Total Users')}</div>
                        </div>
                        <div class="qx6-sg-item">
                            <div class="qx6-sg-num">${activeCount}</div>
                            <div class="qx6-sg-label">${t('有使用记录', 'Active Users')}</div>
                        </div>
                        <div class="qx6-sg-item">
                            <div class="qx6-sg-num">${guestCount}</div>
                            <div class="qx6-sg-label">${t('访客', 'Guests')}</div>
                        </div>
                    `;

                    const usersRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/emobao_user?select=createdat,usertypekey&order=createdat.asc&limit=5000`,
                        {
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                            },
                        }
                    );
                    const users = await usersRes.json();
                    renderTimeChart(chartEl, users || []);

                } catch (e) {
                    console.error(e);
                    gridEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
                    chartEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
                }
            })();

            function renderTimeChart(container, users) {
                if (!users.length) {
                    container.innerHTML = `<div class="qx6-empty">${t('暂无数据', 'No data')}</div>`;
                    return;
                }

                const dayMap = {};
                users.forEach(u => {
                    const d = (u.createdat || '').slice(0, 10);
                    if (!d) return;
                    dayMap[d] = (dayMap[d] || 0) + 1;
                });
                const days = Object.keys(dayMap).sort();
                if (!days.length) {
                    container.innerHTML = `<div class="qx6-empty">${t('暂无数据', 'No data')}</div>`;
                    return;
                }

                const counts = days.map(d => dayMap[d]);
                const maxCount = Math.max(...counts, 1);

                const W = 600, H = 200, PAD = 30;
                const plotW = W - PAD * 2;
                const plotH = H - PAD * 2;

                const points = days.map((d, i) => {
                    const x = PAD + (i / Math.max(1, days.length - 1)) * plotW;
                    const y = PAD + plotH - (counts[i] / maxCount) * plotH;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');

                container.innerHTML = `
                    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:200px;">
                        <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#E1E8F0" stroke-width="1"/>
                        <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H-PAD}" stroke="#E1E8F0" stroke-width="1"/>
                        <polyline points="${points}" fill="none" stroke="#2C7BE5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                        <text x="${PAD}" y="${H-8}" font-size="10" fill="#96A3B8">${days[0]}</text>
                        <text x="${W-PAD}" y="${H-8}" font-size="10" fill="#96A3B8" text-anchor="end">${days[days.length-1]}</text>
                        <text x="${PAD-4}" y="${PAD+8}" font-size="10" fill="#96A3B8" text-anchor="end">${maxCount}</text>
                    </svg>
                `;
            }
        },

        /* ---- 功能 4：兑换码管理 ---- */
        redeem: function (bodyEl) {
            if (!isAdmin()) {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
                return;
            }

            bodyEl.innerHTML = `
                <div class="qx6-rd-tabs">
                    <button class="qx6-rd-tab active" data-tab="issue">${t('发放', 'Issue')}</button>
                    <button class="qx6-rd-tab" data-tab="query">${t('查询', 'Query')}</button>
                </div>

                <div class="qx6-rd-panel" id="qx6_rd_issue_panel">
                    <div class="qx6-card">
                        <div class="qx6-rd-field">
                            <label>${t('目标身份', 'Target Type')}</label>
                            <select class="qx6-input" id="qx6_rd_type">
                                ${Object.keys(TYPE_LABEL).map(k => {
                                    const lb = TYPE_LABEL[k];
                                    return `<option value="${k}">${k} - ${lb.cn}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="qx6-rd-field">
                            <label>${t('数量', 'Count')}</label>
                            <input type="number" class="qx6-input" id="qx6_rd_count" value="1" min="1" max="100">
                        </div>
                        <div class="qx6-rd-field">
                            <label>${t('有效天数', 'Valid Days')}</label>
                            <input type="number" class="qx6-input" id="qx6_rd_days" value="365" min="1">
                        </div>
                        <div class="qx6-rd-field">
                            <label>${t('团队上限（企业/家庭）', 'Max Activations (Enterprise/Family)')}</label>
                            <input type="number" class="qx6-input" id="qx6_rd_maxact" value="1" min="1">
                        </div>
                        <div class="qx6-rd-field">
                            <label>${t('批次号', 'Batch No')}</label>
                            <input type="text" class="qx6-input" id="qx6_rd_batch" value="${'BATCH-' + new Date().toISOString().slice(0,10).replace(/-/g,'')}">
                        </div>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_rd_generate">${t('生成', 'Generate')}</button>
                        <div class="qx6-status" id="qx6_rd_issue_status"></div>
                        <div class="qx6-rd-result" id="qx6_rd_issue_result"></div>
                    </div>
                </div>

                <div class="qx6-rd-panel" id="qx6_rd_query_panel" style="display:none;">
                    <div class="qx6-card">
                        <button class="qx6-btn qx6-btn-primary" id="qx6_rd_refresh">${t('刷新批次列表', 'Refresh Batches')}</button>
                        <div class="qx6-status" id="qx6_rd_query_status"></div>
                        <div class="qx6-rd-batch-list" id="qx6_rd_batch_list"></div>
                    </div>
                </div>
            `;

            bodyEl.querySelectorAll('.qx6-rd-tab').forEach(tab => {
                tab.onclick = () => {
                    bodyEl.querySelectorAll('.qx6-rd-tab').forEach(x => x.classList.remove('active'));
                    tab.classList.add('active');
                    const which = tab.dataset.tab;
                    bodyEl.querySelector('#qx6_rd_issue_panel').style.display = which === 'issue' ? 'block' : 'none';
                    bodyEl.querySelector('#qx6_rd_query_panel').style.display = which === 'query' ? 'block' : 'none';
                    if (which === 'query') loadBatches();
                };
            });

            const typeEl   = bodyEl.querySelector('#qx6_rd_type');
            const countEl  = bodyEl.querySelector('#qx6_rd_count');
            const daysEl   = bodyEl.querySelector('#qx6_rd_days');
            const maxActEl = bodyEl.querySelector('#qx6_rd_maxact');
            const batchEl  = bodyEl.querySelector('#qx6_rd_batch');
            const genBtn   = bodyEl.querySelector('#qx6_rd_generate');
            const issueStatus = bodyEl.querySelector('#qx6_rd_issue_status');
            const issueResult = bodyEl.querySelector('#qx6_rd_issue_result');
            const refreshBtn  = bodyEl.querySelector('#qx6_rd_refresh');
            const queryStatus = bodyEl.querySelector('#qx6_rd_query_status');
            const batchList   = bodyEl.querySelector('#qx6_rd_batch_list');

            typeEl.onchange = () => {
                const ut = parseInt(typeEl.value);
                if (ut === 6) {
                    maxActEl.value = 5;
                    maxActEl.disabled = true;
                } else if (ut === 11) {
                    maxActEl.value = 50;
                    maxActEl.disabled = false;
                } else {
                    maxActEl.value = 1;
                    maxActEl.disabled = true;
                }
            };
            typeEl.onchange();

            genBtn.onclick = async () => {
                const ut = parseInt(typeEl.value);
                const count = parseInt(countEl.value);
                const days = parseInt(daysEl.value);
                const maxAct = parseInt(maxActEl.value);
                const batchno = batchEl.value.trim();

                if (!count || count < 1 || count > 100) {
                    issueStatus.innerText = t('数量需 1-100', 'Count must be 1-100');
                    issueStatus.className = 'qx6-status qx6-status-error';
                    return;
                }

                genBtn.disabled = true;
                issueStatus.innerText = t('生成中…', 'Generating…');
                issueStatus.className = 'qx6-status qx6-status-info';

                try {
                    const codes = [];
                    for (let i = 0; i < count; i++) {
                        const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
                        const code = `EMO-${rand}-${Date.now().toString(36).toUpperCase()}`;
                        codes.push({
                            code,
                            usertypekey: ut,
                            maxactivations: maxAct,
                            currentactivations: 0,
                            validays: days,
                            isused: false,
                            batchno,
                        });
                    }

                    const res = await fetch(`${SUPABASE_URL}/rest/v1/emobao_redemptioncode`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation',
                        },
                        body: JSON.stringify(codes),
                    });

                    if (!res.ok) {
                        const txt = await res.text();
                        throw new Error(`POST ${res.status} ${txt}`);
                    }

                    const created = await res.json();
                    issueStatus.innerText = t(`已生成 ${created.length} 个`, `Generated ${created.length}`);
                    issueStatus.className = 'qx6-status qx6-status-success';

                    issueResult.innerHTML = created.map(c =>
                        `<div class="qx6-rd-code">${c.code}</div>`
                    ).join('');

                } catch (e) {
                    console.error(e);
                    issueStatus.innerText = t('生成失败：', 'Generate failed: ') + e.message;
                    issueStatus.className = 'qx6-status qx6-status-error';
                } finally {
                    genBtn.disabled = false;
                }
            };

            async function loadBatches() {
                queryStatus.innerText = t('加载中…', 'Loading…');
                queryStatus.className = 'qx6-status qx6-status-info';
                batchList.innerHTML = '';

                try {
                    const rows = await restGet(
                        `emobao_redemptioncode?select=batchno,generatedat,validays,maxactivations,usertypekey,isused,currentactivations&order=generatedat.desc&limit=1000`
                    );

                    const batches = {};
                    (rows || []).forEach(r => {
                        const b = r.batchno || '(无批次)';
                        if (!batches[b]) {
                            batches[b] = {
                                batchno: b,
                                generatedat: r.generatedat,
                                validays: r.validays,
                                maxactivations: r.maxactivations,
                                usertypekey: r.usertypekey,
                                total: 0,
                                used: 0,
                                activated: 0,
                            };
                        }
                        batches[b].total++;
                        if (r.isused) batches[b].used++;
                        batches[b].activated += (r.currentactivations || 0);
                    });

                    const list = Object.values(batches).sort((a, b) =>
                        (b.generatedat || '').localeCompare(a.generatedat || '')
                    );

                    if (!list.length) {
                        batchList.innerHTML = `<div class="qx6-empty">${t('暂无批次', 'No batches')}</div>`;
                        queryStatus.innerText = '';
                        return;
                    }

                    batchList.innerHTML = list.map(b => {
                        const lb = TYPE_LABEL[b.usertypekey] || TYPE_LABEL[1];
                        return `
                            <div class="qx6-rd-batch" data-batch="${b.batchno}">
                                <div class="qx6-rd-batch-head">
                                    <span class="qx6-rd-batch-no">${b.batchno}</span>
                                    <span class="qx6-rd-batch-type">${lb.cn}</span>
                                </div>
                                <div class="qx6-rd-batch-meta">
                                    ${(b.generatedat || '').slice(0,10)} ·
                                    ${b.total} 码 ·
                                    已用 ${b.used} ·
                                    已激活 ${b.activated} ·
                                    有效 ${b.validays} 天 ·
                                    上限 ${b.maxactivations}
                                </div>
                            </div>
                        `;
                    }).join('');

                    queryStatus.innerText = t(`共 ${list.length} 批`, `${list.length} batches`);
                    queryStatus.className = 'qx6-status qx6-status-success';

                } catch (e) {
                    console.error(e);
                    queryStatus.innerText = t('加载失败', 'Load failed');
                    queryStatus.className = 'qx6-status qx6-status-error';
                }
            }

            refreshBtn.onclick = loadBatches;
        },

        /* ---- 功能 5：音乐库管理（完整版） ---- */
        music_lib: function (bodyEl) {
            if (!isAdmin() && !isMusician()) {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员/音乐管理可访问。', 'Admin/Music Admin only.')}</div>`;
                return;
            }

            bodyEl.innerHTML = `
                <div class="qx6-card">
                    <div class="qx6-ml-toolbar">
                        <button class="qx6-btn qx6-btn-primary" id="qx6_ml_refresh">${t('刷新', 'Refresh')}</button>
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_ml_fill_dur">${t('补齐时长', 'Fill Durations')}</button>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_ml_add">${t('增加音乐', 'Add Music')}</button>
                    </div>
                    <div class="qx6-status" id="qx6_ml_status"></div>
                    <div class="qx6-ml-tree" id="qx6_ml_tree">
                        <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                    </div>
                </div>

                <div class="qx6-ml-modal" id="qx6_ml_modal" style="display:none;">
                    <div class="qx6-ml-modal-inner">
                        <div class="qx6-ml-modal-title" id="qx6_ml_modal_title">${t('音乐资料', 'Music Info')}</div>

                        <div class="qx6-ml-field" id="qx6_ml_field_cat">
                            <label>${t('大类', 'Category')}</label>
                            <select class="qx6-input" id="qx6_ml_cat_select"></select>
                        </div>

                        <div class="qx6-ml-field" id="qx6_ml_field_file">
                            <label>${t('选择文件', 'Choose File')}</label>
                            <input type="file" class="qx6-input" id="qx6_ml_file" accept="audio/*">
                            <div class="qx6-ml-fileinfo" id="qx6_ml_fileinfo"></div>
                        </div>

                        <div class="qx6-ml-field">
                            <label>${t('中文名', 'Name CN')}</label>
                            <input type="text" class="qx6-input" id="qx6_ml_name_cn">
                        </div>
                        <div class="qx6-ml-field">
                            <label>${t('英文名', 'Name EN')}</label>
                            <input type="text" class="qx6-input" id="qx6_ml_name_en">
                        </div>

                        <div class="qx6-status" id="qx6_ml_modal_status"></div>

                        <div class="qx6-ml-modal-actions">
                            <button class="qx6-btn qx6-btn-secondary" id="qx6_ml_cancel">${t('取消', 'Cancel')}</button>
                            <button class="qx6-btn qx6-btn-primary" id="qx6_ml_save">${t('保存', 'Save')}</button>
                        </div>
                    </div>
                </div>
            `;

            const refreshBtn = bodyEl.querySelector('#qx6_ml_refresh');
            const fillDurBtn = bodyEl.querySelector('#qx6_ml_fill_dur');
            const addBtn     = bodyEl.querySelector('#qx6_ml_add');
            const statusEl   = bodyEl.querySelector('#qx6_ml_status');
            const treeEl     = bodyEl.querySelector('#qx6_ml_tree');
            const modal      = bodyEl.querySelector('#qx6_ml_modal');
            const modalTitle = bodyEl.querySelector('#qx6_ml_modal_title');
            const fieldCat   = bodyEl.querySelector('#qx6_ml_field_cat');
            const catSelect  = bodyEl.querySelector('#qx6_ml_cat_select');
            const fieldFile  = bodyEl.querySelector('#qx6_ml_field_file');
            const fileInput  = bodyEl.querySelector('#qx6_ml_file');
            const fileInfo   = bodyEl.querySelector('#qx6_ml_fileinfo');
            const nameCnEl   = bodyEl.querySelector('#qx6_ml_name_cn');
            const nameEnEl   = bodyEl.querySelector('#qx6_ml_name_en');
            const modalStatus = bodyEl.querySelector('#qx6_ml_modal_status');
            const cancelBtn  = bodyEl.querySelector('#qx6_ml_cancel');
            const saveBtn    = bodyEl.querySelector('#qx6_ml_save');

            let editingTrack = null;  // 编辑中的曲目（null 表示新增）
            let cachedTypes = [];     // musictype 缓存
            let cachedTracks = [];    // musictrack 缓存
            let selectedDuration = null;  // 用户选文件后读到的时长

            function showStatus(el, text, type) {
                el.innerText = text || '';
                el.className = 'qx6-status' + (text ? ' qx6-status-' + type : '');
            }

            /* ---------- 加载数据并渲染树 ---------- */
            async function loadTree() {
                showStatus(statusEl, t('加载中…', 'Loading…'), 'info');
                try {
                    const [types, tracks] = await Promise.all([
                        restGet('emobao_musictype?select=*&order=sortorder.asc'),
                        restGet('emobao_musictrack?select=trackid,musictypecode,title_cn,title_en,duration,fileurl,createdat,createdby&order=createdat.desc&limit=2000'),
                    ]);

                    cachedTypes = types || [];
                    cachedTracks = tracks || [];

                    showStatus(statusEl, t(`共 ${cachedTracks.length} 首`, `${cachedTracks.length} tracks`), 'success');
                    renderTree();
                } catch (e) {
                    console.error(e);
                    showStatus(statusEl, t('加载失败：', 'Load failed: ') + e.message, 'error');
                    treeEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
                }
            }

            function renderTree() {
                treeEl.innerHTML = '';

                cachedTypes.forEach(ty => {
                    const tracks = cachedTracks.filter(t => t.musictypecode === ty.musictypecode);

                    const catEl = document.createElement('div');
                    catEl.className = 'qx6-ml-cat';
                    catEl.dataset.catcode = ty.musictypecode;

                    const titleRow = document.createElement('div');
                    titleRow.className = 'qx6-ml-cat-title';
                    titleRow.innerHTML = `
                        <span class="qx6-ml-arrow">▶</span>
                        <span>📁 ${ty.musictypecode} ${ty.typename_cn} / ${ty.typename_en}</span>
                        <span class="qx6-ml-count">(${tracks.length})</span>
                    `;

                    const bodyRow = document.createElement('div');
                    bodyRow.className = 'qx6-ml-cat-body';
                    bodyRow.style.display = 'none';

                    tracks.forEach(tr => {
                        const trEl = document.createElement('div');
                        trEl.className = 'qx6-ml-track';
                        trEl.innerHTML = `
                            <span class="qx6-ml-track-title">🎵 ${tr.title_cn}</span>
                            <span class="qx6-ml-track-dur">${formatDuration(tr.duration)}</span>
                            <span class="qx6-ml-track-date">${(tr.createdat || '').slice(0,10)}</span>
                        `;
                        trEl.onclick = (e) => {
                            e.stopPropagation();
                            openTrackDetail(trEl, tr);
                        };
                        bodyRow.appendChild(trEl);
                    });

                    if (!tracks.length) {
                        const empty = document.createElement('div');
                        empty.className = 'qx6-ml-empty';
                        empty.innerText = t('（该类暂无音乐）', '(no tracks)');
                        bodyRow.appendChild(empty);
                    }

                    titleRow.onclick = () => {
                        const isOpen = bodyRow.style.display !== 'none';
                        bodyRow.style.display = isOpen ? 'none' : 'block';
                        titleRow.querySelector('.qx6-ml-arrow').innerText = isOpen ? '▶' : '▼';
                    };

                    catEl.appendChild(titleRow);
                    catEl.appendChild(bodyRow);
                    treeEl.appendChild(catEl);
                });
            }

            /* ---------- 曲目详情展开 ---------- */
            async function openTrackDetail(trEl, tr) {
                // 若已展开，收起
                const next = trEl.nextSibling;
                if (next && next.classList && next.classList.contains('qx6-ml-detail')) {
                    next.remove();
                    return;
                }
                // 移除其他已展开详情
                treeEl.querySelectorAll('.qx6-ml-detail').forEach(el => el.remove());

                const detail = document.createElement('div');
                detail.className = 'qx6-ml-detail';
                detail.innerHTML = `
                    <div class="qx6-ml-detail-row"><b>${t('中文名','CN')}:</b> ${tr.title_cn}</div>
                    <div class="qx6-ml-detail-row"><b>${t('英文名','EN')}:</b> ${tr.title_en}</div>
                    <div class="qx6-ml-detail-row"><b>${t('时长','Duration')}:</b> ${formatDuration(tr.duration)}</div>
                    <div class="qx6-ml-detail-row"><b>${t('大小','Size')}:</b> <span class="qx6-ml-size">${t('查询中…','Loading…')}</span></div>
                    <div class="qx6-ml-detail-row"><b>${t('入库','Created')}:</b> ${(tr.createdat || '').slice(0,19)}</div>
                    <div class="qx6-ml-detail-row"><b>${t('操作者','By')}:</b> <span class="qx6-ml-by">${tr.createdby || '—'}</span></div>
                    <div class="qx6-ml-detail-actions">
                        <button class="qx6-btn qx6-btn-primary qx6-btn-small" data-act="play">${t('试听','Play')}</button>
                        <button class="qx6-btn qx6-btn-primary qx6-btn-small" data-act="rename">${t('改名','Rename')}</button>
                        <button class="qx6-btn qx6-btn-danger qx6-btn-small" data-act="delete">${t('删除','Delete')}</button>
                    </div>
                    <div class="qx6-ml-audio-host"></div>
                `;
                trEl.parentNode.insertBefore(detail, trEl.nextSibling);

                // 异步查大小
                if (tr.fileurl) {
                    fetchFileSize(tr.fileurl).then(size => {
                        const sizeEl = detail.querySelector('.qx6-ml-size');
                        if (sizeEl) sizeEl.innerText = formatSize(size);
                    });
                } else {
                    detail.querySelector('.qx6-ml-size').innerText = '—';
                }

                // 操作按钮
                detail.querySelector('[data-act="play"]').onclick = () => {
                    const host = detail.querySelector('.qx6-ml-audio-host');
                    if (host.dataset.playing === '1') {
                        host.innerHTML = '';
                        host.dataset.playing = '0';
                        return;
                    }
                    if (!tr.fileurl) {
                        alert(t('此曲目无文件', 'No file'));
                        return;
                    }
                    host.innerHTML = `<audio controls autoplay src="${tr.fileurl}" style="width:100%;margin-top:6px;"></audio>`;
                    host.dataset.playing = '1';
                };
                detail.querySelector('[data-act="rename"]').onclick = () => openRenameModal(tr);
                detail.querySelector('[data-act="delete"]').onclick = () => deleteTrack(tr);
            }

            /* ---------- 改名 ---------- */
            function openRenameModal(tr) {
                editingTrack = tr;
                modalTitle.innerText = t('改名', 'Rename') + '：' + tr.title_cn;
                fieldCat.style.display = 'none';
                fieldFile.style.display = 'none';
                fileInfo.innerText = '';
                nameCnEl.value = tr.title_cn || '';
                nameEnEl.value = tr.title_en || '';
                showStatus(modalStatus, '', '');
                modal.style.display = 'flex';
            }

            /* ---------- 删除（三次确认） ---------- */
            async function deleteTrack(tr) {
                if (!confirm(t('确定删除「' + tr.title_cn + '」？', 'Delete "' + tr.title_cn + '"?'))) return;
                if (!confirm(t('此操作不可恢复！再次确认？', 'This cannot be undone! Confirm again?'))) return;
                const typed = prompt(t('请输入音乐名以确认删除：', 'Type the music name to confirm:'), '');
                if (typed !== tr.title_cn) {
                    alert(t('名称不匹配，已取消', 'Name mismatch, cancelled'));
                    return;
                }

                try {
                    const res = await fetch(
                        `${SUPABASE_URL}/rest/v1/emobao_musictrack?trackid=eq.${encodeURIComponent(tr.trackid)}`,
                        {
                            method: 'DELETE',
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                            },
                        }
                    );
                    if (!res.ok) {
                        const txt = await res.text();
                        throw new Error(txt);
                    }
                    loadTree();
                } catch (e) {
                    console.error(e);
                    alert(t('删除失败：', 'Delete failed: ') + e.message);
                }
            }

            /* ---------- 增加 ---------- */
            function openAddModal() {
                editingTrack = null;
                modalTitle.innerText = t('增加音乐', 'Add Music');
                fieldCat.style.display = '';
                fieldFile.style.display = '';

                // 填大类下拉
                catSelect.innerHTML = cachedTypes.map(ty =>
                    `<option value="${ty.musictypecode}">${ty.musictypecode} ${ty.typename_cn} / ${ty.typename_en}</option>`
                ).join('');

                fileInput.value = '';
                fileInfo.innerText = '';
                nameCnEl.value = '';
                nameEnEl.value = '';
                selectedDuration = null;
                showStatus(modalStatus, '', '');
                modal.style.display = 'flex';
            }

            fileInput.onchange = async () => {
                const f = fileInput.files[0];
                if (!f) return;

                fileInfo.innerText = `${f.name} (${formatSize(f.size)}) ${t('读取时长中…','Reading duration…')}`;
                selectedDuration = null;

                try {
                    const url = URL.createObjectURL(f);
                    const dur = await readAudioDuration(url);
                    URL.revokeObjectURL(url);
                    selectedDuration = dur;
                    if (dur) {
                        fileInfo.innerText = `${f.name} (${formatSize(f.size)}, ${formatDuration(dur)})`;
                    } else {
                        fileInfo.innerText = `${f.name} (${formatSize(f.size)}) ${t('⚠ 无法读取时长','⚠ Cannot read duration')}`;
                    }
                } catch (e) {
                    fileInfo.innerText = `${f.name} (${formatSize(f.size)}) ${t('⚠ 读取失败','⚠ Read failed')}`;
                }
            };

            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                editingTrack = null;
                selectedDuration = null;
            };

            saveBtn.onclick = async () => {
                const nameCn = nameCnEl.value.trim();
                const nameEn = nameEnEl.value.trim();

                if (!nameCn && !nameEn) {
                    showStatus(modalStatus, t('至少填一个名字', 'At least one name'), 'error');
                    return;
                }

                if (editingTrack) {
                    /* ---- 改名 ---- */
                    showStatus(modalStatus, t('保存中…', 'Saving…'), 'info');
                    saveBtn.disabled = true;
                    try {
                        const res = await fetch(
                            `${SUPABASE_URL}/rest/v1/emobao_musictrack?trackid=eq.${encodeURIComponent(editingTrack.trackid)}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'apikey': SUPABASE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal',
                                },
                                body: JSON.stringify({
                                    title_cn: nameCn || nameEn,
                                    title_en: nameEn || nameCn,
                                    updatedat: new Date().toISOString(),
                                }),
                            }
                        );
                        if (!res.ok) {
                            const txt = await res.text();
                            throw new Error(txt);
                        }
                        showStatus(modalStatus, t('已保存', 'Saved'), 'success');
                        setTimeout(() => {
                            modal.style.display = 'none';
                            editingTrack = null;
                            loadTree();
                        }, 500);
                    } catch (e) {
                        console.error(e);
                        showStatus(modalStatus, t('保存失败：', 'Save failed: ') + e.message, 'error');
                        saveBtn.disabled = false;
                    }
                    return;
                }

                /* ---- 新增 ---- */
                const file = fileInput.files[0];
                if (!file) {
                    showStatus(modalStatus, t('请选择文件', 'Choose file'), 'error');
                    return;
                }
                if (!selectedDuration) {
                    showStatus(modalStatus, t('无法读取时长，请检查文件', 'Cannot read duration'), 'error');
                    return;
                }

                const musictypecode = parseInt(catSelect.value);
                const ty = cachedTypes.find(x => x.musictypecode === musictypecode);
                const typenameCn = ty ? ty.typename_cn : '';

                // 检查重名 → 自动加后缀（中英文都加）
                let finalCn = nameCn || nameEn;
                let finalEn = nameEn || nameCn;
                let suffix = 0;
                while (cachedTracks.some(t => t.title_cn === finalCn || t.title_en === finalEn)) {
                    suffix++;
                    finalCn = (nameCn || nameEn) + `(${suffix})`;
                    finalEn = (nameEn || nameCn) + `(${suffix})`;
                }

                if (suffix > 0) {
                    const ok = confirm(t(
                        `名称重复，将自动改为「${finalCn}」，是否继续？`,
                        `Name duplicated, will use "${finalCn}". Continue?`
                    ));
                    if (!ok) return;
                }

                showStatus(modalStatus, t('上传中…', 'Uploading…'), 'info');
                saveBtn.disabled = true;

                try {
                    /* 上传到 R2（占位） */
                    let fileurl;
                    try {
                        fileurl = await uploadMusicToR2(file, musictypecode, typenameCn, file.name);
                    } catch (e) {
                        // 占位逻辑：R2 未配置时，提示并终止
                        throw new Error(t(
                            '上传功能待 R2 配置（' + e.message + '）',
                            'Upload pending R2 config: ' + e.message
                        ));
                    }

                    /* INSERT */
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/emobao_musictrack`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal',
                        },
                        body: JSON.stringify({
                            musictypecode,
                            title_cn: finalCn,
                            title_en: finalEn,
                            duration: selectedDuration,
                            fileurl,
                            createdby: getUserId(),
                            isactive: true,
                        }),
                    });

                    if (!res.ok) {
                        const txt = await res.text();
                        throw new Error(txt);
                    }

                    showStatus(modalStatus, t('已保存', 'Saved'), 'success');
                    setTimeout(() => {
                        modal.style.display = 'none';
                        selectedDuration = null;
                        loadTree();
                    }, 500);

                } catch (e) {
                    console.error(e);
                    showStatus(modalStatus, t('保存失败：', 'Save failed: ') + e.message, 'error');
                    saveBtn.disabled = false;
                }
            };

            /* ---------- 补齐时长 ---------- */
            fillDurBtn.onclick = async () => {
                if (!confirm(t('将逐首读取时长并写入数据库，可能耗时几分钟。继续？', 'Will read and update durations. Continue?'))) return;

                try {
                    const rows = await restGet(
                        'emobao_musictrack?duration=is.null&select=trackid,fileurl,title_cn'
                    );
                    if (!rows.length) {
                        showStatus(statusEl, t('所有曲目时长已齐全', 'All durations present'), 'success');
                        return;
                    }

                    fillDurBtn.disabled = true;
                    let done = 0, ok = 0, failed = 0;

                    for (const r of rows) {
                        done++;
                        showStatus(statusEl, t(`补齐中 ${done}/${rows.length}：${r.title_cn}`,
                            `Filling ${done}/${rows.length}: ${r.title_cn}`), 'info');

                        if (!r.fileurl) { failed++; continue; }

                        const dur = await readAudioDuration(r.fileurl);
                        if (!dur) { failed++; continue; }

                        try {
                            const res = await fetch(
                                `${SUPABASE_URL}/rest/v1/emobao_musictrack?trackid=eq.${encodeURIComponent(r.trackid)}`,
                                {
                                    method: 'PATCH',
                                    headers: {
                                        'apikey': SUPABASE_KEY,
                                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                                        'Content-Type': 'application/json',
                                        'Prefer': 'return=minimal',
                                    },
                                    body: JSON.stringify({ duration: dur }),
                                }
                            );
                            if (res.ok) ok++;
                            else failed++;
                        } catch (e) {
                            failed++;
                        }
                    }

                    showStatus(statusEl, t(`补齐完成：成功 ${ok}，失败 ${failed}`,
                        `Done: ${ok} ok, ${failed} failed`), failed ? 'warning' : 'success');
                    fillDurBtn.disabled = false;
                    loadTree();

                } catch (e) {
                    console.error(e);
                    showStatus(statusEl, t('补齐失败：', 'Fill failed: ') + e.message, 'error');
                    fillDurBtn.disabled = false;
                }
            };

            /* ---------- 上传 R2（占位） ---------- */
            async function uploadMusicToR2(file, musictypecode, typenameCn, filename) {
                if (!UPLOAD_WORKER_URL) {
                    throw new Error(t('Worker 未配置', 'Worker not configured'));
                }

                const path = `${musictypecode}${typenameCn}/${filename}`;
                const fd = new FormData();
                fd.append('file', file);
                fd.append('userid', getUserId());
                fd.append('path', path);

                const res = await fetch(UPLOAD_WORKER_URL, {
                    method: 'POST',
                    body: fd,
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }

                const data = await res.json();
                if (!data.url) throw new Error(t('返回无 URL', 'No URL returned'));
                return data.url;
            }

            /* ---------- 事件绑定 ---------- */
            refreshBtn.onclick = loadTree;
            addBtn.onclick = openAddModal;

            /* ---------- 初始化 ---------- */
            loadTree();
        },

        /* ---- 功能 6：组曲规则 ---- */
        rule_edit: function (bodyEl) {
            if (!isAdmin()) {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
                return;
            }

            bodyEl.innerHTML = `
                <div class="qx6-card">
                    <div class="qx6-re-toolbar">
                        <button class="qx6-btn qx6-btn-primary" id="qx6_re_refresh">${t('刷新', 'Refresh')}</button>
                    </div>
                    <div class="qx6-status" id="qx6_re_status"></div>
                    <div class="qx6-re-list" id="qx6_re_list">
                        <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                    </div>
                </div>
            `;

            const refreshBtn = bodyEl.querySelector('#qx6_re_refresh');
            const statusEl   = bodyEl.querySelector('#qx6_re_status');
            const listEl     = bodyEl.querySelector('#qx6_re_list');

            function showStatus(text, type) {
                statusEl.innerText = text || '';
                statusEl.className = 'qx6-status' + (text ? ' qx6-status-' + type : '');
            }

            async function loadRules() {
                showStatus(t('加载中…', 'Loading…'), 'info');
                try {
                    const [rules, emotions] = await Promise.all([
                        restGet('emobao_regulationrule?select=*&order=ruleid.asc').catch(() => []),
                        restGet('emobao_emotiontype?select=emotioncode,emotionname_cn,emotionname_en&order=sortorder.asc').catch(() => []),
                    ]);

                    if (!rules.length) {
                        listEl.innerHTML = `<div class="qx6-empty">${t('暂无规则（表可能为空或不存在）', 'No rules (table may be empty or missing)')}</div>`;
                        showStatus('', '');
                        return;
                    }

                    const emoMap = {};
                    emotions.forEach(e => { emoMap[e.emotioncode] = e; });

                    listEl.innerHTML = '';
                    rules.forEach(r => {
                        const emo = emoMap[r.emotioncode] || {};
                        const emoName = emo.emotionname_cn || `情绪 ${r.emotioncode}`;
                        const row = document.createElement('div');
                        row.className = 'qx6-re-row';
                        row.innerHTML = `
                            <div class="qx6-re-head">
                                <span class="qx6-re-emo">${emoName}</span>
                                <span class="qx6-re-meta">${r.musicids ? (Array.isArray(r.musicids) ? r.musicids.length : '?') : 0} 首</span>
                            </div>
                            <div class="qx6-re-detail">${JSON.stringify(r.musicids || [])}</div>
                        `;
                        listEl.appendChild(row);
                    });

                    showStatus(t(`共 ${rules.length} 条规则`, `${rules.length} rules`), 'success');

                } catch (e) {
                    console.error(e);
                    showStatus(t('加载失败', 'Load failed'), 'error');
                    listEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
                }
            }

            refreshBtn.onclick = loadRules;
            loadRules();
        },

        /* ---- 功能 7：用户管理 ---- */
        manage_users: function (bodyEl) { renderManageUsers(bodyEl); },

        /* ---- 功能 8：问答/推送管理 ---- */
        qa_engine: function (bodyEl) { bodyEl.innerHTML = `<div class="qx6-empty">${t('开发中…', 'Coming soon…')}</div>`; },

        /* ---- 功能 9：财务管理 ---- */
        finance: function (bodyEl) { bodyEl.innerHTML = `<div class="qx6-empty">${t('开发中…', 'Coming soon…')}</div>`; },

        /* ---- 功能 10：设备管理 ---- */
        device: function (bodyEl) { bodyEl.innerHTML = `<div class="qx6-empty">${t('开发中…', 'Coming soon…')}</div>`; },

        /* ---- 功能 11：系统退出 ---- */
        sys_exit: function (bodyEl) {
            bodyEl.innerHTML = `
                <div class="qx6-card">
                    <div class="qx6-card-title">${t('系统退出', 'System Exit')}</div>
                    <div class="qx6-buy-desc">
                        ${t('退出情绪宝程序使用，并释放所有占用的资源（摄像头、音频、数据库连接等）。',
                            'Exit Emo Treasure and release all resources (camera, audio, DB connections).')}
                    </div>
                    <button class="qx6-btn qx6-btn-danger" id="qx6_btn_sys_exit">
                        ${t('确定退出', 'Confirm Exit')}
                    </button>
                </div>
            `;
            const btn = bodyEl.querySelector('#qx6_btn_sys_exit');
            btn.onclick = async () => {
                if (!confirm(t('确定退出情绪宝吗？', 'Exit Emo Treasure?'))) return;

                try { if (window.qxHrvCapture) window.qxHrvCapture.release(); } catch (e) {}
                try { if (window.qxMoodMirror) {
                    window.qxMoodMirror.destroy('qx1_emotion_wheel');
                    window.qxMoodMirror.destroy('qx2_wheel_before');
                    window.qxMoodMirror.destroy('qx2_wheel_after');
                } } catch (e) {}

                try { if (window.qx5Engine) window.qx5Engine.abort(); } catch (e) {}

                document.querySelectorAll('audio, video').forEach(el => {
                    try { el.pause(); el.src = ''; } catch (e) {}
                });

                try { window.close(); } catch (e) {}

                setTimeout(() => {
                    document.body.innerHTML = `
                        <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                                    font-family:sans-serif;color:#5A6B87;text-align:center;padding:20px;">
                            <div>
                                <div style="font-size:64px;margin-bottom:16px;">👋</div>
                                <div style="font-size:20px;font-weight:bold;color:#2C7BE5;margin-bottom:8px;">
                                    ${t('已安全退出情绪宝', 'Safely exited Emo Treasure')}
                                </div>
                                <div style="font-size:13px;line-height:1.8;">
                                    ${t('摄像头、音频、数据库连接已全部释放。', 'Camera, audio and DB connections released.')}<br>
                                    ${t('请关闭此标签页。', 'Please close this tab.')}
                                </div>
                            </div>
                        </div>
                    `;
                }, 300);
            };
        },
    };

    /* ================================================================
       功能 7：用户管理（仅系统管理员）
       ================================================================ */
    function renderManageUsers(bodyEl) {
        if (!isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        const PAGE_SIZE = 50;
        let st = {
            keyword: '',
            page: 0,
            total: 0,
            users: [],
        };

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
                    `${SUPABASE_URL}/rest/v1/emobao_user?${countFilter}&select=userid`,
                    {
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Prefer': 'count=exact',
                            'Range-Unit': 'items',
                            'Range': '0-0',
                        },
                    }
                );
                const contentRange = countRes.headers.get('content-range') || '';
                const total = parseInt((contentRange.split('/')[1] || '0'), 10);
                st.total = total;

                const offset = st.page * PAGE_SIZE;
                const listFilter = st.keyword
                    ? `username=ilike.*${encodeURIComponent(st.keyword)}*`
                    : `userid=not.is.null`;
                const listRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/emobao_user?${listFilter}&select=userid,username,usertypekey,expirydate,isactive,isguest,createdat&order=createdat.desc&limit=${PAGE_SIZE}&offset=${offset}`,
                    {
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                        },
                    }
                );
                const users = await listRes.json();
                st.users = users || [];
                showStatus('', '');
                renderList();
                renderPager();
            } catch (e) {
                console.error(e);
                showStatus(t('加载失败', 'Load failed'), 'error');
                listEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
            }
        }

        function typeLabel(ut) {
            const lb = TYPE_LABEL[ut] || TYPE_LABEL[1];
            const lang = (window.mQxb && window.mQxb.Language) || 1;
            return lang === 1 ? lb.cn : lb.en;
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
                typeEl.innerText = typeLabel(u.usertypekey);

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

            const overlay = document.createElement('div');
            overlay.className = 'qx6-mu-modal';
            overlay.innerHTML = `
                <div class="qx6-mu-modal-inner">
                    <div class="qx6-mu-modal-title">
                        ${t('编辑用户', 'Edit User')}：${user.username}
                    </div>

                    <div class="qx6-mu-field">
                        <label>${t('当前身份', 'Current Type')}</label>
                        <div class="qx6-mu-readonly">${typeLabel(user.usertypekey)}</div>
                    </div>

                    <div class="qx6-mu-field">
                        <label>${t('新身份', 'New Type')}</label>
                        <select class="qx6-input" id="qx6_mu_new_type">
                            ${Object.keys(TYPE_LABEL).map(k => {
                                const lb = TYPE_LABEL[k];
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
                        <input type="date" class="qx6-input" id="qx6_mu_new_expiry"
                               value="${user.expirydate || ''}">
                    </div>

                    <div class="qx6-mu-field">
                        <label>${t('或：延长天数', 'Or: extend days')}</label>
                        <input type="number" class="qx6-input" id="qx6_mu_extend_days"
                               placeholder="${t('如 3650', 'e.g. 3650')}" min="1">
                    </div>

                    <div class="qx6-mu-modal-status qx6-status" id="qx6_mu_modal_status"></div>

                    <div class="qx6-mu-modal-actions">
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_mu_cancel">
                            ${t('取消', 'Cancel')}
                        </button>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_mu_save">
                            ${t('保存', 'Save')}
                        </button>
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

                if (!newType || newType < 1 || newType > 14) {
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
                        `${SUPABASE_URL}/rest/v1/emobao_user?userid=eq.${encodeURIComponent(user.userid)}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
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

                    if (!res.ok) {
                        const txt = await res.text();
                        throw new Error(`PATCH ${res.status} ${txt}`);
                    }

                    mStatus.innerText = t('已保存', 'Saved');
                    mStatus.className = 'qx6-mu-modal-status qx6-status-success';

                    setTimeout(() => {
                        overlay.remove();
                        loadUsers();
                    }, 600);

                } catch (e) {
                    console.error(e);
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

    /* ============ init / destroy ============ */
    async function qx6_init() {
        console.log('qx6_init 开始');
        if (state.initialized) return;

        state.currentPanel = null;
        state.oldVerified = false;

        renderMenu();

        const backBtn = getEl('qx6_panel_back');
        if (backBtn) backBtn.onclick = closePanel;

        const backMain = getEl('qx6_back_main');
        if (backMain) backMain.onclick = () => {
            if (typeof window.returnToMain === 'function') window.returnToMain();
        };

        const listView = getEl('qx6_list_view');
        const panelView = getEl('qx6_panel_view');
        if (listView) listView.style.display = 'flex';
        if (panelView) panelView.style.display = 'none';

        state.initialized = true;
        console.log('qx6_init 完成');
    }

    function qx6_destroy() {
        console.log('qx6_destroy');
        state.initialized = false;
        state.currentPanel = null;
        state.oldVerified = false;
        const menu = getEl('qx6_menu');
        if (menu) menu.innerHTML = '';
        const body = getEl('qx6_panel_body');
        if (body) body.innerHTML = '';
    }

    window.qx6_init = qx6_init;
    window.qx6_destroy = qx6_destroy;

})();