/* ================================================================
   情绪宝 - qx6-2 修改口令面板
   路径：js/qx6/qx6_2_password.js
   日期：2026-10-13
   说明：
   - 旧口令验证 → 新口令设置 → 调 emobao_set_password
   - 访客不可用
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_2_password] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    /* 面板内部状态 */
    let oldVerified = false;

    function render(bodyEl) {
        if (U.isGuest()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('访客不能修改口令。', 'Guest cannot change password.')}</div>`;
            return;
        }

        oldVerified = false;

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
                const hash = await U.hashPassword(pwd);
                const uid = U.getUserId();
                const rows = await U.restGet(`emobao_user?userid=eq.${encodeURIComponent(uid)}&passwordhash=eq.${hash}&select=userid`);
                if (rows && rows.length === 1) {
                    oldVerified = true;
                    showStatus(oldStatus, t('旧口令正确','Correct'), 'success');
                    newCard.style.display = 'block';
                } else {
                    oldVerified = false;
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
            const level = U.calcStrength(newInput.value);
            const match = newInput.value && newInput.value === confirmInput.value;
            saveBtn.disabled = !(oldVerified && level >= 2 && match);
        }

        newInput.addEventListener('input', () => {
            renderStrength(U.calcStrength(newInput.value));
            updateSaveBtn();
        });
        confirmInput.addEventListener('input', updateSaveBtn);

        oldInput.addEventListener('blur', () => { if (oldInput.value) verifyOld(); });
        oldInput.addEventListener('input', () => {
            oldVerified = false;
            newCard.style.display = 'none';
            updateSaveBtn();
        });

        renderStrength(0);

        saveBtn.onclick = async () => {
            if (!oldVerified) {
                await verifyOld();
                if (!oldVerified) return;
            }
            const pwd = newInput.value;
            const level = U.calcStrength(pwd);
            if (level < 2) { showStatus(newStatus, t('口令太弱','Too weak'), 'error'); return; }
            if (pwd !== confirmInput.value) { showStatus(newStatus, t('两次输入不一致','Mismatch'), 'error'); return; }
            showStatus(newStatus, t('保存中…','Saving…'), 'info');
            try {
                const hash = await U.hashPassword(pwd);
                const result = await U.rpc('emobao_set_password', { p_userid: U.getUserId(), p_passwordhash: hash });
                const row = Array.isArray(result) ? result[0] : result;
                if (row && row.success) {
                    showStatus(newStatus, t('口令已修改','Password changed'), 'success');
                    setTimeout(() => {
                        oldInput.value = '';
                        newInput.value = '';
                        confirmInput.value = '';
                        newCard.style.display = 'none';
                        oldVerified = false;
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
    }

    window.qx6Register('password', render);
})();