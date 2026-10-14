/* ================================================================
   情绪宝 - qx6-11 财务管理面板
   路径：js/qx6/qx6_11_finance.js
   日期：2026-10-13
   说明：
   - 仅系统管理员 / 财务可访问
   - 目前占位，后续接入财务数据
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_11_finance] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function render(bodyEl) {
        if (!U.isAdmin() && !U.isFinance()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员/财务可访问。', 'Admin/Finance only.')}</div>`;
            return;
        }

        bodyEl.innerHTML = `<div class="qx6-empty">${t('开发中…', 'Coming soon…')}</div>`;
    }

    window.qx6Register('finance', render);
})();