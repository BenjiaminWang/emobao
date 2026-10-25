/* ================================================================
   情绪宝 - qx6-1 账户面板
   路径：js/qx6/qx6_1_account.js
   日期：2026-10-13
   说明：
   - 显示用户名 / 身份 / 使用期限
   - 中英文切换 (联动音色库描述)
   - 语音播报设置 (多音色动态选择)
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

    // 🎙️ 微软精选音色库 (双语版本)
    const VOICE_LIBRARY = {
        zh: [
            { value: 'zh-CN-YunxiNeural', label: '云希 (男声 · 生动自然)' },
            { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声 · 温暖抒情)' },
            { value: 'zh-CN-YunjianNeural', label: '云健 (男声 · 沉稳纪录片)' },
            { value: 'zh-CN-XiaoyiNeural', label: '晓伊 (女声 · 活泼俏皮)' },
            { value: 'zh-CN-YunyangNeural', label: '云扬 (男声 · 专业新闻)' },
            { value: 'zh-CN-YunzeNeural', label: '云泽 (男声 · 浑厚叙事)' }
        ],
        en: [
            { value: 'en-US-AriaNeural', label: 'Aria (Female · Natural)' },
            { value: 'en-US-GuyNeural', label: 'Guy (Male · US Standard)' },
            { value: 'en-US-JennyNeural', label: 'Jenny (Female · Friendly)' },
            { value: 'en-US-AndrewNeural', label: 'Andrew (Male · Reliable)' },
            { value: 'en-GB-SoniaNeural', label: 'Sonia (Female · British)' },
            { value: 'en-GB-RyanNeural', label: 'Ryan (Male · British)' }
        ]
    };

    function render(bodyEl) {
        const ut = U.getUserType();
        const lang = (window.mQxb && window.mQxb.Language) || 1; // 1中文, 2英文
        const isZh = (lang === 1);

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

        // 获取已保存的语音
        const savedVoice = localStorage.getItem('qx_tts_voice');
        const currentVoiceList = isZh ? VOICE_LIBRARY.zh : VOICE_LIBRARY.en;
        
        let selectedVoice = currentVoiceList.find(v => v.value === savedVoice)?.value;
        if (!selectedVoice) selectedVoice = currentVoiceList[0].value;

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
                    <button class="qx6-lang-btn ${isZh ? 'active' : ''}" data-lang="1">中文</button>
                    <button class="qx6-lang-btn ${!isZh ? 'active' : ''}" data-lang="2">English</button>
                </div>
            </div>

            <!-- 🎙️ 语音播报设置 -->
            <div class="qx6-card">
                <div class="qx6-card-title">${t('语音播报设置', 'Voice Settings')}</div>
                
                <!-- 用 flex 控制比例，下拉框占 60%，按钮各占 20% -->
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 12px;">
                    <select id="qx6_voice_select" style="flex: 3; padding: 8px 10px; border-radius: 6px; border: 1px solid #d1d5db; outline: none; font-size: 14px; background-color: #fff;">
                        ${currentVoiceList.map(v => `<option value="${v.value}" ${v.value === selectedVoice ? 'selected' : ''}>${v.label}</option>`).join('')}
                    </select>
                    <button class="qx6-btn" id="qx6_voice_test_btn" style="flex: 1; padding: 8px 0; background-color: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">▶ ${t('试听', 'Test')}</button>
                    <button class="qx6-btn" id="qx6_voice_save_btn" style="flex: 1; padding: 8px 0; background-color: #374151; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">${t('保存', 'Save')}</button>
                </div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
                    ${t('* 系统已根据您的语言偏好为您精选了专属音色，保存后生效。', '* Voices are dynamically filtered by your language.')}
                </div>
            </div>

            ${(!U.isGuest() && !(ut >= 2 && ut <= 5)) ? `
            <div class="qx6-card">
                <div class="qx6-card-title">${t('购买订阅', 'Subscribe')}</div>
                <div class="qx6-buy-desc">${t('成为 VIP，解锁完整功能。', 'Become VIP to unlock full features.')}</div>
                <button class="qx6-btn qx6-btn-primary" id="qx6_btn_buy">${t('了解订阅', 'Learn more')}</button>
            </div>` : ''}
        `;

        // ============ 语言切换逻辑 ============
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
                if (typeof window.qx6RefreshShell === 'function') {
                    window.qx6RefreshShell();
                }
                render(bodyEl); 
            };
        });

        // ============ 🎙️ 语音设置逻辑 ============
        const voiceSelect = bodyEl.querySelector('#qx6_voice_select');
        const testBtn = bodyEl.querySelector('#qx6_voice_test_btn');
        const saveBtn = bodyEl.querySelector('#qx6_voice_save_btn');

        if (testBtn) {
            testBtn.onclick = () => {
                const voice = voiceSelect.value;
                const oldVoice = localStorage.getItem('qx_tts_voice');
                localStorage.setItem('qx_tts_voice', voice);
                
                const testText = isZh ? "朋友，这就是您选择的语音效果，希望您喜欢。" : "Friend, this is the voice you selected. I hope you like it.";
                
                if (window.qxSpeak) {
                    window.qxSpeak(testText, () => {
                        if (!oldVoice) localStorage.removeItem('qx_tts_voice');
                        else localStorage.setItem('qx_tts_voice', oldVoice);
                    });
                }
            };
        }

        if (saveBtn) {
            saveBtn.onclick = () => {
                const voice = voiceSelect.value;
                localStorage.setItem('qx_tts_voice', voice);
                if (typeof window.showToast === 'function') {
                    window.showToast(t('语音设置已保存！', 'Voice setting saved!'), 'success');
                }
            };
        }

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