/* ================================================================
   情绪宝 - 实时治愈主图（qxHealChart）
   v3 改动：
   - 删掉 drawTab1 底部 hint 绘制（不再往画布写字）
   - 其余 v2 不变
   ================================================================ */

   (function () {
    'use strict';

    const COLORS = {
        highA: [110, 231, 183],
        highB: [96, 165, 250],
        midA:  [196, 181, 253],
        lowA:  [129, 140, 248],
        lowB:  [71, 85, 105],
        bg1:   [10, 22, 40],
        bg2:   [12, 40, 34],
        firefly: [255, 214, 100],
        trendLine: [44, 123, 229],
        trendPoint: [255, 214, 100],
        quadrant: [44, 123, 229],
        breath: [110, 231, 183],
        heart: [96, 165, 250],
    };

    let chart = {
        container: null,
        canvas: null,
        ctx: null,
        rafId: null,
        running: false,
        activeTab: 1,
        w: 0, h: 0, dpr: 1,

        series: [],
        latest: { bpm: 0, rmssd: 0 },
        hint: '',
        quality: 'unknown',

        breathPhase: 0,
        breathPeriodSec: 10,
        ripples: [],
        lastRippleAt: 0,

        fireflies: [],
        fireflyInit: false,

        tabs: [],
        tabContent: null,
    };

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    function mixColor(c1, c2, k) {
        return [
            Math.round(c1[0] + (c2[0] - c1[0]) * k),
            Math.round(c1[1] + (c2[1] - c1[1]) * k),
            Math.round(c1[2] + (c2[2] - c1[2]) * k),
        ];
    }
    function rgba(c, a) {
        return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    }
    function rmssdToNorm(rmssd) {
        if (!rmssd || rmssd <= 0) return 0.3;
        return Math.max(0, Math.min(1, (rmssd - 20) / 60));
    }

    function resize() {
        if (!chart.canvas) return;
        const rect = chart.canvas.parentElement.getBoundingClientRect();
        chart.dpr = window.devicePixelRatio || 1;
        chart.w = Math.max(80, Math.floor(rect.width));
        chart.h = Math.max(80, Math.floor(rect.height));
        chart.canvas.width = chart.w * chart.dpr;
        chart.canvas.height = chart.h * chart.dpr;
        chart.canvas.style.width = chart.w + 'px';
        chart.canvas.style.height = chart.h + 'px';
        chart.ctx.setTransform(chart.dpr, 0, 0, chart.dpr, 0, 0);
    }

    function initFireflies() {
        chart.fireflies = [];
        const N = 26;
        for (let i = 0; i < N; i++) {
            chart.fireflies.push({
                x: Math.random(), y: Math.random(),
                vx: (Math.random() - 0.5) * 0.02,
                vy: (Math.random() - 0.5) * 0.02,
                phase: Math.random() * Math.PI * 2,
                size: 0.5 + Math.random() * 0.8,
            });
        }
        chart.fireflyInit = true;
    }

    function loop(ts) {
        if (!chart.running) return;
        const tSec = ts / 1000;
        const dt = chart._lastTs ? Math.min(0.05, tSec - chart._lastTs) : 0.016;
        chart._lastTs = tSec;

        if (chart.activeTab === 1) drawTab1(tSec, dt);
        else if (chart.activeTab === 2) drawTab2();
        else if (chart.activeTab === 3) drawTab3();
        else if (chart.activeTab === 4) drawTab4(tSec);

        chart.rafId = requestAnimationFrame(loop);
    }

    function fillBg(ctx, w, h) {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, rgba(COLORS.bg1, 1));
        bgGrad.addColorStop(1, rgba(COLORS.bg2, 1));
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);
    }

    /* ============ 页签 1：治愈动态图（v3 删掉底部 hint 绘制） ============ */
    function drawTab1(tSec, dt) {
        const ctx = chart.ctx;
        const w = chart.w, h = chart.h;
        const cx = w / 2, cy = h / 2;
        const baseR = Math.min(w, h) * 0.22;

        fillBg(ctx, w, h);

        const norm = rmssdToNorm(chart.latest.rmssd);

        let cA, cB;
        if (norm >= 0.5) {
            const k = (norm - 0.5) / 0.5;
            cA = mixColor(COLORS.midA, COLORS.highA, k);
            cB = mixColor(COLORS.midA, COLORS.highB, k);
        } else {
            const k = norm / 0.5;
            cA = mixColor(COLORS.lowA, COLORS.midA, k);
            cB = mixColor(COLORS.lowB, COLORS.midA, k);
        }

        chart.breathPhase += dt * (Math.PI * 2) / chart.breathPeriodSec;
        const breath = 0.5 + 0.5 * Math.sin(chart.breathPhase);

        const ballR = baseR * (0.7 + 0.5 * breath) * (0.75 + 0.5 * norm);

        const haloR = ballR * 1.9;
        const halo = ctx.createRadialGradient(cx, cy, ballR * 0.6, cx, cy, haloR);
        halo.addColorStop(0, rgba(cA, 0.55));
        halo.addColorStop(0.55, rgba(cB, 0.22));
        halo.addColorStop(1, rgba(cB, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();

        const ballGrad = ctx.createRadialGradient(cx - ballR * 0.3, cy - ballR * 0.3, ballR * 0.2, cx, cy, ballR);
        ballGrad.addColorStop(0, rgba([255, 255, 255], 0.95));
        ballGrad.addColorStop(0.4, rgba(cA, 0.85));
        ballGrad.addColorStop(1, rgba(cB, 0.75));
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
        ctx.fill();

        if (tSec - chart.lastRippleAt > chart.breathPeriodSec / 2) {
            chart.lastRippleAt = tSec;
            chart.ripples.push({ t0: tSec, r0: ballR });
        }
        for (let i = chart.ripples.length - 1; i >= 0; i--) {
            const rp = chart.ripples[i];
            const age = tSec - rp.t0;
            const dur = 2.2 + norm * 1.2;
            const k = age / dur;
            if (k >= 1) { chart.ripples.splice(i, 1); continue; }
            const rr = rp.r0 + (Math.min(w, h) * 0.55 - rp.r0) * k;
            const alpha = (1 - k) * 0.45;
            ctx.strokeStyle = rgba(cA, alpha);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, rr, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (!chart.fireflyInit) initFireflies();
        const fireflyCount = Math.round(6 + norm * 20);
        const fireflySpeed = 0.4 + (chart.latest.bpm > 0 ? chart.latest.bpm / 120 : 0.8) * 0.6;
        for (let i = 0; i < chart.fireflies.length; i++) {
            const f = chart.fireflies[i];
            f.x += f.vx * dt * fireflySpeed * 30;
            f.y += f.vy * dt * fireflySpeed * 30;
            if (f.x < 0.02 || f.x > 0.98) f.vx *= -1;
            if (f.y < 0.02 || f.y > 0.98) f.vy *= -1;
            f.phase += dt * 2;
            if (i >= fireflyCount) continue;
            const px = f.x * w, py = f.y * h;
            const dist = Math.hypot(px - cx, py - cy);
            if (dist < ballR * 1.4) continue;
            const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(f.phase)) * norm + 0.1;
            const size = f.size * (0.8 + norm * 0.8);
            const g = ctx.createRadialGradient(px, py, 0, px, py, size * 6);
            g.addColorStop(0, rgba(COLORS.firefly, a));
            g.addColorStop(0.4, rgba(COLORS.firefly, a * 0.5));
            g.addColorStop(1, rgba(COLORS.firefly, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px, py, size * 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = rgba(COLORS.firefly, Math.min(1, a * 1.6));
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawTab2() {
        const ctx = chart.ctx;
        const w = chart.w, h = chart.h;
        fillBg(ctx, w, h);

        const padL = 40, padR = 20, padT = 30, padB = 40;
        const chartW = w - padL - padR;
        const chartH = h - padT - padB;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('放松度趋势', 'Relaxation Trend'), padL, 8);

        const series = chart.series;
        if (series.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t('数据采集中…', 'Collecting…'), w / 2, h / 2);
            return;
        }

        const tMax = series[series.length - 1].t || 1;
        let rMin = Infinity, rMax = -Infinity;
        series.forEach(p => {
            if (p.rmssd < rMin) rMin = p.rmssd;
            if (p.rmssd > rMax) rMax = p.rmssd;
        });
        if (rMax - rMin < 5) { rMin -= 2; rMax += 2; }
        const rRange = rMax - rMin || 1;

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padT + (chartH * i / 4);
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + chartW, y);
            ctx.stroke();
        }

        ctx.strokeStyle = rgba(COLORS.trendLine, 1);
        ctx.lineWidth = 2;
        ctx.beginPath();
        series.forEach((p, i) => {
            const x = padL + (p.t / tMax) * chartW;
            const y = padT + chartH - ((p.rmssd - rMin) / rRange) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        let maxIdx = 0;
        series.forEach((p, i) => { if (p.rmssd > series[maxIdx].rmssd) maxIdx = i; });
        series.forEach((p, i) => {
            const x = padL + (p.t / tMax) * chartW;
            const y = padT + chartH - ((p.rmssd - rMin) / rRange) * chartH;
            if (i === maxIdx) {
                ctx.fillStyle = rgba(COLORS.trendPoint, 1);
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = rgba(COLORS.trendLine, 0.7);
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 4; i++) {
            const y = padT + (chartH * i / 4);
            const val = rMax - (rRange * i / 4);
            ctx.fillText(Math.round(val), padL - 6, y);
        }

        const maxP = series[maxIdx];
        const mx = padL + (maxP.t / tMax) * chartW;
        const my = padT + chartH - ((maxP.rmssd - rMin) / rRange) * chartH;
        ctx.fillStyle = rgba(COLORS.trendPoint, 1);
        ctx.font = 'bold 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const min = Math.floor(maxP.t / 60);
        const sec = maxP.t % 60;
        ctx.fillText(
            t(`最高 ${maxP.rmssd}（第 ${min}:${String(sec).padStart(2,'0')}）`,
              `Max ${maxP.rmssd} (${min}:${String(sec).padStart(2,'0')})`),
            mx, my - 8
        );
    }

    function drawTab3() {
        const ctx = chart.ctx;
        const w = chart.w, h = chart.h;
        fillBg(ctx, w, h);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('整体状态', 'Overall State'), 20, 8);

        const series = chart.series;
        if (series.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t('数据采集中…', 'Collecting…'), w / 2, h / 2);
            return;
        }

        const padL = 60, padR = 30, padT = 40, padB = 50;
        const chartW = w - padL - padR;
        const chartH = h - padT - padB;

        const avgHR = series.reduce((a, p) => a + (p.bpm || 0), 0) / series.length;
        const avgR  = series.reduce((a, p) => a + (p.rmssd || 0), 0) / series.length;

        const hrMin = 50, hrMax = 110;
        const rMin = 10, rMax = 90;

        const midHR = 75;
        const midR  = 45;

        const q = {
            tr: 'rgba(110,231,183,0.15)',
            tl: 'rgba(96,165,250,0.15)',
            br: 'rgba(196,181,253,0.15)',
            bl: 'rgba(231,76,60,0.15)',
        };

        const xMid = padL + ((midHR - hrMin) / (hrMax - hrMin)) * chartW;
        const yMid = padT + chartH - ((midR - rMin) / (rMax - rMin)) * chartH;

        ctx.fillStyle = q.tl; ctx.fillRect(padL, padT, xMid - padL, yMid - padT);
        ctx.fillStyle = q.tr; ctx.fillRect(xMid, padT, padL + chartW - xMid, yMid - padT);
        ctx.fillStyle = q.bl; ctx.fillRect(padL, yMid, xMid - padL, padT + chartH - yMid);
        ctx.fillStyle = q.br; ctx.fillRect(xMid, yMid, padL + chartW - xMid, padT + chartH - yMid);

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(padL, padT, chartW, chartH);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';  ctx.textBaseline = 'top';
        ctx.fillText(t('兴奋·调节好', 'Excited·Well'), padL + 6, padT + 6);
        ctx.textAlign = 'right';
        ctx.fillText(t('放松', 'Relaxed'), padL + chartW - 6, padT + 6);
        ctx.textAlign = 'left';  ctx.textBaseline = 'bottom';
        ctx.fillText(t('紧张·压力', 'Tense·Stress'), padL + 6, padT + chartH - 6);
        ctx.textAlign = 'right';
        ctx.fillText(t('疲劳·耗竭', 'Fatigue·Burnout'), padL + chartW - 6, padT + chartH - 6);

        const dotX = padL + ((avgHR - hrMin) / (hrMax - hrMin)) * chartW;
        const dotY = padT + chartH - ((avgR - rMin) / (rMax - rMin)) * chartH;
        ctx.fillStyle = rgba(COLORS.quadrant, 1);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fill();

        let label = '';
        if (avgHR >= midHR && avgR < midR)      label = t('紧张·压力', 'Tense·Stress');
        else if (avgHR < midHR && avgR >= midR) label = t('放松·恢复', 'Relaxed·Recovery');
        else if (avgHR >= midHR && avgR >= midR) label = t('兴奋·调节好', 'Excited·Well');
        else                                    label = t('疲劳·耗竭', 'Fatigue·Burnout');

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(t('本次：', 'This time: ') + label, w / 2, padT + chartH + 12);
    }

    function drawTab4(tSec) {
        const ctx = chart.ctx;
        const w = chart.w, h = chart.h;
        fillBg(ctx, w, h);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('呼吸节律', 'Breathing Rhythm'), 20, 8);

        const padL = 20, padR = 20, padT = 40, padB = 40;
        const chartW = w - padL - padR;
        const chartH = h - padT - padB;
        const midY = padT + chartH / 2;

        ctx.strokeStyle = rgba(COLORS.breath, 0.85);
        ctx.lineWidth = 2;
        ctx.beginPath();
        const N = 200;
        for (let i = 0; i <= N; i++) {
            const x = padL + (i / N) * chartW;
            const phase = chart.breathPhase + (i / N) * Math.PI * 6;
            const y = midY - Math.sin(phase) * chartH * 0.32;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        const series = chart.series;
        if (series.length > 0) {
            let bMin = Infinity, bMax = -Infinity;
            series.forEach(p => {
                if (p.bpm < bMin) bMin = p.bpm;
                if (p.bpm > bMax) bMax = p.bpm;
            });
            if (bMax - bMin < 5) { bMin -= 2; bMax += 2; }
            const bRange = bMax - bMin || 1;

            ctx.fillStyle = rgba(COLORS.heart, 0.9);
            series.forEach((p, i) => {
                const x = padL + ((i / (series.length - 1)) || 0) * chartW;
                const norm = (p.bpm - bMin) / bRange;
                const y = midY + (norm - 0.5) * chartH * 0.6;
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(
            t('曲线=呼吸节奏，点=心率', 'Line=breath, Dot=heart rate'),
            w / 2, h - 10
        );
    }

    function buildTabs() {
        const tabsEl = document.getElementById('qx2_heal_tabs');
        if (!tabsEl) return;
        tabsEl.innerHTML = '';
        const defs = [
            { id: 1, cn: '治愈', en: 'Heal' },
            { id: 2, cn: '放松度', en: 'Relax' },
            { id: 3, cn: '整体', en: 'Overall' },
            { id: 4, cn: '呼吸', en: 'Breath' },
        ];
        defs.forEach(d => {
            const btn = document.createElement('button');
            btn.className = 'qx2-heal-tab' + (d.id === chart.activeTab ? ' active' : '');
            btn.dataset.tab = d.id;
            btn.innerText = t(d.cn, d.en);
            btn.onclick = () => {
                chart.activeTab = d.id;
                tabsEl.querySelectorAll('.qx2-heal-tab').forEach(x => x.classList.remove('active'));
                btn.classList.add('active');
                if (chart.activeTab === 1) drawTab1(performance.now() / 1000, 0.016);
                else if (chart.activeTab === 2) drawTab2();
                else if (chart.activeTab === 3) drawTab3();
                else if (chart.activeTab === 4) drawTab4(performance.now() / 1000);
            };
            tabsEl.appendChild(btn);
        });
    }

    function start(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('qxHealChart: 找不到容器', containerId);
            return;
        }
        chart.container = container;
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.borderRadius = '6px';
        container.appendChild(canvas);
        chart.canvas = canvas;
        chart.ctx = canvas.getContext('2d');
        chart.latest = { bpm: 0, rmssd: 0 };
        chart.series = [];
        chart.ripples = [];
        chart.breathPhase = 0;
        chart.hint = '';
        chart._lastTs = 0;
        chart.activeTab = 1;

        resize();
        window.addEventListener('resize', resize);
        buildTabs();

        chart.running = true;
        chart.rafId = requestAnimationFrame(loop);
    }

    function push(point) {
        if (!point) return;
        if (point.hint) chart.hint = point.hint;
        if (point.quality) chart.quality = point.quality;

        if (point.quality === 'good' && point.bpm > 0) {
            chart.latest.bpm = point.bpm;
            chart.latest.rmssd = point.rmssd;
            chart.series.push({
                t: point.elapsed || 0,
                bpm: point.bpm,
                rmssd: point.rmssd,
            });
        }
    }

    function finish() {
        if (chart.rafId) { cancelAnimationFrame(chart.rafId); chart.rafId = null; }
        chart.running = false;
        if (chart.ctx) {
            if (chart.activeTab === 1) drawTab1(performance.now() / 1000, 0.016);
            else if (chart.activeTab === 2) drawTab2();
            else if (chart.activeTab === 3) drawTab3();
            else if (chart.activeTab === 4) drawTab4(performance.now() / 1000);
        }
    }

    function showAnalysis() {
        chart.activeTab = 2;
        const tabsEl = document.getElementById('qx2_heal_tabs');
        if (tabsEl) {
            tabsEl.querySelectorAll('.qx2-heal-tab').forEach(x => {
                x.classList.toggle('active', parseInt(x.dataset.tab) === 2);
            });
        }
        drawTab2();
    }

    function reset() {
        if (chart.rafId) { cancelAnimationFrame(chart.rafId); chart.rafId = null; }
        chart.running = false;
        chart.series = [];
        chart.ripples = [];
        chart.fireflies = [];
        chart.fireflyInit = false;
        chart.latest = { bpm: 0, rmssd: 0 };
        chart.hint = '';
        chart.activeTab = 1;
        if (chart.canvas && chart.canvas.parentElement) {
            chart.canvas.parentElement.innerHTML = '';
        }
        chart.canvas = null;
        chart.ctx = null;
        window.removeEventListener('resize', resize);
    }

    window.qxHealChart = {
        start: start,
        push: push,
        finish: finish,
        showAnalysis: showAnalysis,
        reset: reset,
    };

})();