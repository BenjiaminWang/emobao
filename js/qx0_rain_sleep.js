/* ================================================================
   情绪宝 - 睡眠雨声助眠（隐藏功能）
   v1 (2026-10-30)
   - 触发：长按状态栏品牌标题 #status_title 3 秒
   - 播放：picture/rain-loop.mp3 无限循环（loop=true，无网络请求）
   - 画面：治愈主图轻微呼吸动画，全屏遮罩
   - 停止：轻触屏幕任意处
   - 不依赖任何其他业务模块，仅读取 window.mQxb 的语言（可选）
   ================================================================ */

(function () {
    'use strict';

    const RAIN_SRC = 'picture/rain-loop.mp3';
    const RAIN_VOLUME = 0.6;
    const LONG_PRESS_MS = 3000;

    let _rainAudio = null;
    let _pressTimer = null;
    let _isShowing = false;
    let _styleInjected = false;

    /* ---------- 注入样式（只注入一次，避免污染 style.css） ---------- */
    function injectStyleOnce() {
        if (_styleInjected) return;
        _styleInjected = true;

        const css = `
.qx-rain-modal {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: none;
    background: #0b0f14;
    opacity: 0;
    transition: opacity 0.6s ease;
}
.qx-rain-modal.active {
    display: block;
    opacity: 1;
}
.qx-rain-stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #0b0f14;
}
.qx-rain-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.72) saturate(0.88);
    transform-origin: center center;
    animation: qxRainBreathe 9s ease-in-out infinite;
    will-change: transform, opacity;
}
@keyframes qxRainBreathe {
    0%, 100% { transform: scale(1.00); opacity: 0.90; }
    50%      { transform: scale(1.045); opacity: 1.00; }
}
.qx-rain-caption {
    position: absolute;
    left: 0; right: 0; bottom: 9vh;
    text-align: center;
    pointer-events: none;
    color: #f4f7fb;
    text-shadow: 0 2px 12px rgba(0,0,0,0.55);
}
.qx-rain-title {
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 1px;
    margin-bottom: 10px;
    opacity: 0.96;
}
.qx-rain-hint {
    font-size: 14px;
    opacity: 0.72;
    letter-spacing: 0.5px;
}
body.qx-rain-active {
    overflow: hidden;
}
`;
        const styleEl = document.createElement('style');
        styleEl.id = 'qx_rain_style';
        styleEl.appendChild(document.createTextNode(css));
        document.head.appendChild(styleEl);
    }

    /* ---------- 取得主图 src ---------- */
    function pickBackgroundSrc() {
        const bg = document.getElementById('qx0_bg');
        if (bg && bg.src) return bg.src;
        if (window.mQxb && window.mQxb.UserImage) {
            return `picture/${window.mQxb.UserImage}`;
        }
        return 'picture/qxbaouser1.jpg';
    }

    /* ---------- 开始雨声 ---------- */
    function startRain() {
        if (_isShowing) return;

        injectStyleOnce();

        const modal = document.getElementById('qx_rain_modal');
        const bgImg = document.getElementById('qx_rain_bg');
        if (!modal || !bgImg) {
            console.warn('[rain] 缺少浮层 DOM，请检查 index.html');
            return;
        }

        // 画面
        bgImg.src = pickBackgroundSrc();
        document.body.classList.add('qx-rain-active');
        modal.classList.add('active');
        _isShowing = true;

        // 雨声
        try {
            _rainAudio = new Audio(RAIN_SRC);
            _rainAudio.loop = true;          // 原生无缝循环
            _rainAudio.volume = RAIN_VOLUME;
            _rainAudio.preload = 'auto';
            _rainAudio.play().catch(err => {
                console.warn('[rain] 播放失败，可能缺少 MP3 或浏览器拦截', err);
            });
        } catch (e) {
            console.warn('[rain] 创建音频失败', e);
            _rainAudio = null;
        }

        // 轻微震动反馈（支持的设备才有）
        try { if (navigator.vibrate) navigator.vibrate(40); } catch (e) {}
    }

    /* ---------- 停止雨声 ---------- */
    function stopRain() {
        if (!_isShowing) return;

        if (_rainAudio) {
            try {
                _rainAudio.pause();
                _rainAudio.currentTime = 0;
            } catch (e) {}
            _rainAudio = null;
        }

        const modal = document.getElementById('qx_rain_modal');
        if (modal) modal.classList.remove('active');

        document.body.classList.remove('qx-rain-active');
        _isShowing = false;
    }

    /* ---------- 隐藏触发：长按品牌标题 3 秒 ---------- */
    function bindLongPressTrigger() {
        const titleEl = document.getElementById('status_title');
        if (!titleEl) {
            console.warn('[rain] 找不到 #status_title，隐藏触发未挂载');
            return;
        }

        titleEl.style.cursor = 'default';
        titleEl.style.userSelect = 'none';
        titleEl.style.webkitUserSelect = 'none';
        titleEl.style.webkitTouchCallout = 'none';

        const begin = (ev) => {
            if (_isShowing) return;
            cancelPress();
            _pressTimer = setTimeout(() => {
                _pressTimer = null;
                startRain();
            }, LONG_PRESS_MS);
        };

        const cancelPress = () => {
            if (_pressTimer) {
                clearTimeout(_pressTimer);
                _pressTimer = null;
            }
        };

        titleEl.addEventListener('mousedown', begin);
        titleEl.addEventListener('mouseup', cancelPress);
        titleEl.addEventListener('mouseleave', cancelPress);

        titleEl.addEventListener('touchstart', (e) => {
            begin(e);
        }, { passive: true });

        titleEl.addEventListener('touchend', cancelPress);
        titleEl.addEventListener('touchcancel', cancelPress);
        titleEl.addEventListener('touchmove', cancelPress, { passive: true });

        // 长按结束不应触发点击等默认行为
        titleEl.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /* ---------- 轻触任意处停止 ---------- */
    function bindStopGesture() {
        document.addEventListener('click', (e) => {
            if (!_isShowing) return;
            const modal = document.getElementById('qx_rain_modal');
            if (modal && modal.contains(e.target)) {
                stopRain();
            }
        }, true);

        document.addEventListener('touchstart', (e) => {
            if (!_isShowing) return;
            const modal = document.getElementById('qx_rain_modal');
            if (modal && modal.contains(e.target)) {
                // 阻止 touchstart 后触发的 click 重复处理
                e.stopPropagation();
                stopRain();
            }
        }, { capture: true, passive: true });

        // 页面被系统回收 / 切后台不自动停，保持锁屏可继续听
        // 仅在页面真正 unload 时清理，避免资源泄漏
        window.addEventListener('pagehide', () => {
            if (!_isShowing) return;
            // 不强停，仅释放引用，音频由浏览器接管
        });
    }

    /* ---------- 对外挂载 ---------- */
    window.initRainSleepTrigger = function () {
        bindLongPressTrigger();
        bindStopGesture();
    };

    // 若 qx0_main.js 的 DOMContentLoaded 已跑过，提供兜底
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // 稍等，确保 qx0_main 已经执行过且 status_title 存在
        setTimeout(() => {
            if (!window._qxRainBound) {
                window._qxRainBound = true;
                window.initRainSleepTrigger();
            }
        }, 0);
    }
})();