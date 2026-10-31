/* ================================================================
   情绪宝 - 睡眠雨声助眠（隐藏功能）
   v2 (2026-10-31)
   - 触发：全局事件监听，长按状态栏品牌标题 #status_title 3 秒
   - 播放：picture/rain-loop.mp3 无限循环（loop=true，无网络请求）
   - 画面：治愈主图轻微呼吸动画，全屏遮罩
   - 停止：轻触屏幕任意处
   - 兼容：手机端长按菜单屏蔽、自动播放拦截提示
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
#status_title {
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    cursor: default;
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
            
            // 尝试播放
            let playPromise = _rainAudio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.warn('[rain] 手机系统拦截了自动播放，需用户点击屏幕', err);
                    // 如果被拦截了，我们在屏幕提示一下用户
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
        
        // 恢复提示文字
        const hint = document.getElementById('qx_rain_hint');
        if (hint) {
            hint.innerText = "轻触屏幕任意处，停止雨声";
            hint.style.color = ""; 
            hint.style.opacity = "0.72";
        }

        _isShowing = false;
    }

    /* ---------- 隐藏触发：全局监听（抗干扰版） ---------- */
    function bindLongPressTrigger() {
        let _isPressing = false;

        const begin = (e) => {
            if (_isShowing) return;
            
            // 找到被长按的元素
            const titleEl = document.getElementById('status_title');
            if (!titleEl) return;
            
            // 判断按下的位置是不是在标题上
            if (titleEl.contains(e.target)) {
                _isPressing = true;
                cancelPress(); // 清空之前的计时
                
                _pressTimer = setTimeout(() => {
                    _pressTimer = null;
                    if (_isPressing) {
                        startRain();
                        // 触发后加点振动反馈，让用户知道长按成功了
                        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    }
                }, LONG_PRESS_MS);
            }
        };

        const cancelPress = () => {
            _isPressing = false;
            if (_pressTimer) {
                clearTimeout(_pressTimer);
                _pressTimer = null;
            }
        };

        // 鼠标事件（Mac 端）
        document.addEventListener('mousedown', begin);
        document.addEventListener('mouseup', cancelPress);
        
        // 触摸事件（手机端）
        document.addEventListener('touchstart', begin, { passive: true });
        // 手指一旦移动或者离开屏幕，立刻取消计时
        document.addEventListener('touchend', cancelPress);
        document.addEventListener('touchcancel', cancelPress);
        document.addEventListener('touchmove', cancelPress, { passive: true });

        // 防止手机端长按弹出“复制/粘贴”菜单
        document.addEventListener('contextmenu', (e) => {
            const titleEl = document.getElementById('status_title');
            if (titleEl && titleEl.contains(e.target)) {
                e.preventDefault(); 
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
        window.addEventListener('pagehide', () => {
            if (!_isShowing) return;
        });
    }

    /* ---------- 对外挂载 ---------- */
    window.initRainSleepTrigger = function () {
        bindLongPressTrigger();
        bindStopGesture();
    };

    // 若 qx0_main.js 的 DOMContentLoaded 已跑过，提供兜底
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => {
            if (!window._qxRainBound) {
                window._qxRainBound = true;
                window.initRainSleepTrigger();
            }
        }, 0);
    }
})();