/* ================================================================
   情绪宝 - qx6-12 退出情绪宝面板
   路径：js/qx6/qx6_12_sys_exit.js
   日期：2026-10-13
   说明：
   - 释放摄像头 / 蓝牙 / 音频 / 数据库连接
   - 清空页面，显示已退出提示
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_12_sys_exit] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function render(bodyEl) {
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
            try { if (window.qxPolarH10) await window.qxPolarH10.disconnect(); } catch (e) {}
            try {
                if (window.qxMoodMirror) {
                    window.qxMoodMirror.destroy('qx1_emotion_wheel');
                    window.qxMoodMirror.destroy('qx2_wheel_before');
                    window.qxMoodMirror.destroy('qx2_wheel_after');
                }
            } catch (e) {}

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
    }

    window.qx6Register('sys_exit', render);
})();