/* ================================================================
   情绪宝 - 生活事件影响图（公共）
   用途：qx1 / qx2 共用
   暴露：window.qxLifeEventChart
   v4 改动：
   - renderSummary() 走 t()，英文模式显示 Good total / Bad total
   - NATURE_GOOD / NATURE_BAD 加注释说明这是数据库字段比对值，不能翻译
   - 其余同 v3
   ================================================================ */
   (function () {
    'use strict';

    /* 注意：这两个常量是数据库 eventnature 字段的比对值，必须保持中文字符串，
       翻译它们会导致与后端数据不匹配，汇总永远算出 0 */
    const NATURE_GOOD = '好事';
    const NATURE_BAD = '坏事';

    const IMPACT_FACTOR = {
        1: 0.5,
        2: 1.0,
        3: 1.5,
        4: 2.0,
    };

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    function getEventName(ev) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? (ev.eventname_cn || '') : (ev.eventname_en || '');
    }

    function getSummary(events) {
        let good = 0;
        let bad = 0;
        if (!events || !Array.isArray(events)) {
            return { good, bad };
        }
        events.forEach(ev => {
            const level = parseInt(ev.impactlevel) || 0;
            const factor = IMPACT_FACTOR[level] || 0;
            if (ev.eventnature === NATURE_GOOD) {
                good += factor;
            } else if (ev.eventnature === NATURE_BAD) {
                bad += factor;
            }
        });
        return {
            good: Math.round(good * 10) / 10,
            bad: Math.round(bad * 10) / 10,
        };
    }

    function draw(containerId, events) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w <= 0 || h <= 0) return;

        if (!events || events.length === 0) {
            container.innerHTML = `<div class="qx-chart-empty">${t('待录入', 'To be entered')}</div>`;
            return;
        }

        const list = events.slice(0, 10);

        const svgW = w;
        const svgH = h;
        const paddingTop = 14;
        const paddingBottom = 14;
        const paddingLeft = 8;
        const paddingRight = 8;
        const labelH = 14;

        const chartW = svgW - paddingLeft - paddingRight;
        const chartH = svgH - paddingTop - paddingBottom - labelH * 2;
        const centerY = paddingTop + labelH + chartH / 2;

        const maxBarHeight = chartH / 2;

        const n = list.length;
        const gap = Math.max(12, Math.min(24, chartW / n * 0.5));
        const barW = Math.max(5, Math.min(16, (chartW - gap * (n - 1)) / n));

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
        svg.setAttribute('width', svgW);
        svg.setAttribute('height', svgH);
        svg.classList.add('qx-chart-svg');

        const zeroLine = document.createElementNS(svgNS, 'line');
        zeroLine.setAttribute('x1', paddingLeft);
        zeroLine.setAttribute('x2', svgW - paddingRight);
        zeroLine.setAttribute('y1', centerY);
        zeroLine.setAttribute('y2', centerY);
        zeroLine.setAttribute('stroke', '#999');
        zeroLine.setAttribute('stroke-width', 1);
        zeroLine.setAttribute('stroke-dasharray', '4 3');
        svg.appendChild(zeroLine);

        const totalW = barW * n + gap * (n - 1);
        const startX = paddingLeft + (chartW - totalW) / 2;

        list.forEach((ev, idx) => {
            const nature = ev.eventnature;
            const level = parseInt(ev.impactlevel) || 0;
            const factor = IMPACT_FACTOR[level] || 0;
            const barH = Math.max(2, (factor / 2) * maxBarHeight);

            const x = startX + idx * (barW + gap);
            const isGood = (nature === NATURE_GOOD);

            let y;
            let fill;
            if (isGood) {
                y = centerY - barH;
                fill = '#E53935';
            } else {
                y = centerY;
                fill = '#212121';
            }

            const rect = document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', barW);
            rect.setAttribute('height', barH);
            rect.setAttribute('fill', fill);
            rect.setAttribute('rx', 2);
            svg.appendChild(rect);

            const name = getEventName(ev);
            const nameX = x + barW / 2;
            let nameY;
            if (isGood) {
                nameY = centerY + 3;
            } else {
                nameY = centerY - 3;
            }

            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', nameX);
            text.setAttribute('y', nameY);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', isGood ? 'hanging' : 'auto');
            text.setAttribute('font-size', 9);
            text.setAttribute('fill', '#333');
            text.classList.add('qx-chart-name');
            text.textContent = name.length > 4 ? name.substring(0, 4) + '…' : name;
            svg.appendChild(text);
        });

        container.appendChild(svg);
    }

    function renderSummary(summaryId, events) {
        const el = document.getElementById(summaryId);
        if (!el) return;
        const { good, bad } = getSummary(events);
        el.innerHTML = `
            <div class="qx1-sum-good">${t('好事合计：', 'Good total: ')}${good}</div>
            <div class="qx1-sum-bad">${t('坏事合计：', 'Bad total: ')}${bad}</div>
        `;
    }

    window.qxLifeEventChart = {
        draw: draw,
        getSummary: getSummary,
        renderSummary: renderSummary,
        IMPACT_FACTOR: IMPACT_FACTOR,
    };

})();