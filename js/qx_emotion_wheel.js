/* ================================================================
   情绪宝 - 九情绪旋钮组件（公共）
   v10：
   - 新增 verticalShift 选项（默认 0.06）
   - 魔镜传 0，实现同心
   ================================================================ */

   (function () {
    'use strict';

    const EMOTION_COLORS = {
        1: '#E60000',
        2: '#FF4500',
        3: '#FF69B4',
        4: '#00C853',
        5: '#4CAF50',
        6: '#1B5E20',
        7: '#616161',
        8: '#0D47A1',
        9: '#000000',
    };

    const EMOTION_LIST = [
        { code: 1, cn: '焦躁', en: 'Irritable' },
        { code: 2, cn: '热烈', en: 'Passionate' },
        { code: 3, cn: '欢快', en: 'Cheerful' },
        { code: 4, cn: '轻快', en: 'Lively' },
        { code: 5, cn: '明朗', en: 'Bright' },
        { code: 6, cn: '平静', en: 'Calm' },
        { code: 7, cn: '压抑', en: 'Depressed' },
        { code: 8, cn: '忧伤', en: 'Melancholy' },
        { code: 9, cn: '悲伤', en: 'Sad' },
    ];

    const CODE_TO_ANGLE = {
        9: 240, 8: 270, 7: 300, 6: 330, 5: 0,
        4: 30, 3: 60, 2: 90, 1: 120,
    };

    const UNKNOWN_ANGLE = 180;
    const FACE_R_RATIO = 0.98;
    const POINTER_OUT_RATIO = 0.96;
    const POINTER_IN_RATIO  = 0.80;
    const RING_PADDING = 22;

    /* 垂直偏移：默认 0.06（qx1 用），魔镜传 0 实现同心 */
    const DEFAULT_VERTICAL_SHIFT = 0.06;

    function angleToCode(angle) {
        angle = ((angle % 360) + 360) % 360;
        const angles = Object.entries(CODE_TO_ANGLE).map(([code, a]) => ({
            code: parseInt(code), angle: a,
        }));
        let best = null, bestDist = Infinity;
        angles.forEach(({ code, angle: a }) => {
            let d = Math.abs(angle - a);
            if (d > 180) d = 360 - d;
            if (d < bestDist) { bestDist = d; best = code; }
        });
        return best;
    }

    function codeToAngle(code) { return CODE_TO_ANGLE[code] ?? 0; }

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    function getEmotionName(code) {
        const e = EMOTION_LIST.find(x => x.code === code);
        if (!e) return '';
        return t(e.cn, e.en);
    }

    function getEmotionFace(code) {
        const e = EMOTION_LIST.find(x => x.code === code);
        if (!e) return '';
        return `picture/${e.code}_${e.cn}.png`;
    }

    const instances = {};

    function create(containerId, options) {
        options = options || {};
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('qxEmotionWheel: 找不到容器', containerId);
            return null;
        }

        const wheelId = containerId;
        if (instances[wheelId]) destroy(wheelId);

        const vs = (options.verticalShift == null) ? DEFAULT_VERTICAL_SHIFT : options.verticalShift;

        const state = {
            wheelId: wheelId,
            container: container,
            value: options.value ?? null,
            onChange: options.onChange || function () {},
            size: options.size || 0,
            verticalShift: vs,
            isPointerDown: false,
            svg: null,
            pointerEl: null,
            faceEl: null,
            emptyEl: null,
            nameEl: null,
        };

        instances[wheelId] = state;
        renderWheel(state);
        bindEvents(state);
        return wheelId;
    }

    function renderWheel(state) {
        const container = state.container;
        container.innerHTML = '';
        container.classList.add('qx-wheel-container');

        const rect = container.getBoundingClientRect();
        let size = Math.min(rect.width, rect.height);
        if (!size || size < 80) size = computeSize();
        if (state.size) size = state.size;
        state.size = size;

        const r = size / 2;
        const ringR = r - RING_PADDING;
        const faceR = ringR * FACE_R_RATIO;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.classList.add('qx-wheel-svg');
        state.svg = svg;

        const cx = r;
        const cy = r + ringR * state.verticalShift;

        const arcPath = describeArc(cx, cy, ringR, 240, 120 + 360);
        const arcEl = document.createElementNS(svgNS, 'path');
        arcEl.setAttribute('d', arcPath);
        arcEl.setAttribute('fill', 'none');
        arcEl.setAttribute('stroke', '#E0E0E0');
        arcEl.setAttribute('stroke-width', 1);
        svg.appendChild(arcEl);

        EMOTION_LIST.forEach(e => {
            const angle = codeToAngle(e.code);
            const rad = (angle - 90) * Math.PI / 180;

            const lx = cx + (ringR + 14) * Math.cos(rad);
            const ly = cy + (ringR + 14) * Math.sin(rad);
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', lx);
            label.setAttribute('y', ly);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dominant-baseline', 'middle');
            label.setAttribute('font-size', 10);
            label.setAttribute('fill', EMOTION_COLORS[e.code]);
            label.setAttribute('font-weight', 'bold');
            label.textContent = getEmotionName(e.code);
            label.dataset.code = e.code;
            label.classList.add('qx-wheel-label');
            svg.appendChild(label);
        });

        const faceImg = document.createElementNS(svgNS, 'image');
        faceImg.setAttribute('x', cx - faceR);
        faceImg.setAttribute('y', cy - faceR);
        faceImg.setAttribute('width', faceR * 2);
        faceImg.setAttribute('height', faceR * 2);
        faceImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        faceImg.setAttribute('href', '');
        faceImg.classList.add('qx-wheel-face');
        state.faceEl = faceImg;
        svg.appendChild(faceImg);

        const emptyGroup = document.createElementNS(svgNS, 'g');
        emptyGroup.classList.add('qx-wheel-empty');
        emptyGroup.style.display = 'none';

        const emptyCircle = document.createElementNS(svgNS, 'circle');
        emptyCircle.setAttribute('cx', cx);
        emptyCircle.setAttribute('cy', cy);
        emptyCircle.setAttribute('r', faceR);
        emptyCircle.setAttribute('fill', 'rgba(255,255,255,0.35)');
        emptyCircle.setAttribute('stroke', 'rgba(255,255,255,0.75)');
        emptyCircle.setAttribute('stroke-width', 1);
        emptyGroup.appendChild(emptyCircle);

        const emptyText = document.createElementNS(svgNS, 'text');
        emptyText.setAttribute('x', cx);
        emptyText.setAttribute('y', cy);
        emptyText.setAttribute('text-anchor', 'middle');
        emptyText.setAttribute('dominant-baseline', 'middle');
        emptyText.setAttribute('font-size', Math.max(12, Math.round(faceR * 0.24)));
        emptyText.setAttribute('fill', '#96A3B8');
        emptyText.textContent = t('请选择', 'Please choose');
        emptyGroup.appendChild(emptyText);

        svg.appendChild(emptyGroup);
        state.emptyEl = emptyGroup;

        const nameText = document.createElementNS(svgNS, 'text');
        nameText.setAttribute('x', cx);
        nameText.setAttribute('y', cy + faceR + 4);
        nameText.setAttribute('text-anchor', 'middle');
        nameText.setAttribute('dominant-baseline', 'hanging');
        nameText.setAttribute('font-size', 16);
        nameText.setAttribute('font-weight', 'bold');
        nameText.setAttribute('fill', '#333');
        nameText.classList.add('qx-wheel-center-name');
        state.nameEl = nameText;
        svg.appendChild(nameText);

        const pointerOut = ringR * POINTER_OUT_RATIO;
        const pointerIn  = ringR * POINTER_IN_RATIO;

        const pointer = document.createElementNS(svgNS, 'g');
        pointer.classList.add('qx-wheel-pointer');
        pointer.style.transformOrigin = `${cx}px ${cy}px`;
        pointer.style.transform = `rotate(${state.value == null ? UNKNOWN_ANGLE : codeToAngle(state.value)}deg)`;

        const shaft = document.createElementNS(svgNS, 'line');
        shaft.setAttribute('x1', cx);
        shaft.setAttribute('y1', cy - pointerIn);
        shaft.setAttribute('x2', cx);
        shaft.setAttribute('y2', cy - pointerOut);
        shaft.setAttribute('stroke', '#2C7BE5');
        shaft.setAttribute('stroke-width', 3);
        shaft.setAttribute('stroke-linecap', 'round');
        pointer.appendChild(shaft);

        const headSize = 5;
        const head = document.createElementNS(svgNS, 'polygon');
        head.setAttribute('points', [
            `${cx},${cy - pointerOut - headSize}`,
            `${cx - headSize},${cy - pointerOut + headSize * 0.3}`,
            `${cx + headSize},${cy - pointerOut + headSize * 0.3}`,
        ].join(' '));
        head.setAttribute('fill', '#2C7BE5');
        pointer.appendChild(head);

        state.pointerEl = pointer;
        svg.appendChild(pointer);

        const hitArea = document.createElementNS(svgNS, 'circle');
        hitArea.setAttribute('cx', cx);
        hitArea.setAttribute('cy', cy);
        hitArea.setAttribute('r', ringR);
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'pointer';
        hitArea.classList.add('qx-wheel-hit');
        svg.appendChild(hitArea);

        container.appendChild(svg);
        updateWheel(state);
    }

    function computeSize() {
        const minSide = Math.min(window.innerWidth, window.innerHeight);
        if (minSide < 600) return 180;
        if (minSide < 1024) return 220;
        return 260;
    }

    function polarToCartesian(cx, cy, r, angleDeg) {
        const rad = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function describeArc(cx, cy, r, startAngle, endAngle) {
        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
    }

    function bindEvents(state) {
        const svg = state.svg;
        svg.addEventListener('pointerdown', (ev) => {
            state.isPointerDown = true;
            try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
            handleDrag(state, ev);
        });
        svg.addEventListener('pointermove', (ev) => {
            if (!state.isPointerDown) return;
            handleDrag(state, ev);
        });
        svg.addEventListener('pointerup', (ev) => {
            if (!state.isPointerDown) return;
            state.isPointerDown = false;
            handleDrag(state, ev);
            if (state.onChange) state.onChange(state.value);
        });
        svg.addEventListener('pointercancel', () => { state.isPointerDown = false; });

        svg.querySelectorAll('.qx-wheel-label').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const code = parseInt(el.dataset.code);
                if (!isNaN(code)) {
                    setValue(state.wheelId, code);
                    if (state.onChange) state.onChange(code);
                }
            });
        });
    }

    function handleDrag(state, ev) {
        const svg = state.svg;
        const rect = svg.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const x = ev.clientX - rect.left - cx;
        const y = ev.clientY - rect.top - cy;
        let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
        angle = ((angle % 360) + 360) % 360;
        const code = angleToCode(angle);
        if (code && code !== state.value) {
            state.value = code;
            updateWheel(state);
        }
    }

    function updateWheel(state) {
        const code = state.value;
        const isEmpty = (code == null);

        if (state.pointerEl) {
            const angle = isEmpty ? UNKNOWN_ANGLE : codeToAngle(code);
            state.pointerEl.style.transform = `rotate(${angle}deg)`;
        }

        if (state.faceEl) {
            if (isEmpty) {
                state.faceEl.setAttribute('href', '');
                state.faceEl.style.display = 'none';
            } else {
                state.faceEl.style.display = '';
                state.faceEl.setAttribute('href', getEmotionFace(code));
            }
        }
        if (state.emptyEl) {
            state.emptyEl.style.display = isEmpty ? '' : 'none';
        }

        if (state.nameEl) {
            if (isEmpty) {
                state.nameEl.textContent = '';
            } else {
                state.nameEl.textContent = getEmotionName(code);
                state.nameEl.setAttribute('fill', EMOTION_COLORS[code]);
            }
            state.nameEl.setAttribute('font-size', 16);
        }

        if (state.svg) {
            state.svg.querySelectorAll('.qx-wheel-label').forEach(el => {
                const c = parseInt(el.dataset.code);
                if (c === code) {
                    el.setAttribute('font-size', 13);
                    el.setAttribute('fill', EMOTION_COLORS[c]);
                    el.setAttribute('font-weight', 'bold');
                } else {
                    el.setAttribute('font-size', 10);
                    el.setAttribute('fill', EMOTION_COLORS[c]);
                    el.setAttribute('font-weight', 'normal');
                }
            });
        }
    }

    function getValue(wheelId) {
        const state = instances[wheelId];
        return state ? state.value : null;
    }

    function setValue(wheelId, code) {
        const state = instances[wheelId];
        if (!state) return;
        state.value = (code == null ? null : code);
        updateWheel(state);
    }

    function destroy(wheelId) {
        const state = instances[wheelId];
        if (!state) return;
        state.container.innerHTML = '';
        state.container.classList.remove('qx-wheel-container');
        delete instances[wheelId];
    }

    window.qxEmotionWheel = {
        create: create, getValue: getValue, setValue: setValue, destroy: destroy,
        EMOTION_LIST: EMOTION_LIST, EMOTION_COLORS: EMOTION_COLORS,
    };

})();