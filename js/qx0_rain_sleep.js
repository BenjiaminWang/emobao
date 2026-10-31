/* ================================================================
   情绪宝 - 睡眠雨声助眠（隐藏功能）
   v4 (2026-10-31) - 终极兼容版
   - 触发：双击状态栏的日期 (#status_date) 或 右上角用户名 (#status_user)
   - 播放：本地音频无限循环
   ================================================================ */

(function () {
    'use strict';

    const RAIN_SRC = 'picture/rain-loop.mp3';
    const RAIN_VOLUME = 0.6;
    
    let _rainAudio = null;
    let _isShowing = false;
    let _styleInjected = false;
    let _lastTapTime = 0;

    /* ---------- 注入样式 ---------- */
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
    50%      { transform: scale(1.04); opacity: 1.00; }
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
    transition: all 0.3s ease;
}
body.qx-rain-active {
    overflow: hidden;
}
/* 防止手机端双击缩放 */
.qx-no-dbl-tap {
    touch-action: manipulation;
}
`;
        const styleEl = document.createElement('style');
        styleEl.id = 'qx_rain_style';
        styleEl.appendChild(document.createTextNode(css));
        document.head.appendChild(styleEl);
    }

    function pickBackgroundSrc() {
        const bg = document.getElementById('qx0_bg');
        if (bg && bg.src) return bg.src;
        if (window.mQxb && window.mQxb.UserImage) {
            return `picture/${window.mQxb.UserImage}`;
        }
        return 'picture/qxbaouser1.jpg';
    }

    function startRain() {
        if (_isShowing) return;

        injectStyleOnce();

        const modal = document.getElementById('qx_rain_modal');
        const bgImg = document.getElementById('qx_rain_bg');
        if (!modal || !bgImg) {
            console.warn('[rain] 缺少浮层 DOM，请检查 index.html');
            return;
        }

        bgImg.src = pickBackgroundSrc();
        document.body.classList.add('qx-rain-active');
        modal.classList.add('active');
        _isShowing = true;

        try {
            _rainAudio = new Audio(RAIN_SRC);
            _rainAudio.loop = true;
            _rainAudio.volume = RAIN_VOLUME;
            _rainAudio.preload = 'auto';
            
            // 尝试直接播放，因为点击事件里通常能过
            let playPromise = _rainAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.warn('[rain] 自动播放被拦截，等待用户点击', err);
                    const hint = document.getElementById('qx_rain_hint');
                    if (hint) {
                        hint.innerText = "👆 请轻触屏幕任意位置开始播放雨声";
                        hint.style.color = "#FFD600"; 
                        hint.style.opacity = "1";
                    }
                });
            }
        } catch (e) {
            console.warn('[rain] 创建音频失败', e);
            _rainAudio = null;
        }
    }

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
        
        const hint = document.getElementById('qx_rain_hint');
        if (hint) {
            hint.innerText = "轻触屏幕任意处，停止雨声";
            hint.style.color = ""; 
            hint.style.opacity = "0.72";
        }

        _isShowing = false;
    }

    /* ---------- 触发逻辑：双击左上角日期或右上角用户 ---------- */
    function bindTapTrigger() {
        // 给整个状态栏加上 touch-action，防止双击缩放
        const statusBar = document.querySelector('.qx0-status-bar');
        if (statusBar) statusBar.classList.add('qx-no-dbl-tap');

        document.addEventListener('click', (e) => {
            if (_isShowing) return;
            
            const dateEl = document.getElementById('status_date');
            const userEl = document.getElementById('status_user');
            
            const isDate = dateEl && dateEl.contains(e.target);
            const isUser = userEl && userEl.contains(e.target);
            
            if (isDate || isUser) {
                const now = Date.now();
                // 两次点击间隔在 300ms 内视为双击
                if (now - _lastTapTime < 300) {
                    startRain();
                    if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                }
                _lastTapTime = now;
            }
        });
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
    }

    window.initRainSleepTrigger = function () {
        bindTapTrigger();
        bindStopGesture();
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            if (!window._qxRainBound) {
                window._qxRainBound = true;
                window.initRainSleepTrigger();
            }
        }, 0);
    }
})();