/* ================================================================
   情绪宝 - qx6 设置（壳）
   路径：js/qx6/qx6_settings.js
   日期：2026-10-13
   说明：
   - 只负责菜单渲染、面板切换、qx6_init / qx6_destroy
   - 具体面板逻辑由 js/qx6/qx6_N_xxx.js 各自注册到 qx6Registry
   - 必须在所有面板文件之后加载
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_settings] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function getEl(id) { return document.getElementById(id); }

    let state = {
        initialized: false,
        currentPanel: null,
    };

    /* ================================================================
       菜单配置（按身份动态生成）
       ================================================================ */
    function buildMenuConfig() {
        const sections = [];

        const accountItems = [
            { id: 'account',  icon: '👤', cn: '账户',     en: 'Account' },
        ];
        if (!U.isGuest()) {
            accountItems.push({ id: 'password', icon: '🔑', cn: '修改口令', en: 'Change Password' });
        }
        accountItems.push({ id: 'device', icon: '📱', cn: '设备管理', en: 'Devices' });
        sections.push({ title: '', items: accountItems });

        if (U.isAdmin()) {
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

        if (U.isAdmin() || U.isMusician()) {
            const contentItems = [
                { id: 'music_lib',        icon: '🎵', cn: '音乐库管理',     en: 'Music Library' },
                { id: 'music_workbench',  icon: '🎼', cn: '音乐导师工作台',  en: 'Music Workbench' },
            ];
            if (U.isAdmin()) {
                contentItems.push({ id: 'rule_edit', icon: '🎼', cn: '组曲规则', en: 'Playlist Rules' });
            }
            sections.push({
                title: { cn: '内容', en: 'Content' },
                items: contentItems,
            });
        }

        if (U.isAdmin() || U.isFinance()) {
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

    const PANEL_TITLES = {
        account:         { cn: '账户',       en: 'Account' },
        password:        { cn: '修改口令',   en: 'Change Password' },
        device:          { cn: '设备管理',   en: 'Devices' },
        stats_users:     { cn: '用户总体情况', en: 'User Overview' },
        redeem:          { cn: '兑换码管理', en: 'Redeem Codes' },
        manage_users:    { cn: '用户管理',   en: 'User Management' },
        qa_engine:       { cn: '问答/推送管理', en: 'Q&A / Engine' },
        music_lib:       { cn: '音乐库管理', en: 'Music Library' },
        music_workbench: { cn: '音乐导师工作台', en: 'Music Workbench' },
        rule_edit:       { cn: '组曲规则',   en: 'Playlist Rules' },
        finance:         { cn: '财务管理',   en: 'Finance' },
        sys_exit:        { cn: '退出情绪宝', en: 'Exit' },
    };

    /* ================================================================
       菜单渲染
       ================================================================ */
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

    /* ================================================================
       面板开关
       ================================================================ */
    function openPanel(panelId) {
        state.currentPanel = panelId;

        const listView = getEl('qx6_list_view');
        const panelView = getEl('qx6_panel_view');
        if (listView) listView.style.display = 'none';
        if (panelView) panelView.style.display = 'flex';

        const titleEl = getEl('qx6_panel_title');
        const bodyEl = getEl('qx6_panel_body');

        const info = PANEL_TITLES[panelId] || { cn: '功能', en: 'Feature' };
        if (titleEl) titleEl.innerText = t(info.cn, info.en);

        if (bodyEl) {
            bodyEl.innerHTML = '';
            const renderFn = (window.qx6Registry && window.qx6Registry[panelId])
                           ? window.qx6Registry[panelId]
                           : null;
            if (typeof renderFn === 'function') {
                renderFn(bodyEl);
            } else {
                bodyEl.innerHTML = `<div class="qx6-empty">${t('开发中…', 'Coming soon…')}</div>`;
            }
        }
    }

    function closePanel() {
        state.currentPanel = null;
        const listView = getEl('qx6_list_view');
        const panelView = getEl('qx6_panel_view');
        if (listView) listView.style.display = 'flex';
        if (panelView) panelView.style.display = 'none';
    }

    /* ================================================================
       外部调用（供面板内使用）：
       切换语言后，通知壳刷新菜单和当前面板标题
       ================================================================ */
    function refreshShell() {
        renderMenu();
        const titleEl = getEl('qx6_panel_title');
        if (titleEl && state.currentPanel) {
            const info = PANEL_TITLES[state.currentPanel] || { cn: '功能', en: 'Feature' };
            titleEl.innerText = t(info.cn, info.en);
        }
    }
    window.qx6RefreshShell = refreshShell;

    /* ================================================================
       生命周期
       ================================================================ */
    async function qx6_init() {
        console.log('qx6_init 开始');
        if (state.initialized) return;

        state.currentPanel = null;

        await U.ensureTypeDictLoaded();

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
        const menu = getEl('qx6_menu');
        if (menu) menu.innerHTML = '';
        const body = getEl('qx6_panel_body');
        if (body) body.innerHTML = '';
    }

    window.qx6_init = qx6_init;
    window.qx6_destroy = qx6_destroy;

    /* ================================================================
       向后兼容：其他模块可能引用这些全局函数
       ================================================================ */
    window.qx6GetHrvSource = U.getHrvSource;
    window.qx6GetCameraFacing = U.getCameraFacing;
    window.qx6GetHrvCameraDeviceId = U.getHrvCameraDeviceId;

    console.log('[qx6_settings] 壳已加载');
})();