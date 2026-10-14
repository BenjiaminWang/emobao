/* ================================================================
   情绪宝 - qx6 面板注册表
   路径：js/qx6/qx6_registry.js
   日期：2026-10-13
   说明：
   - 所有 qx6 子模块（qx6_1_account.js 等）把自己的渲染函数
     注册到 window.qx6Registry
   - qx6_settings.js（壳）从注册表里按 id 取渲染函数
   - 本文件只提供空壳和注册接口，不含任何面板逻辑
   ================================================================ */

   (function () {
    'use strict';

    /* 全局注册表 */
    window.qx6Registry = window.qx6Registry || {};

    /* 便捷注册函数：window.qx6Register('account', fn) */
    window.qx6Register = function (id, renderFn) {
        if (!id || typeof renderFn !== 'function') {
            console.warn('[qx6_registry] 注册失败：id 或 renderFn 无效', id);
            return;
        }
        if (window.qx6Registry[id]) {
            console.warn('[qx6_registry] 覆盖已注册面板：', id);
        }
        window.qx6Registry[id] = renderFn;
        console.log('[qx6_registry] 已注册面板：', id);
    };

    /* 查询某面板是否已注册 */
    window.qx6HasPanel = function (id) {
        return typeof window.qx6Registry[id] === 'function';
    };

    /* 列出所有已注册面板 id（调试用） */
    window.qx6ListPanels = function () {
        return Object.keys(window.qx6Registry);
    };

    console.log('[qx6_registry] 模块已注册');
})();