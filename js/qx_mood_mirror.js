/* ================================================================
   js/qx_mood_mirror.js   v9
   日期：2026-09-29
   改动：
   - 支持 thermometerSide: 'left' | 'right'
   - 在魔镜容器里挂情绪温度计（外部组件 qxThermometer）
   - 其余同 v8
   ================================================================ */
   (function () {
    'use strict';

    const FACE_API_LIB = 'js/face-api/face-api.js';
    const FACE_API_MODEL_PATH = 'js/face-api/models';
    const FACE_DETECT_INPUT_SIZE = 224;
    const FACE_DETECT_SCORE = 0.4;
    const EXPRESSION_MIN_CONFIDENCE = 0.6;

    const FRAME_IMG = 'picture/qx_mirror_frame.png';

    const EXPRESSION_TO_EMOTION = {
        happy:     4,
        neutral:   6,
        sad:       8,
        angry:     2,
        surprised: 3,
        fearful:   1,
        disgusted: 7,
    };
    const EXPRESSION_KEYS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];

    let faceApiLoaded = false;
    let faceApiLoading = false;
    let faceApiLoadPromise = null;

    const instances = {};

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    function getEmotionInfo(code) {
        if (!window.qxEmotionWheel || !window.qxEmotionWheel.EMOTION_LIST) return null;
        return window.qxEmotionWheel.EMOTION_LIST.find(x => x.code === code) || null;
    }
    function getEmotionFacePath(code) {
        const info = getEmotionInfo(code);
        if (!info) return '';
        return `picture/${info.code}_${info.cn}.png`;
    }
    function getEmotionName(code) {
        const info = getEmotionInfo(code);
        if (!info) return '';
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 2 ? info.en : info.cn;
    }

    function loadFaceApiLib() {
        return new Promise((resolve, reject) => {
            if (window.faceapi) { resolve(); return; }
            const existing = document.querySelector('script[data-face-api="1"]');
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () => reject(new Error('face-api 库加载失败')));
                return;
            }
            const s = document.createElement('script');
            s.src = FACE_API_LIB;
            s.async = true;
            s.dataset.faceApi = '1';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('face-api 库加载失败'));
            document.head.appendChild(s);
        });
    }

    async function ensureFaceApiLoaded() {
        if (faceApiLoaded) return true;
        if (faceApiLoading) return faceApiLoadPromise;
        faceApiLoading = true;
        faceApiLoadPromise = (async () => {
            try {
                await loadFaceApiLib();
                if (!window.faceapi) throw new Error('faceapi 未就绪');
                await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_PATH);
                await window.faceapi.nets.faceExpressionNet.loadFromUri(FACE_API_MODEL_PATH);
                faceApiLoaded = true;
                faceApiLoading = false;
                console.log('[qxMoodMirror] face-api 已加载');
                return true;
            } catch (e) {
                faceApiLoading = false;
                console.error('[qxMoodMirror] face-api 加载失败', e);
                return false;
            }
        })();
        return faceApiLoadPromise;
    }

    async function detectFromVideo(videoEl) {
        if (!videoEl) return { ok: false, reason: 'ERROR' };
        const ok = await ensureFaceApiLoaded();
        if (!ok) return { ok: false, reason: 'NO_API' };
        try {
            const options = new window.faceapi.TinyFaceDetectorOptions({
                inputSize: FACE_DETECT_INPUT_SIZE,
                scoreThreshold: FACE_DETECT_SCORE,
            });
            const result = await window.faceapi
                .detectSingleFace(videoEl, options)
                .withFaceExpressions();
            if (!result) return { ok: false, reason: 'NO_FACE' };
            const exprs = result.expressions || {};
            let bestKey = null, bestVal = -1;
            EXPRESSION_KEYS.forEach(k => {
                const v = exprs[k] || 0;
                if (v > bestVal) { bestVal = v; bestKey = k; }
            });
            if (!bestKey || bestVal < EXPRESSION_MIN_CONFIDENCE) {
                return { ok: false, reason: 'LOW_CONF' };
            }
            const code = EXPRESSION_TO_EMOTION[bestKey];
            if (!code) return { ok: false, reason: 'LOW_CONF' };
            return { ok: true, code, expression: bestKey, confidence: bestVal };
        } catch (e) {
            console.error('[qxMoodMirror] 识别失败', e);
            return { ok: false, reason: 'ERROR' };
        }
    }

    function createHiddenVideo() {
        const wrap = document.createElement('div');
        wrap.style.position = 'absolute';
        wrap.style.width = '1px';
        wrap.style.height = '1px';
        wrap.style.overflow = 'hidden';
        wrap.style.opacity = '0';
        wrap.style.pointerEvents = 'none';
        const video = document.createElement('video');
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        wrap.appendChild(video);
        document.body.appendChild(wrap);
        return { wrap, video };
    }
    async function openCamera(video) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('浏览器不支持摄像头');
        }
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
            });
        }
        video.srcObject = stream;
        await video.play();
        return stream;
    }
    function closeCamera(stream, video) {
        if (stream) stream.getTracks().forEach(tr => { try { tr.stop(); } catch (e) {} });
        if (video) {
            try { video.pause(); } catch (e) {}
            video.srcObject = null;
        }
    }

    /* ============ 渲染 ============ */
    function render(state) {
        const box = state.container;
        if (!box) return;
        box.innerHTML = '';
        box.classList.add('qx-mm-container');
        box.classList.toggle('qx-mm-passive', !state.doIt);
        box.classList.toggle('qx-mm-picking', false);

        const frame = document.createElement('div');
        frame.className = 'qx-mm-frame';

        const frameImg = document.createElement('img');
        frameImg.className = 'qx-mm-frame-img';
        frameImg.src = FRAME_IMG;
        frameImg.alt = '';
        frame.appendChild(frameImg);

        const wheelBox = document.createElement('div');
        wheelBox.className = 'qx-mm-wheel-box';
        wheelBox.id = state.id + '_wheel';
        frame.appendChild(wheelBox);

        const faceBox = document.createElement('div');
        faceBox.className = 'qx-mm-face-box';
        const faceImg = document.createElement('img');
        faceImg.className = 'qx-mm-face-img';
        faceImg.alt = '';
        faceBox.appendChild(faceImg);
        frame.appendChild(faceBox);
        state.faceImgEl = faceImg;
        state.faceBoxEl = faceBox;

        const sleepBox = document.createElement('div');
        sleepBox.className = 'qx-mm-sleep-box';
        sleepBox.innerHTML = `
            <svg viewBox="0 0 100 100" class="qx-mm-sleep-svg" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="46" fill="rgba(255,255,255,0.55)" stroke="#B8A76E" stroke-width="1.5"/>
                <path d="M 30 48 Q 36 54 42 48" fill="none" stroke="#96A3B8" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M 58 48 Q 64 54 70 48" fill="none" stroke="#96A3B8" stroke-width="2.5" stroke-linecap="round"/>
                <path d="M 42 68 Q 50 74 58 68" fill="none" stroke="#96A3B8" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
        `;
        frame.appendChild(sleepBox);
        state.sleepBoxEl = sleepBox;

        const hint = document.createElement('div');
        hint.className = 'qx-mm-hint';
        frame.appendChild(hint);
        state.hintEl = hint;

        frame.addEventListener('click', (e) => {
            if (!state.doIt) return;
            if (box.classList.contains('qx-mm-picking')) return;
            const insideWheel = e.target.closest('.qx-wheel-svg');
            if (insideWheel) return;
            runDetect(state);
        });

        box.appendChild(frame);

        /* 情绪温度计容器 */
        const tempSide = state.thermometerSide || '';
        if (tempSide === 'left' || tempSide === 'right') {
            const tempWrap = document.createElement('div');
            tempWrap.className = 'qx-mm-thermometer qx-mm-thermometer-' + tempSide;
            tempWrap.id = state.id + '_thermometer';
            box.appendChild(tempWrap);
            state.thermometerEl = tempWrap;
        } else {
            state.thermometerEl = null;
        }

        if (state.doIt) {
            const dot = document.createElement('div');
            dot.className = 'qx-mm-yellow-dot';
            dot.title = t('手动选择', 'Manual pick');
            box.appendChild(dot);
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePicking(state);
            });
        }

        if (!window.qxEmotionWheel) {
            console.error('[qxMoodMirror] 缺少 qxEmotionWheel');
            return;
        }

        state.wheelId = window.qxEmotionWheel.create(wheelBox.id, {
            value: (state.value != null && state.value !== 0) ? state.value : null,
            verticalShift: 0,
            onChange: (code) => {
                state.value = code;
                if (state.onChange) state.onChange(code);
                if (state.container.classList.contains('qx-mm-picking')) {
                    setTimeout(() => {
                        if (state.value != null) {
                            state.container.classList.remove('qx-mm-picking');
                            updateFace(state);
                        }
                    }, 400);
                } else {
                    updateFace(state);
                }
            }
        });

        updateFace(state);
    }

    function updateFace(state) {
        const isPicking = state.container.classList.contains('qx-mm-picking');
        const hasVal = state.value != null && state.value !== 0;

        if (state.faceBoxEl) {
            state.faceBoxEl.style.display = (!isPicking && hasVal) ? 'flex' : 'none';
        }
        if (state.faceImgEl && hasVal) {
            state.faceImgEl.src = getEmotionFacePath(state.value);
        }
        if (state.sleepBoxEl) {
            state.sleepBoxEl.style.display = (!isPicking && !hasVal) ? 'flex' : 'none';
        }

        const wheelBox = state.container.querySelector('.qx-mm-wheel-box');
        if (wheelBox) {
            wheelBox.style.display = (isPicking) ? 'flex' : 'none';
        }

        const nameMap = {
            qx2_wheel_before: 'qx2_face_before_name',
            qx2_wheel_after:  'qx2_face_after_name',
        };
        const nameElId = nameMap[state.id];
        if (nameElId) {
            const nameEl = document.getElementById(nameElId);
            if (nameEl) {
                nameEl.innerText = hasVal ? getEmotionName(state.value) : '--';
            }
        }

        if (state.hintEl && !state.busy) {
            state.hintEl.style.display = 'none';
            state.hintEl.textContent = '';
        }

        /* 温度计同步 */
        if (state.thermometerEl && window.qxThermometer) {
            window.qxThermometer.render(state.thermometerEl, hasVal ? state.value : null);
        }
    }

    function setHint(state, text) {
        if (!state.hintEl) return;
        if (text) {
            state.hintEl.textContent = text;
            state.hintEl.style.display = 'block';
        } else {
            state.hintEl.textContent = '';
            state.hintEl.style.display = 'none';
        }
    }
    function setBusy(state, busy) {
        state.busy = busy;
        if (state.container) state.container.classList.toggle('qx-mm-busy', busy);
    }

    function togglePicking(state) {
        if (!state.doIt) return;
        const picking = state.container.classList.toggle('qx-mm-picking');
        updateFace(state);
        if (picking) setHint(state, t('请手动选择', 'Please pick manually'));
        else setHint(state, '');
    }

    async function runDetect(state) {
        if (!state.doIt) return;
        if (state.busy) return;
        state.container.classList.remove('qx-mm-picking');
        setBusy(state, true);
        setHint(state, t('魔镜照一照…', 'Mirror is looking…'));

        let cam = null, videoEl = null;
        try {
            const hidden = createHiddenVideo();
            videoEl = hidden.video;
            cam = await openCamera(videoEl);
            await new Promise(r => setTimeout(r, 400));
            const res = await detectFromVideo(videoEl);
            if (res.ok) {
                state.value = res.code;
                if (state.wheelId) window.qxEmotionWheel.setValue(state.wheelId, res.code);
                updateFace(state);
                setHint(state, '');
                if (state.onChange) state.onChange(res.code);
            } else {
                state.value = 0;
                if (state.wheelId) window.qxEmotionWheel.setValue(state.wheelId, null);
                updateFace(state);
                setHint(state, t('请手动选择或再照一次', 'Please pick manually or tap mirror again'));
                if (state.onChange) state.onChange(0);
            }
        } catch (e) {
            console.error('[qxMoodMirror] 识别流程失败', e);
            state.value = 0;
            if (state.wheelId) window.qxEmotionWheel.setValue(state.wheelId, null);
            updateFace(state);
            setHint(state, t('摄像头不可用', 'Camera unavailable'));
            if (state.onChange) state.onChange(0);
        } finally {
            closeCamera(cam, videoEl);
            if (videoEl && videoEl.parentElement && videoEl.parentElement.parentElement) {
                videoEl.parentElement.parentElement.removeChild(videoEl.parentElement);
            }
            setBusy(state, false);
        }
    }

    function create(containerId, options) {
        options = options || {};
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('qxMoodMirror: 找不到容器', containerId);
            return null;
        }
        if (instances[containerId]) destroy(containerId);

        const code = (options.initialCode == null) ? 0 : parseInt(options.initialCode);
        const doIt = (options.doIt === '不做') ? false : true;

        const state = {
            id: containerId,
            container: container,
            mode: options.mode || '今日情绪',
            value: (code === 0) ? 0 : code,
            doIt: doIt,
            onChange: options.onChange || function () {},
            wheelId: null,
            faceImgEl: null,
            faceBoxEl: null,
            sleepBoxEl: null,
            hintEl: null,
            busy: false,
            thermometerSide: options.thermometerSide || '',
            thermometerEl: null,
        };

        instances[containerId] = state;
        render(state);

        if (!state.doIt) {
            updateFace(state);
            return containerId;
        }

        if (state.value !== 0 && state.wheelId) {
            window.qxEmotionWheel.setValue(state.wheelId, state.value);
            updateFace(state);
        } else {
            updateFace(state);
        }

        return containerId;
    }

    function getValue(containerId) {
        const s = instances[containerId];
        return s ? s.value : 0;
    }
    function setValue(containerId, code) {
        const s = instances[containerId];
        if (!s) return;
        s.value = (code == null ? 0 : code);
        if (s.wheelId) window.qxEmotionWheel.setValue(s.wheelId, s.value === 0 ? null : s.value);
        updateFace(s);
    }
    function setDoIt(containerId, doIt) {
        const s = instances[containerId];
        if (!s) return;
        s.doIt = (doIt === '不做') ? false : true;
        s.container.classList.toggle('qx-mm-passive', !s.doIt);
        const opts = {
            mode: s.mode,
            initialCode: s.value,
            doIt: s.doIt ? '做' : '不做',
            onChange: s.onChange,
            thermometerSide: s.thermometerSide,
        };
        create(containerId, opts);
    }
    function destroy(containerId) {
        const s = instances[containerId];
        if (!s) return;
        if (s.thermometerEl && window.qxThermometer) {
            try { window.qxThermometer.clear(s.thermometerEl); } catch (e) {}
            s.thermometerEl = null;
        }
        if (s.wheelId) {
            try { window.qxEmotionWheel.destroy(s.wheelId); } catch (e) {}
        }
        s.container.innerHTML = '';
        s.container.classList.remove('qx-mm-container', 'qx-mm-busy', 'qx-mm-picking', 'qx-mm-passive');
        delete instances[containerId];
    }

    function preload() { return ensureFaceApiLoaded(); }

    window.qxMoodMirror = {
        create: create,
        getValue: getValue,
        setValue: setValue,
        setDoIt: setDoIt,
        destroy: destroy,
        preload: preload,
        _detectFromVideo: detectFromVideo,
        EXPRESSION_TO_EMOTION: EXPRESSION_TO_EMOTION,
    };

})();