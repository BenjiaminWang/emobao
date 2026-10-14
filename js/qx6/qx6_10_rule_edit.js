/* ================================================================
   情绪宝 - qx6-10 组曲规则面板
   路径：js/qx6/qx6_10_rule_edit.js
   日期：2026-10-13
   说明：
   - 仅系统管理员可访问
   - 显示 emobao_regulationrule 里每条规则的情绪名 + 曲目数
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_10_rule_edit] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function render(bodyEl) {
        if (!U.isAdmin()) {
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
                    U.restGet('emobao_regulationrule?select=*&order=ruleid.asc').catch(() => []),
                    U.restGet('emobao_emotiontype?select=emotioncode,emotionname_cn,emotionname_en&order=sortorder.asc').catch(() => []),
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
                            <span class="qx6-re-meta">${r.sequence ? (Array.isArray(r.sequence) ? r.sequence.length : '?') : 0} 首</span>
                        </div>
                        <div class="qx6-re-detail">${JSON.stringify(r.sequence || [])}</div>
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
    }

    window.qx6Register('rule_edit', render);
})();