/* ================================================================
   情绪宝 - qx6-1 账户面板
   路径：js/qx6/qx6_1_account.js
   日期：2026-10-13
   说明：
   - 显示用户名 / 身份 / 使用期限
   - 中英文切换
   - 非 VIP 显示"购买订阅"
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_1_account] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function render(bodyEl) {
        const ut = U.getUserType();
        const lang = (window.mQxb && window.mQxb.Language) || 1;

        let uname, typeLbl, expiry;
        if (U.isGuest()) {
            const d = new Date();
            const dateStr = d.getFullYear() + '-' +
                String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
            uname = t('访客', 'Guest');
            typeLbl = t('访客', 'Guest');
            expiry = dateStr;
        } else {
            uname = U.getUserName() || '—';
            typeLbl = U.typeLabel(ut);
            expiry = U.getExpiry() || '—';
        }

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('用户名', 'Username')}</div>
                    <div class="qx6-info-value">${uname}</div>
                </div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('身份', 'Type')}</div>
                    <div class="qx6-info-value">${typeLbl}</div>
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

            ${(!U.isGuest() && !(ut >= 2 && ut <= 5)) ? `
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

                /* 通知壳重新渲染菜单和当前面板 */
                if (typeof window.qx6RefreshShell === 'function') {
                    window.qx6RefreshShell();
                }
                render(bodyEl);
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
    }

    window.qx6Register('account', render);
})();