/* ================================================================
   情绪宝 - 情绪温度计
   v4：
   - 色带"冷→暖" 9 色
   - 柱身(粗) + 顶部圆头 + 底部细尾(1/2 宽, 1/8 高, 纯黑, 同轴)
   - render 复用 svg，不再清空重建
   - paint 加 try/catch
   ================================================================ */

   (function () {
    'use strict';

    /* 从底到顶：9 → 1，冷→暖 */
    const SEGMENTS = [
        { code: 9, color: '#1A1A2E' },  /* 悲伤 · 深靛 */
        { code: 8, color: '#3B3B98' },  /* 忧伤 · 靛蓝 */
        { code: 7, color: '#5B6C8F' },  /* 压抑 · 灰蓝 */
        { code: 6, color: '#4CAF50' },  /* 平静 · 明绿 */
        { code: 5, color: '#66BB6A' },  /* 明朗 · 亮绿 */
        { code: 4, color: '#AED581' },  /* 轻快 · 黄绿 */
        { code: 3, color: '#FFD54F' },  /* 欢快 · 明黄 */
        { code: 2, color: '#FF9800' },  /* 热烈 · 橙 */
        { code: 1, color: '#E53935' },  /* 焦躁 · 红 */
    ];

    const WHITE = '#FFFFFF';
    const OUTLINE = '#B8D4E8';
    const SEPARATOR = '#FFFFFF';
    const TAIL_COLOR = '#000000';

    /* viewBox：总高 800 */
    const VW = 100;
    const VH = 800;

    /* 柱身：宽 100，y 0–700，圆角 50 */
    const BODY_X = 0;
    const BODY_Y = 0;
    const BODY_W = 100;
    const BODY_H = 700;
    const BODY_R = 50;

    /* 细尾：宽 50（柱身一半），y 700–800，居中 x 25–75，圆角 25 */
    const TAIL_X = 25;
    const TAIL_Y = 700;
    const TAIL_W = 50;
    const TAIL_H = 100;
    const TAIL_R = 25;

    /* 9 段均分柱身高度 */
    const SEG_H = BODY_H / SEGMENTS.length;

    function buildSvg() {
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.classList.add('qx-thermometer-svg');
        svg.style.display = 'block';
        svg.style.width = '100%';
        svg.style.height = '100%';
        return svg;
    }

    function paint(svg, code) {
        const svgNS = 'http://www.w3.org/2000/svg';

        while (svg.firstChild) svg.removeChild(svg.firstChild);

        const defs = document.createElementNS(svgNS, 'defs');

        /* clipPath：只裁柱身范围（色块只画在柱身里） */
        const clipPath = document.createElementNS(svgNS, 'clipPath');
        clipPath.setAttribute('id', 'qxTempClipBody');
        const clipBody = document.createElementNS(svgNS, 'rect');
        clipBody.setAttribute('x', BODY_X);
        clipBody.setAttribute('y', BODY_Y);
        clipBody.setAttribute('width', BODY_W);
        clipBody.setAttribute('height', BODY_H);
        clipBody.setAttribute('rx', BODY_R);
        clipBody.setAttribute('ry', BODY_R);
        clipPath.appendChild(clipBody);
        defs.appendChild(clipPath);

        /* 发光滤镜 */
        const filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', 'qxTempGlow');
        filter.setAttribute('x', '-30%');
        filter.setAttribute('y', '-30%');
        filter.setAttribute('width', '160%');
        filter.setAttribute('height', '160%');
        const feGaussian = document.createElementNS(svgNS, 'feGaussianBlur');
        feGaussian.setAttribute('stdDeviation', '3');
        feGaussian.setAttribute('result', 'blur');
        const feMerge = document.createElementNS(svgNS, 'feMerge');
        const feMergeNode1 = document.createElementNS(svgNS, 'feMergeNode');
        feMergeNode1.setAttribute('in', 'blur');
        const feMergeNode2 = document.createElementNS(svgNS, 'feMergeNode');
        feMergeNode2.setAttribute('in', 'SourceGraphic');
        feMerge.appendChild(feMergeNode1);
        feMerge.appendChild(feMergeNode2);
        filter.appendChild(feGaussian);
        filter.appendChild(feMerge);
        defs.appendChild(filter);

        svg.appendChild(defs);

        /* 1. 柱身白底 */
        const bgBody = document.createElementNS(svgNS, 'rect');
        bgBody.setAttribute('x', BODY_X);
        bgBody.setAttribute('y', BODY_Y);
        bgBody.setAttribute('width', BODY_W);
        bgBody.setAttribute('height', BODY_H);
        bgBody.setAttribute('rx', BODY_R);
        bgBody.setAttribute('ry', BODY_R);
        bgBody.setAttribute('fill', WHITE);
        svg.appendChild(bgBody);

        /* 2. 色块（受柱身 clip 限制） */
        const g = document.createElementNS(svgNS, 'g');
        g.setAttribute('clip-path', 'url(#qxTempClipBody)');

        let litTopIndex = -1;
        if (code != null) {
            for (let i = 0; i < SEGMENTS.length; i++) {
                if (SEGMENTS[i].code === code) { litTopIndex = i; break; }
            }
        }

        for (let i = 0; i < SEGMENTS.length; i++) {
            const y = BODY_H - (i + 1) * SEG_H;
            const seg = SEGMENTS[i];
            const lit = (litTopIndex >= 0 && i <= litTopIndex);

            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', BODY_X);
            rect.setAttribute('y', y);
            rect.setAttribute('width', BODY_W);
            rect.setAttribute('height', SEG_H + 0.5);
            rect.setAttribute('fill', lit ? seg.color : WHITE);

            if (lit && i === litTopIndex) {
                rect.setAttribute('filter', 'url(#qxTempGlow)');
            }
            g.appendChild(rect);

            if (i > 0) {
                const line = document.createElementNS(svgNS, 'line');
                line.setAttribute('x1', BODY_X);
                line.setAttribute('x2', BODY_X + BODY_W);
                line.setAttribute('y1', y + SEG_H);
                line.setAttribute('y2', y + SEG_H);
                line.setAttribute('stroke', SEPARATOR);
                line.setAttribute('stroke-width', 1.2);
                g.appendChild(line);
            }
        }

        svg.appendChild(g);

        /* 3. 柱身外描边 */
        const outlineBody = document.createElementNS(svgNS, 'rect');
        outlineBody.setAttribute('x', BODY_X + 0.75);
        outlineBody.setAttribute('y', BODY_Y + 0.75);
        outlineBody.setAttribute('width', BODY_W - 1.5);
        outlineBody.setAttribute('height', BODY_H - 1.5);
        outlineBody.setAttribute('rx', BODY_R - 0.75);
        outlineBody.setAttribute('ry', BODY_R - 0.75);
        outlineBody.setAttribute('fill', 'none');
        outlineBody.setAttribute('stroke', OUTLINE);
        outlineBody.setAttribute('stroke-width', 1.5);
        svg.appendChild(outlineBody);

        /* 4. 底部细尾（纯黑，同轴，无描边） */
        const tail = document.createElementNS(svgNS, 'rect');
        tail.setAttribute('x', TAIL_X);
        tail.setAttribute('y', TAIL_Y);
        tail.setAttribute('width', TAIL_W);
        tail.setAttribute('height', TAIL_H);
        tail.setAttribute('rx', TAIL_R);
        tail.setAttribute('ry', TAIL_R);
        tail.setAttribute('fill', TAIL_COLOR);
        svg.appendChild(tail);
    }

    function render(hostEl, code) {
        if (!hostEl) return;
        let svg = hostEl.querySelector('svg.qx-thermometer-svg');
        if (!svg) {
            svg = buildSvg();
            hostEl.appendChild(svg);
        }
        try {
            paint(svg, code);
        } catch (e) {
            console.error('[qxThermometer] paint 失败', e);
        }
    }

    function clear(hostEl) {
        if (!hostEl) return;
        hostEl.innerHTML = '';
    }

    window.qxThermometer = {
        render: render,
        clear: clear,
    };

})();