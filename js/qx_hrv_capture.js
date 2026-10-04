/* ================================================================
   js/qx_hrv_capture.js   v46
   日期：2026-09-29
   说明：
   - 回滚到 v46（去掉 v47 加的 pauseForDetect / resumeAfterDetect）
   - 恢复昨天稳定状态
   ================================================================ */

   (function () {
    'use strict';

    const DEFAULTS = {
        duration: 120,
        warmupSec: 10,
        warmupSampleSec: 3,
        windowSize: 10,
        roiRatio: 0.30,
        targetFps: 30,
        varThreshold: 8.0,
        minSamples: 100,
        hardMinSamples: 30,
        hardMinRR: 3,
        progressIntervalSec: 2,
        varNoPress: 3.0,
        varTooHard: 60.0,
        meanTooDark: 8,
        meanTooBright: 250,
        stablePercent: 0.80,
        recentSeconds: 8,
        rrRecentSeconds: 2,
        minRedness: 25,
        minMean: 8,
        maxMean: 252,
        noPressAbortFrames: 45,
        abortOnNoFinger: true,
        minCoverage: 0.30,
        dotFlashIntervalSec: 0.3,
        bucketSec: 2,
        bucketGoodRatio: 0.5,
        successGoodRatio: 0.80,
        warnGoodRatio: 0.60,
        maxLongBreak: 1,
        longBreakFrames: 4,
        lfBand: [0.04, 0.15],
        hfBand: [0.15, 0.40],
        minRRForHF: 30,
        minRRForLiveHF: 20,
        redMidUpdateSec: 5,
        redMidWindowSec: 5,
    };

    function isHrvDebug() {
        try {
            return new URLSearchParams(window.location.search).get('hrvdebug') === '1';
        } catch (e) { return false; }
    }
    const HRV_DEBUG = isHrvDebug();
    let _dbgFrame = 0;

    let state = {
        durationSec: 120,
        warmupSec: 10,
        warmupSampleSec: 3,
        phase: 'idle',
        warmupRemain: 0,
        warmupLastTick: 0,
        warmupFeedback: '',
        warmupRedSamples: [],
        redMid: 60,
        redMidLocked: false,
        redMidLastUpdate: 0,
        redMidRecent: [],
        redMaxEver: 0,
        container: null,
        video: null,
        stream: null,
        canvas: null,
        ctx: null,
        capturing: false,
        rafAlive: false,
        elapsedAccum: 0,
        lastTs: 0,
        samples: [],
        timestamps: [],
        rrWithTime: [],
        result: null,
        rafId: null,
        onComplete: null,
        onProgress: null,
        onState: null,
        onAbort: null,
        onWarmupTick: null,
        onWarmupEnd: null,
        lastProgressAt: 0,
        recentFrames: [],
        statusText: null,
        idleHintEl: null,
        btnStart: null,
        btnStop: null,
        videoWrap: null,
        videoWrapSmall: null,
        qx2VideoEl: null,
        noPressStreak: 0,
        abortOnNoFinger: true,
        totalFrames: 0,
        validFrames: 0,
        lastDotAt: 0,
        aborted: false,
        bucketIndex: 0,
        bucketFrames: [],
        bucketGood: 0,
        bucketTotal: 0,
        bucketList: [],
        dotA: null,
        dotB: null,
        qx2DotA: null,
        qx2DotB: null,
        dotToggle: 0,
    };

    function emitState(extra) {
        if (!state.onState) return;
        const payload = {
            capturing: state.capturing,
            phase: state.phase,
            warmupRemain: Math.max(0, Math.ceil(state.warmupRemain)),
            elapsed: Math.min(Math.floor(state.elapsedAccum), state.durationSec),
            total: state.durationSec,
            sampleCount: state.samples.length,
            quality: (extra && extra.quality) || 'unknown',
            hint: (extra && extra.hint) || '',
        };
        try { state.onState(payload); } catch (e) {}
    }

    function setHint(text, color) {
        const col = color || '#333';
        if (state.statusText) {
            state.statusText.innerText = text;
            state.statusText.style.color = col;
        }
        const modalHint = document.getElementById('qx1_heal_modal_hint');
        if (modalHint) {
            modalHint.innerText = text;
            modalHint.style.color = col;
        }
    }

    function dotColor(flag) {
        if (flag === 'good') return '#2ECC71';
        if (flag === 'too_light' || flag === 'weak' || flag === 'too_hard') return '#F39C12';
        if (flag === 'no_press' || flag === 'lost' || flag === 'noisy') return '#E74C3C';
        return '#96A3B8';
    }

    function setVideoBorder(flag) {
        const color = dotColor(flag);
        if (state.videoWrap) state.videoWrap.style.borderColor = color;
        if (state.videoWrapSmall) state.videoWrapSmall.style.borderColor = color;
        const qx2Wrap = document.querySelector('.qx2-trend-video-wrap');
        if (qx2Wrap) qx2Wrap.style.borderColor = color;
    }

    function flashDots(flag) {
        state.dotToggle = 1 - state.dotToggle;
        const on = dotColor(flag);
        const off = '#E1E8F0';

        if (state.dotA && state.dotB) {
            state.dotA.style.background = state.dotToggle === 0 ? on : off;
            state.dotB.style.background = state.dotToggle === 0 ? off : on;
        }
        if (state.qx2DotA && state.qx2DotB) {
            state.qx2DotA.style.background = state.dotToggle === 0 ? on : off;
            state.qx2DotB.style.background = state.dotToggle === 0 ? off : on;
        }
    }

    function showIdleHint(show) {
        if (!state.idleHintEl) return;
        state.idleHintEl.style.display = show ? 'flex' : 'none';
    }

    function movingAverage(signal, window) {
        if (signal.length < window) return signal.slice();
        const out = new Array(signal.length);
        let sum = 0;
        for (let i = 0; i < signal.length; i++) {
            sum += signal[i];
            if (i >= window) sum -= signal[i - window];
            out[i] = sum / Math.min(i + 1, window);
        }
        return out;
    }
    function bandpassFilter(signal) {
        const n = signal.length;
        if (n < 10) return signal.slice();
        const mean = signal.reduce((a, b) => a + b, 0) / n;
        const detrended = signal.map(v => v - mean);
        const smooth = movingAverage(detrended, 5);
        const out = new Array(n);
        for (let i = 0; i < n; i++) {
            if (i === 0) out[i] = 0;
            else out[i] = smooth[i] - smooth[i - 1];
        }
        return out;
    }
    function detectPeaks(signal, fs) {
        const peaks = [];
        const n = signal.length;
        if (n < 5) return peaks;
        const maxVal = Math.max(...signal.map(Math.abs));
        const threshold = maxVal * 0.2;
        const minDistance = Math.max(2, Math.floor(fs * 0.25));
        for (let i = 1; i < n - 1; i++) {
            if (signal[i] > threshold && signal[i] > signal[i - 1] && signal[i] >= signal[i + 1]) {
                if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= minDistance) peaks.push(i);
            }
        }
        return peaks;
    }
    function computeRRPeaks(peaks, fs, baseT) {
        const out = [];
        for (let i = 1; i < peaks.length; i++) {
            const dtMs = (peaks[i] - peaks[i - 1]) / fs * 1000;
            if (dtMs > 300 && dtMs < 2000) out.push({ t: baseT + peaks[i] / fs, rr: dtMs });
        }
        return out;
    }
    function computeRR(peaks, fs) {
        const rr = [];
        for (let i = 1; i < peaks.length; i++) {
            const dt = (peaks[i] - peaks[i - 1]) / fs * 1000;
            if (dt > 300 && dt < 2000) rr.push(dt);
        }
        return rr;
    }
    function computeSDNN(rr) {
        if (rr.length < 2) return 0;
        const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
        const variance = rr.reduce((a, b) => a + (b - mean) ** 2, 0) / (rr.length - 1);
        return Math.sqrt(variance);
    }
    function computeRMSSD(rr) {
        if (rr.length < 2) return 0;
        let sum = 0;
        for (let i = 1; i < rr.length; i++) sum += (rr[i] - rr[i - 1]) ** 2;
        return Math.sqrt(sum / (rr.length - 1));
    }
    function computeBPM(rr) {
        if (rr.length === 0) return 0;
        const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
        return 60000 / meanRR;
    }

    function fft(re, im) {
        const n = re.length;
        if (n <= 1) return;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const ang = -2 * Math.PI / len;
            const wRe = Math.cos(ang), wIm = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let curRe = 1, curIm = 0;
                for (let j = 0; j < len / 2; j++) {
                    const uRe = re[i + j], uIm = im[i + j];
                    const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
                    const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
                    re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
                    re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
                    const nextRe = curRe * wRe - curIm * wIm;
                    const nextIm = curRe * wIm + curIm * wRe;
                    curRe = nextRe; curIm = nextIm;
                }
            }
        }
    }

    function computeLFHF(rr, minRR) {
        if (!rr || rr.length < (minRR || DEFAULTS.minRRForHF)) {
            return { lf: 0, hf: 0 };
        }
        const fs = 4;
        const totalTime = rr.reduce((a, b) => a + b, 0) / 1000;
        const n = Math.pow(2, Math.floor(Math.log2(totalTime * fs)));
        if (n < 32) return { lf: 0, hf: 0 };

        const times = [0];
        let cum = 0;
        for (let i = 0; i < rr.length; i++) { cum += rr[i] / 1000; times.push(cum); }

        const resampled = new Array(n);
        for (let i = 0; i < n; i++) {
            const t = i / fs;
            let idx = 0;
            while (idx < times.length - 2 && times[idx + 1] < t) idx++;
            const t0 = times[idx], t1 = times[idx + 1] || t0;
            const v0 = rr[idx] || 0, v1 = rr[idx + 1] || v0;
            const frac = (t1 > t0) ? (t - t0) / (t1 - t0) : 0;
            resampled[i] = v0 + frac * (v1 - v0);
        }

        const mean = resampled.reduce((a, b) => a + b, 0) / n;
        const centered = resampled.map(v => v - mean);

        const win = new Array(n);
        for (let i = 0; i < n; i++) {
            win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
        }
        const re = new Array(n);
        const im = new Array(n).fill(0);
        for (let i = 0; i < n; i++) re[i] = centered[i] * win[i];

        fft(re, im);

        const power = new Array(Math.floor(n / 2));
        for (let i = 0; i < power.length; i++) {
            power[i] = (re[i] * re[i] + im[i] * im[i]) / n;
        }
        const freqRes = fs / n;

        let lfSum = 0, hfSum = 0;
        for (let i = 1; i < power.length; i++) {
            const f = i * freqRes;
            if (f >= DEFAULTS.lfBand[0] && f < DEFAULTS.lfBand[1]) lfSum += power[i];
            else if (f >= DEFAULTS.hfBand[0] && f < DEFAULTS.hfBand[1]) hfSum += power[i];
        }
        const lf = lfSum * freqRes;
        const hf = hfSum * freqRes;
        return {
            lf: Math.round(lf * 100) / 100,
            hf: Math.round(hf * 100) / 100,
        };
    }

    function median(arr) {
        if (!arr || arr.length === 0) return 0;
        const s = arr.slice().sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    function classifyFrame(variance, mean, redness) {
        if (redness < 20) return 'no_press';
        if (mean > 250) return 'no_press';

        const redMid = state.redMid || 60;
        const lo = redMid * 0.8;

        if (redness < lo) return 'too_light';

        if (mean < DEFAULTS.meanTooDark) return 'too_hard';
        if (variance > DEFAULTS.varTooHard) return 'too_hard';
        if (variance < DEFAULTS.varThreshold) return 'weak';

        return 'good';
    }

    function shortHintOf(flag) {
        return {
            no_press:  '手指离开了，请放回摄像头',
            too_light: '手指压太轻，请稍微用力',
            too_hard:  '手指压太重，请放松一点',
            weak:      '信号太弱，请稳住手指',
            good:      '采集中，很好',
        }[flag] || '采集中…';
    }

    function judgeSegment() {
        const now = state.elapsedAccum;
        const RECENT = DEFAULTS.recentSeconds;
        const frames = state.recentFrames.filter(f => (now - f.t) < RECENT);
        state.recentFrames = frames;

        if (frames.length < 20) return { quality: 'unknown', hint: '摄像头工作中…' };

        const total = frames.length;
        const counts = { no_press: 0, too_light: 0, too_hard: 0, weak: 0, good: 0 };
        frames.forEach(f => { counts[f.flag] = (counts[f.flag] || 0) + 1; });

        const goodRatio = counts.good / total;
        if (goodRatio >= DEFAULTS.stablePercent) return { quality: 'good', hint: '采集中，很好' };

        const bad = ['no_press', 'too_light', 'too_hard', 'weak'].map(k => ({ k, n: counts[k] }))
                                                                .sort((a, b) => b.n - a.n);
        const top = bad[0];

        if (top.k === 'no_press')  return { quality: 'no_press',  hint: '手指离开了，请放回摄像头' };
        if (top.k === 'too_light') return { quality: 'too_light', hint: '手指压太轻，请稍微用力' };
        if (top.k === 'too_hard')  return { quality: 'too_hard',  hint: '手指压太重，请放松一点' };
        if (top.k === 'weak')      return { quality: 'weak',      hint: '信号太弱，请稳住手指' };
        return { quality: 'noisy', hint: '信号不太稳定，请保持不动' };
    }

    function computeRealtime() {
        const samples = state.samples;
        const timestamps = state.timestamps;
        if (samples.length < DEFAULTS.hardMinSamples) {
            return { bpm: 0, rmssd: 0, sdnn: 0, hf: 0, lf: 0, lfHf: 0, sampleCount: samples.length, elapsed: 0, rrList: [] };
        }
        const now = timestamps[timestamps.length - 1];
        const RECENT = 20;
        let idx = timestamps.length - 1;
        while (idx > 0 && (now - timestamps[idx]) < RECENT) idx--;

        const subSamples = samples.slice(idx);
        const subTs = timestamps.slice(idx);
        if (subSamples.length < 10) {
            return { bpm: 0, rmssd: 0, sdnn: 0, hf: 0, lf: 0, lfHf: 0, sampleCount: subSamples.length, elapsed: now - timestamps[0], rrList: [] };
        }
        const dt = subTs[subTs.length - 1] - subTs[0];
        const fs = dt > 0 ? (subSamples.length - 1) / dt : DEFAULTS.targetFps;
        const filtered = bandpassFilter(subSamples);
        const smoothed = movingAverage(filtered, 5);
        const peaks = detectPeaks(smoothed, fs);
        const rr = computeRR(peaks, fs);

        const baseT = subTs[0];
        const newRR = computeRRPeaks(peaks, fs, baseT);
        newRR.forEach(item => {
            if (!state.rrWithTime.some(x => Math.abs(x.t - item.t) < 0.01)) {
                state.rrWithTime.push(item);
            }
        });
        const cutoff = state.elapsedAccum - 30;
        state.rrWithTime = state.rrWithTime.filter(x => x.t >= cutoff);

        const nowT = state.elapsedAccum;
        const rrList = state.rrWithTime
            .filter(x => (nowT - x.t) <= DEFAULTS.rrRecentSeconds)
            .map(x => Math.round(x.rr))
            .slice(-20);

        const recentRR = state.rrWithTime.filter(x => (nowT - x.t) <= 30).map(x => x.rr);
        const { lf, hf } = computeLFHF(recentRR, DEFAULTS.minRRForLiveHF);

        if (rr.length < 2) {
            return { bpm: 0, rmssd: 0, sdnn: 0, hf, lf, lfHf: 0, sampleCount: subSamples.length, elapsed: now - timestamps[0], rrList };
        }
        return {
            bpm: Math.round(computeBPM(rr)),
            rmssd: Math.round(computeRMSSD(rr) * 10) / 10,
            sdnn: Math.round(computeSDNN(rr) * 10) / 10,
            hf, lf,
            lfHf: 0,
            rrCount: rr.length,
            sampleCount: subSamples.length,
            elapsed: Math.round(now - timestamps[0]),
            rrList,
        };
    }

    function renderUI(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'qx-hrv-wrap';

        const videoWrap = document.createElement('div');
        videoWrap.className = 'qx-hrv-video-wrap';
        const video = document.createElement('video');
        video.className = 'qx-hrv-video';
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        videoWrap.appendChild(video);

        const statusWrap = document.createElement('div');
        statusWrap.className = 'qx-hrv-status-wrap';
        const statusText = document.createElement('div');
        statusText.className = 'qx-hrv-status-text';
        statusText.innerText = '未开始';
        statusWrap.appendChild(statusText);

        const hintWrap = document.createElement('div');
        hintWrap.className = 'qx-hrv-hint-wrap';
        const idleHint = document.createElement('div');
        idleHint.className = 'qx-hrv-idle-hint';
        idleHint.innerText = '完善情绪记录需要测量 HRV，请将干净手指轻按在摄像头上…';
        hintWrap.appendChild(idleHint);

        const btnWrap = document.createElement('div');
        btnWrap.className = 'qx-hrv-btns qx-hrv-btns-compact';
        const btnStart = document.createElement('button');
        btnStart.className = 'qx-hrv-btn qx-hrv-btn-start';
        btnStart.innerText = '▶';
        btnStart.title = '开始采集';
        const btnStop = document.createElement('button');
        btnStop.className = 'qx-hrv-btn qx-hrv-btn-stop';
        btnStop.innerText = '■';
        btnStop.title = '停止采集';
        btnStop.disabled = true;
        btnWrap.appendChild(btnStart);
        btnWrap.appendChild(btnStop);

        wrap.appendChild(videoWrap);
        wrap.appendChild(statusWrap);
        wrap.appendChild(hintWrap);
        wrap.appendChild(btnWrap);

        container.appendChild(wrap);

        state.video = video;
        state.videoWrap = videoWrap;
        state.canvas = document.createElement('canvas');
        state.ctx = state.canvas.getContext('2d', { willReadFrequently: true });
        state.statusText = statusText;
        state.idleHintEl = idleHint;
        state.btnStart = btnStart;
        state.btnStop = btnStop;
        state.videoWrapSmall = document.getElementById('qx1_heal_wave_video');
        state.qx2VideoEl = document.getElementById('qx2_trend_video');
        state.dotA = document.getElementById('qx1_dot_a');
        state.dotB = document.getElementById('qx1_dot_b');
        state.qx2DotA = document.getElementById('qx2_dot_a');
        state.qx2DotB = document.getElementById('qx2_dot_b');
        state.dotToggle = 0;
    }

    function bindSmallVideo() {
        const main = document.getElementById('qx1_heal_wave_video');
        if (main && state.video && main.srcObject !== state.video.srcObject) {
            main.srcObject = state.video.srcObject;
            try { main.play(); } catch (e) {}
        }
        const qx2 = document.getElementById('qx2_trend_video');
        if (qx2 && state.video && qx2.srcObject !== state.video.srcObject) {
            qx2.srcObject = state.video.srcObject;
            try { qx2.play(); } catch (e) {}
        }
    }

    function releaseCamera() {
        if (state.stream) {
            state.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            state.stream = null;
        }
        if (state.video) {
            try { state.video.pause(); } catch (e) {}
            state.video.srcObject = null;
        }
        const main = document.getElementById('qx1_heal_wave_video');
        if (main) main.srcObject = null;
        const qx2 = document.getElementById('qx2_trend_video');
        if (qx2) qx2.srcObject = null;
    }
    async function requestCamera() {
        releaseCamera();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('浏览器不支持摄像头');
        }
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e1) {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 320 }, height: { ideal: 240 } }, audio: false,
            });
        }
        state.stream = stream;
        state.video.srcObject = stream;

        await new Promise((resolve) => {
            if (state.video.readyState >= 1 && state.video.videoWidth > 0) { resolve(); return; }
            const done = () => resolve();
            state.video.addEventListener('loadedmetadata', done, { once: true });
            setTimeout(done, 1500);
        });

        try { await state.video.play(); } catch (e) {}
        bindSmallVideo();
    }

    function updateWaveform() {
        const dstWave = document.getElementById('qx1_heal_modal_wave_line');
        if (!dstWave) return;
        const recent = state.samples.slice(-300);
        if (recent.length < 2) return;
        const min = Math.min(...recent), max = Math.max(...recent);
        const range = max - min || 1;
        const points = recent.map((v, i) => {
            const x = (i / (recent.length - 1)) * 400;
            const y = 40 - ((v - min) / range) * 34 - 3;
            return `${x},${y}`;
        }).join(' ');
        dstWave.setAttribute('points', points);
    }

    function updateTimerMain(secText, total) {
        const el = document.getElementById('qx1_hrv_timer');
        if (el) el.innerText = `${secText} / ${total} 秒`;
    }
    function updateTimerModal(secText, total) {
        const modalEl = document.getElementById('qx1_heal_modal_timer');
        if (modalEl) modalEl.innerText = `${secText} / ${total} 秒`;
    }

    function pushBucketFrame(flag) {
        state.bucketTotal++;
        if (flag === 'good') state.bucketGood++;
        state.bucketFrames.push(flag);
    }
    function closeBucket() {
        if (state.bucketTotal === 0) return;
        const goodRatio = state.bucketGood / state.bucketTotal;
        const valid = goodRatio >= DEFAULTS.bucketGoodRatio;
        state.bucketList.push({
            index: state.bucketIndex,
            good: state.bucketGood,
            total: state.bucketTotal,
            valid: valid,
        });
        state.bucketIndex++;
        state.bucketFrames = [];
        state.bucketGood = 0;
        state.bucketTotal = 0;
    }

    function warmupHintOf(flag) {
        return {
            good:      '很好，保持这个力度',
            too_light: '压太轻，再按紧一点',
            too_hard:  '压太重，放松一点',
            weak:      '信号太弱，稳住手指',
            no_press:  '请把手指放到摄像头上',
            noisy:     '保持不动，再稳一点',
        }[flag] || '请调整手指轻重';
    }

    function lockRedMid() {
        const valid = state.warmupRedSamples.filter(v => v >= 25);
        state.redMid = valid.length >= 10 ? median(valid) : 60;
        state.redMidLocked = true;
        if (HRV_DEBUG) {
            console.log('[HRV] redMid locked =', Math.round(state.redMid),
                        '(samples:', valid.length, '/ raw:', state.warmupRedSamples.length, ')');
        }
    }

    function updateRedMidSliding(nowSec, redness, frameValid) {
        if (!frameValid || redness < 25) return;

        if (redness > state.redMaxEver) state.redMaxEver = redness;

        state.redMidRecent.push({ t: nowSec, v: redness });
        state.redMidRecent = state.redMidRecent.filter(x => (nowSec - x.t) <= DEFAULTS.redMidWindowSec);

        if (nowSec - state.redMidLastUpdate < DEFAULTS.redMidUpdateSec) return;
        state.redMidLastUpdate = nowSec;

        if (state.redMidRecent.length < 20) return;

        const vals = state.redMidRecent.map(x => x.v);
        const med = median(vals);

        let nextMid = state.redMid;
        if (med > state.redMid) nextMid = med;

        const cap = state.redMaxEver * 0.9;
        if (nextMid > cap) nextMid = cap;

        if (nextMid > state.redMid) {
            state.redMid = nextMid;
            if (HRV_DEBUG) {
                console.log('[HRV] redMid sliding =', Math.round(state.redMid),
                            '(med:', Math.round(med), ' maxEver:', Math.round(state.redMaxEver), ')');
            }
        }
    }

    function captureLoop(ts) {
        if (!state.rafAlive) return;
        if (state.phase !== 'warmup' && state.phase !== 'running') { state.rafAlive = false; return; }

        const tsSec = ts / 1000;
        let dt = state.lastTs ? (tsSec - state.lastTs) : (1 / DEFAULTS.targetFps);
        if (dt < 0) dt = 0;
        if (dt > 0.2) dt = 0.2;
        state.lastTs = tsSec;

        const video = state.video;
        const videoReady = video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

        let mean = 0, variance = 0, redness = 0, flag = 'no_press', frameValid = false;
        if (videoReady) {
            const canvas = state.canvas;
            const ctx = state.ctx;
            const vw = video.videoWidth, vh = video.videoHeight;
            canvas.width = vw; canvas.height = vh;
            ctx.drawImage(video, 0, 0, vw, vh);

            const rw = Math.floor(vw * DEFAULTS.roiRatio);
            const rh = Math.floor(vh * DEFAULTS.roiRatio);
            const rx = Math.floor((vw - rw) / 2);
            const ry = Math.floor((vh - rh) / 2);
            const imageData = ctx.getImageData(rx, ry, rw, rh).data;

            let sum = 0, sumSq = 0, sumR = 0, sumG = 0, sumB = 0;
            const len = imageData.length / 4;
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                sum += g; sumSq += g * g;
                sumR += r; sumG += g; sumB += b;
            }
            mean = sum / len;
            variance = sumSq / len - mean * mean;
            const meanR = sumR / len, meanG = sumG / len, meanB = sumB / len;
            redness = meanR - (meanG + meanB) / 2;
            frameValid = !(mean <= 0.5 && variance === 0);
            flag = classifyFrame(variance, mean, redness);
        }

        if (frameValid) {
            state.totalFrames++;
            if (flag === 'good') state.validFrames++;
        }

        if (frameValid) {
            const now = state.elapsedAccum;
            if (now - state.lastDotAt >= DEFAULTS.dotFlashIntervalSec) {
                state.lastDotAt = now;
                setVideoBorder(flag);
                flashDots(flag);
            }
        }

        if (state.phase === 'warmup') {
            if (state.warmupRemain <= 0) {
                state.warmupRemain = state.warmupSec;
                state.warmupLastTick = 0;
            }
            const elapsedWarm = state.warmupSec - state.warmupRemain;
            state.warmupRemain -= dt;
            state.warmupLastTick += dt;

            if (frameValid && elapsedWarm < state.warmupSampleSec) {
                if (redness >= 25) {
                    state.warmupRedSamples.push(redness);
                }
            }

            if (!state.redMidLocked && elapsedWarm >= state.warmupSampleSec) {
                lockRedMid();
            }

            if (frameValid) {
                if (state.warmupLastTick >= 1.0) {
                    state.warmupLastTick = 0;
                    state.warmupFeedback = warmupHintOf(flag);
                    const remain = Math.max(0, Math.ceil(state.warmupRemain));
                    setHint(`预备中… ${remain} 秒 · ${state.warmupFeedback}`, '#B9770E');
                    if (state.onWarmupTick) {
                        try {
                            state.onWarmupTick({
                                remain: remain,
                                flag: flag,
                                hint: state.warmupFeedback,
                                redMid: Math.round(state.redMid),
                            });
                        } catch (e) {}
                    }
                }
                const remainNow = Math.max(0, Math.ceil(state.warmupRemain));
                updateTimerMain(`预备 ${remainNow}`, state.warmupSec);
                const pf = document.getElementById('qx1_heal_modal_progress');
                if (pf) pf.style.width = ((state.warmupSec - state.warmupRemain) / state.warmupSec * 100) + '%';
                emitState({ quality: 'unknown', hint: state.warmupFeedback });
            } else {
                if (state.warmupLastTick >= 1.0) {
                    state.warmupLastTick = 0;
                    const remain = Math.max(0, Math.ceil(state.warmupRemain));
                    setHint(`预备中… ${remain} 秒 · 摄像头启动中`, '#B9770E');
                    if (state.onWarmupTick) {
                        try { state.onWarmupTick({ remain: remain, flag: 'unknown', hint: '摄像头启动中', redMid: Math.round(state.redMid) }); } catch (e) {}
                    }
                }
                const remainNow = Math.max(0, Math.ceil(state.warmupRemain));
                updateTimerMain(`预备 ${remainNow}`, state.warmupSec);
                emitState({ quality: 'unknown', hint: '摄像头启动中' });
            }

            if (state.warmupRemain <= 0) {
                if (!state.redMidLocked) lockRedMid();
                state.phase = 'running';
                state.elapsedAccum = 0;
                state.lastTs = 0;
                state.lastProgressAt = 0;
                state.redMidLastUpdate = 0;
                state.redMidRecent = [];
                state.samples = [];
                state.timestamps = [];
                state.rrWithTime = [];
                state.result = null;
                state.recentFrames = [];
                state.noPressStreak = 0;
                state.bucketIndex = 0;
                state.bucketFrames = [];
                state.bucketGood = 0;
                state.bucketTotal = 0;
                state.bucketList = [];
                state.totalFrames = 0;
                state.validFrames = 0;
                updateTimerMain(0, state.durationSec);
                updateTimerModal(0, state.durationSec);
                setHint('采集中，很好', '#1E8449');
                emitState({ quality: 'unknown', hint: '采集中，很好' });
                if (state.onWarmupEnd) {
                    try { state.onWarmupEnd(); } catch (e) {}
                }
            }

            if (state.rafAlive) state.rafId = requestAnimationFrame(captureLoop);
            return;
        }

        state.elapsedAccum += dt;
        const elapsed = state.elapsedAccum;
        if (elapsed >= state.durationSec) { stopCapture('done'); return; }

        const shownSec = Math.min(Math.floor(elapsed), state.durationSec);

        if (!videoReady) {
            setHint('摄像头未就绪…', '#B9770E');
            updateTimerMain(shownSec, state.durationSec);
            updateTimerModal(shownSec, state.durationSec);
            emitState({ quality: 'unknown', hint: '摄像头未就绪…' });
            if (state.rafAlive) state.rafId = requestAnimationFrame(captureLoop);
            return;
        }

        if (!frameValid) {
            setVideoBorder('no_press');
            updateTimerMain(shownSec, state.durationSec);
            updateTimerModal(shownSec, state.durationSec);
            emitState({ quality: 'unknown', hint: '摄像头启动中…' });
            if (state.rafAlive) state.rafId = requestAnimationFrame(captureLoop);
            return;
        }

        updateRedMidSliding(state.elapsedAccum, redness, frameValid);

        if (HRV_DEBUG) {
            _dbgFrame++;
            if (_dbgFrame % 30 === 0) {
                console.log('[HRV] mean=' + Math.round(mean) +
                            ' var=' + variance.toFixed(1) +
                            ' red=' + redness.toFixed(1) +
                            ' redMid=' + Math.round(state.redMid) +
                            ' flag=' + flag);
            }
        }

        state.recentFrames.push({ t: state.elapsedAccum, variance, mean, redness, flag });
        pushBucketFrame(flag);

        if (flag === 'no_press') {
            state.noPressStreak++;
            if (state.abortOnNoFinger && state.noPressStreak >= DEFAULTS.noPressAbortFrames) {
                stopCapture('no_finger');
                return;
            }
        } else {
            state.noPressStreak = 0;
        }

        const shortHint = shortHintOf(flag);

        if (flag === 'good') {
            state.samples.push(mean);
            state.timestamps.push(state.elapsedAccum);
            setHint('采集中，很好', '#1E8449');
            if (state.videoWrap) state.videoWrap.classList.add('is-working');
        } else {
            setHint(shortHint, flag === 'no_press' ? '#C0392B' : '#B9770E');
            if (state.videoWrap && flag === 'no_press') {
                state.videoWrap.classList.remove('is-working');
            }
        }

        updateWaveform();
        updateTimerMain(shownSec, state.durationSec);
        updateTimerModal(shownSec, state.durationSec);

        const pf = document.getElementById('qx1_heal_modal_progress');
        if (pf) pf.style.width = Math.min(100, (elapsed / state.durationSec) * 100) + '%';

        if (state.elapsedAccum - state.lastProgressAt >= DEFAULTS.progressIntervalSec) {
            state.lastProgressAt = state.elapsedAccum;
            closeBucket();
            try {
                const seg = judgeSegment();
                const rt = computeRealtime();
                rt.elapsed = Math.round(elapsed);
                rt.quality = seg.quality;
                rt.hint = seg.hint;
                rt.total = state.durationSec;
                rt.redness = Math.round(redness * 10) / 10;
                rt.mean = Math.round(mean);
                rt.variance = Math.round(variance * 10) / 10;
                rt.redMid = Math.round(state.redMid);
                rt.bucketIndex = state.bucketIndex;
                rt.bucketGood = state.bucketGood;
                rt.bucketTotal = state.bucketTotal;
                rt.bucketQuality = flag;
                if (state.onProgress) state.onProgress(rt);
            } catch (e) {}
        }

        emitState({ quality: flag, hint: shortHint });

        if (state.rafAlive) state.rafId = requestAnimationFrame(captureLoop);
    }

    function evaluateSuccess() {
        closeBucket();

        if (state.durationSec >= 9000) {
            const cov = state.totalFrames > 0 ? state.validFrames / state.totalFrames : 0;
            if (cov < DEFAULTS.minCoverage) {
                return { ok: false, level: 'fail', reason: 'LOW_COVERAGE', coverage: cov };
            }
            return { ok: true, level: 'ok', reason: 'OK', coverage: cov };
        }

        const list = state.bucketList;
        if (list.length === 0) {
            return { ok: false, level: 'fail', reason: 'NO_BUCKET' };
        }
        const validCount = list.filter(b => b.valid).length;
        const ratio = validCount / list.length;

        let maxRun = 0, curRun = 0;
        list.forEach(b => {
            if (b.valid) curRun = 0;
            else { curRun++; if (curRun > maxRun) maxRun = curRun; }
        });

        if (ratio < DEFAULTS.warnGoodRatio) {
            return { ok: false, level: 'fail', reason: 'LOW_RATIO', ratio, maxRun };
        }
        if (maxRun >= DEFAULTS.longBreakFrames * 2) {
            return { ok: false, level: 'fail', reason: 'LONG_BREAK', ratio, maxRun };
        }
        if (ratio < DEFAULTS.successGoodRatio || maxRun >= DEFAULTS.longBreakFrames) {
            return { ok: true, level: 'warn', reason: 'SPARSE', ratio, maxRun };
        }
        return { ok: true, level: 'ok', reason: 'OK', ratio, maxRun };
    }

    function stopCapture(reason) {
        if (state.phase === 'idle' || state.phase === 'done') return;
        const wasPhase = state.phase;
        state.phase = 'done';
        state.capturing = false;
        state.rafAlive = false;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        if (state.btnStart) state.btnStart.disabled = false;
        if (state.btnStop) state.btnStop.disabled = true;
        if (state.videoWrap) state.videoWrap.classList.remove('is-working');

        if (reason === 'done') {
            updateTimerModal(state.durationSec, state.durationSec);
            updateTimerMain(state.durationSec, state.durationSec);
        }

        if (reason === 'no_finger') {
            state.samples = [];
            state.timestamps = [];
            state.rrWithTime = [];
            state.result = null;
            setHint('手指离开了，本次作废，请重新开始', '#C0392B');
            showIdleHint(false);
            if (state.onAbort) {
                try { state.onAbort({ reason: 'no_finger' }); } catch (e) {}
            }
            return;
        }

        if (reason === 'user' && wasPhase === 'warmup') {
            setHint('已停止', '#5A6B87');
            showIdleHint(true);
            updateTimerMain(0, state.durationSec);
            updateTimerModal(0, state.durationSec);
            return;
        }

        const succ = evaluateSuccess();
        if (!succ.ok) {
            state.samples = [];
            state.timestamps = [];
            state.rrWithTime = [];
            state.result = null;
            setHint('本次有效数据不足，请重测', '#C0392B');
            showIdleHint(false);
            if (state.onAbort) {
                try { state.onAbort({ reason: succ.reason, detail: succ }); } catch (e) {}
            }
            return;
        }

        computeResult();

        if (state.result) {
            if (succ.level === 'warn') {
                setHint('本次有效数据偏少，可保存但仅供参考', '#B9770E');
            } else {
                setHint('采集完成', '#2C7BE5');
            }
        } else {
            setHint('数据不足，请重试', '#C0392B');
        }

        showIdleHint(false);
        emitState({ quality: state.result ? 'good' : 'unknown', hint: state.statusText ? state.statusText.innerText : '' });
        if (state.onComplete) state.onComplete(state.result, succ);
    }

    function computeResult() {
        const samples = state.samples;
        const timestamps = state.timestamps;
        if (samples.length < DEFAULTS.hardMinSamples) { state.result = null; return; }
        const dt = timestamps[timestamps.length - 1] - timestamps[0];
        const fs = dt > 0 ? (samples.length - 1) / dt : DEFAULTS.targetFps;
        const filtered = bandpassFilter(samples);
        const smoothed = movingAverage(filtered, 5);
        const peaks = detectPeaks(smoothed, fs);
        const rrIntervals = computeRR(peaks, fs);
        if (rrIntervals.length < DEFAULTS.hardMinRR) { state.result = null; return; }

        const sdnn = computeSDNN(rrIntervals);
        const rmssd = computeRMSSD(rrIntervals);
        const bpm = computeBPM(rrIntervals);
        const { lf, hf } = computeLFHF(rrIntervals);

        state.result = {
            sdnn: Math.round(sdnn * 10) / 10,
            rmssd: Math.round(rmssd * 10) / 10,
            pnn50: 0,
            bpm: Math.round(bpm),
            lf, hf,
            lfHf: 0,
            rrIntervals: rrIntervals,
            hrTrend: [],
            duration: Math.round(dt),
            sampleCount: samples.length,
            coverage: state.totalFrames > 0 ? (state.validFrames / state.totalFrames) : 0,
            totalFrames: state.totalFrames,
            validFrames: state.validFrames,
        };
    }

    function getCanvasHost(host) {
        if (typeof host === 'string') return document.getElementById(host);
        return host;
    }
    function prepCanvas(host, w, h) {
        const el = getCanvasHost(host);
        if (!el) return null;
        el.innerHTML = '';
        const canvas = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.style.display = 'block';
        el.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, w, h };
    }
    function hostSize(host, defW, defH) {
        const el = getCanvasHost(host);
        if (!el) return { w: defW, h: defH };
        const cw = el.clientWidth || defW;
        const ch = el.clientHeight || defH;
        return {
            w: Math.max(120, Math.floor(cw)),
            h: Math.max(120, Math.floor(ch)),
        };
    }
    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    function drawRadarChart(host, r) {
        const sz = hostSize(host, 420, 320);
        const c = prepCanvas(host, sz.w, sz.h);
        if (!c) return;
        const { ctx, w, h } = c;

        const cx = w / 2, cy = h / 2 + 14;
        const R = Math.min(w, h) * 0.28;
        const labels = [
            { cn: '平均心率',   en: 'HR',    norm: 1 - Math.min(1, Math.max(0, (r.bpm - 50) / 60)) },
            { cn: 'RMSSD',      en: 'RMSSD', norm: Math.min(1, Math.max(0, (r.rmssd || 0) / 80)) },
            { cn: 'SDNN',       en: 'SDNN',  norm: Math.min(1, Math.max(0, (r.sdnn  || 0) / 120)) },
            { cn: 'HF',         en: 'HF',    norm: Math.min(1, Math.max(0, (r.hf    || 0) / 2000)) },
        ];
        const N = labels.length;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#FAFAFA';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1A2B4A';
        ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('HRV 雷达（越大越偏副交感）', 'HRV Radar'), 12, 10);

        const lines = [
            `${t('平均心率', 'HR')}  ${r.bpm} bpm`,
            `RMSSD  ${r.rmssd} ms`,
            `SDNN  ${r.sdnn} ms`,
            `HF  ${r.hf} ms²`,
        ];
        ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = '#5A6B87';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillText(line, w - 12, 10 + i * 14);
        });

        for (let k = 1; k <= 4; k++) {
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
                const rr = R * (k / 4);
                const x = cx + Math.cos(ang) * rr;
                const y = cy + Math.sin(ang) * rr;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'rgba(44,123,229,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < N; i++) {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const x = cx + Math.cos(ang) * R;
            const y = cy + Math.sin(ang) * R;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(44,123,229,0.3)';
            ctx.stroke();
            const lx = cx + Math.cos(ang) * (R + 22);
            const ly = cy + Math.sin(ang) * (R + 22);
            ctx.fillStyle = '#5A6B87';
            ctx.fillText(t(labels[i].cn, labels[i].en), lx, ly);
        }

        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const rr = R * Math.max(0.05, labels[i].norm);
            const x = cx + Math.cos(ang) * rr;
            const y = cy + Math.sin(ang) * rr;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(44,123,229,0.30)';
        ctx.fill();
        ctx.strokeStyle = '#2C7BE5';
        ctx.lineWidth = 2;
        ctx.stroke();

        for (let i = 0; i < N; i++) {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const rr = R * Math.max(0.05, labels[i].norm);
            const x = cx + Math.cos(ang) * rr;
            const y = cy + Math.sin(ang) * rr;
            ctx.beginPath();
            ctx.arc(x, y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#2C7BE5';
            ctx.fill();
        }
    }

    function drawTrendChart(host, r) {
        const sz = hostSize(host, 420, 320);
        const c = prepCanvas(host, sz.w, sz.h);
        if (!c) return;
        const { ctx, w, h } = c;

        const padL = 44, padR = 44, padT = 34, padB = 30;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#FAFAFA';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1A2B4A';
        ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('本次采集：心率 / RMSSD', 'Session: HR / RMSSD'), 12, 10);

        const rawRR = r.rrIntervals || [];
        const rr = rawRR.filter(v => v > 300 && v < 2000);
        if (rr.length < 2) {
            ctx.fillStyle = '#96A3B8';
            ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t('RR 数据不足', 'Not enough RR'), w / 2, h / 2);
            return;
        }

        const tArr = [0];
        let cum = 0;
        for (let i = 0; i < rr.length; i++) { cum += rr[i] / 1000; tArr.push(cum); }

        const hrArr = rr.map(v => 60000 / v).filter(v => v >= 20 && v <= 250);
        const rmssdWin = [];
        for (let i = 0; i < rr.length; i++) {
            const a = Math.max(0, i - 9);
            const seg = rr.slice(a, i + 1);
            let sum = 0;
            for (let j = 1; j < seg.length; j++) sum += (seg[j] - seg[j - 1]) ** 2;
            rmssdWin.push(seg.length > 1 ? Math.sqrt(sum / (seg.length - 1)) : 0);
        }

        const hrLen = Math.min(hrArr.length, rr.length);

        const totalT = tArr[tArr.length - 1] || 1;
        const hrMin = Math.min(...hrArr) - 5;
        const hrMax = Math.max(...hrArr) + 5;
        const rmMin = 0;
        const rmMax = Math.max(20, Math.max(...rmssdWin) + 10);

        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let k = 0; k <= 4; k++) {
            const y = padT + plotH * k / 4;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();
        }

        ctx.beginPath();
        for (let i = 0; i < hrLen; i++) {
            const x = padL + (tArr[i] / totalT) * plotW;
            const y = padT + plotH - ((hrArr[i] - hrMin) / (hrMax - hrMin)) * plotH;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#E53935';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < rmssdWin.length; i++) {
            const x = padL + (tArr[i] / totalT) * plotW;
            const y = padT + plotH - ((rmssdWin[i] - rmMin) / (rmMax - rmMin)) * plotH;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#2C7BE5';
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#E53935';
        ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('HR ' + Math.round(hrMax), padL - 6, padT + 6);
        ctx.fillText('HR ' + Math.round(hrMin), padL - 6, padT + plotH - 6);

        ctx.fillStyle = '#2C7BE5';
        ctx.textAlign = 'left';
        ctx.fillText(Math.round(rmMax), padL + plotW + 6, padT + 6);
        ctx.fillText(Math.round(rmMin), padL + plotW + 6, padT + plotH - 6);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#E53935';
        ctx.fillRect(padL, h - 18, 14, 3);
        ctx.fillStyle = '#5A6B87';
        ctx.fillText(t('心率', 'HR'), padL + 20, h - 12);

        ctx.fillStyle = '#2C7BE5';
        ctx.fillRect(padL + 70, h - 18, 14, 3);
        ctx.fillStyle = '#5A6B87';
        ctx.fillText('RMSSD', padL + 90, h - 12);
    }

    function drawScatterChart(host, r) {
        const sz = hostSize(host, 420, 320);
        const c = prepCanvas(host, sz.w, sz.h);
        if (!c) return;
        const { ctx, w, h } = c;

        const padL = 44, padR = 20, padT = 40, padB = 30;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#FAFAFA';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1A2B4A';
        ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('RR 间期 Poincaré 散点', 'Poincaré Scatter'), 12, 10);

        ctx.fillStyle = '#96A3B8';
        ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(t('越集中越紧张，越散越放松', 'Tight=tense, loose=relaxed'), w - 12, 12);

        const rr = r.rrIntervals || [];
        if (rr.length < 4) {
            ctx.fillStyle = '#96A3B8';
            ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(t('RR 数据不足', 'Not enough RR'), w / 2, h / 2);
            return;
        }

        let minRR = Infinity, maxRR = -Infinity;
        rr.forEach(v => {
            if (v < minRR) minRR = v;
            if (v > maxRR) maxRR = v;
        });
        const pad = 20;
        minRR -= pad; maxRR += pad;

        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let k = 0; k <= 4; k++) {
            const y = padT + plotH * k / 4;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();
            const x = padL + plotW * k / 4;
            ctx.beginPath();
            ctx.moveTo(x, padT);
            ctx.lineTo(x, padT + plotH);
            ctx.stroke();
        }

        for (let i = 1; i < rr.length; i++) {
            const x = padL + ((rr[i - 1] - minRR) / (maxRR - minRR)) * plotW;
            const y = padT + plotH - ((rr[i] - minRR) / (maxRR - minRR)) * plotH;
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(44,123,229,0.55)';
            ctx.fill();
        }

        ctx.beginPath();
        ctx.moveTo(padL, padT + plotH);
        ctx.lineTo(padL + plotW, padT);
        ctx.strokeStyle = 'rgba(150,163,184,0.7)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#5A6B87';
        ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('RRn', padL + plotW / 2, h - 20);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('RRn+1', 8, padT + 8);
    }

    function drawCardChart(host, r) {
        const hostEl = getCanvasHost(host);
        if (!hostEl) return;

        const ROW_H = 60;
        const START_Y = 34;
        const GAP = 6;
        const cols = 2;
        const rows = 4;

        const hostW = Math.max(240, Math.floor(hostEl.clientWidth || 420));
        const contentH = START_Y + rows * ROW_H + (rows - 1) * GAP + 12;

        const c = prepCanvas(host, hostW, contentH);
        if (!c) return;
        const { ctx, w, h } = c;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#FAFAFA';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1A2B4A';
        ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(t('关键指标', 'Key Metrics'), 12, 10);

        const items = [
            { cn: '平均心率', en: 'Avg HR',  val: r.bpm + ' bpm' },
            { cn: 'RMSSD',   en: 'RMSSD',    val: r.rmssd + ' ms' },
            { cn: 'SDNN',    en: 'SDNN',     val: r.sdnn + ' ms' },
            { cn: 'HF 高频',  en: 'HF',       val: r.hf },
            { cn: 'LF 低频',  en: 'LF',       val: r.lf },
            { cn: 'RR 数',   en: 'RR count', val: (r.rrIntervals || []).length },
            { cn: '时长',    en: 'Duration', val: r.duration + ' s' },
        ];

        const noteItems = [
            'HF 高频：副交感可靠指标，越低越紧张',
            'LF 低频：交感+副交感混合',
            'RMSSD：越大副交感越强',
            'SDNN：整体 HRV，越低调节越差',
        ];

        const startX = 12;
        const cellW = (w - startX * 2 - GAP * (cols - 1)) / cols;

        items.forEach((it, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const x = startX + col * (cellW + GAP);
            const y = START_Y + row * (ROW_H + GAP);

            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#E1E8F0';
            ctx.lineWidth = 1;
            roundRect(ctx, x, y, cellW, ROW_H, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#5A6B87';
            ctx.font = '10px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(t(it.cn, it.en), x + 8, y + 6);

            ctx.fillStyle = '#1A2B4A';
            ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.fillText(String(it.val), x + 8, y + 22);
        });

        {
            const i = 7;
            const col = i % cols, row = Math.floor(i / cols);
            const x = startX + col * (cellW + GAP);
            const y = START_Y + row * (ROW_H + GAP);

            ctx.fillStyle = '#F8FBFF';
            ctx.strokeStyle = '#DCE9FF';
            ctx.lineWidth = 1;
            roundRect(ctx, x, y, cellW, ROW_H, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#2C7BE5';
            ctx.font = 'bold 10px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(t('说明', 'Notes'), x + 8, y + 6);

            ctx.fillStyle = '#5A6B87';
            ctx.font = '9px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
            noteItems.forEach((line, k) => {
                ctx.fillText(line, x + 8, y + 22 + k * 9);
            });
        }
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawDashboard(host, r) {
        const el = getCanvasHost(host);
        if (!el) return;
        el.innerHTML = '';
        el.style.display = 'grid';
        el.style.gridTemplateColumns = '1fr 1fr';
        el.style.gridTemplateRows = '1fr 1fr';
        el.style.gap = '8px';
        ['dash-tl', 'dash-tr', 'dash-bl', 'dash-br'].forEach(id => {
            const d = document.createElement('div');
            d.id = id;
            d.style.background = '#FAFAFA';
            d.style.borderRadius = '6px';
            d.style.overflow = 'hidden';
            el.appendChild(d);
        });
        drawRadarChart('dash-tl', r);
        drawTrendChart('dash-tr', r);
        drawScatterChart('dash-bl', r);
        drawCardChart('dash-br', r);
    }

    async function start(containerId, options) {
        options = Object.assign({}, DEFAULTS, options || {});
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('qxHrvCapture: 找不到容器', containerId);
            return false;
        }

        state.phase = 'idle';
        state.capturing = false;
        state.rafAlive = false;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        releaseCamera();

        state.durationSec = (options.duration == null) ? 120 : options.duration;
        state.warmupSec   = (options.warmupSec == null) ? 10 : options.warmupSec;
        state.warmupSampleSec = (options.warmupSampleSec == null) ? 3 : options.warmupSampleSec;
        state.abortOnNoFinger = (options.abortOnNoFinger !== false);
        state.container = container;
        state.samples = [];
        state.timestamps = [];
        state.rrWithTime = [];
        state.result = null;
        state.recentFrames = [];
        state.noPressStreak = 0;
        state.aborted = false;
        state.elapsedAccum = 0;
        state.lastTs = 0;
        state.onComplete = options.onComplete || null;
        state.onProgress = options.onProgress || null;
        state.onState = options.onState || null;
        state.onAbort = options.onAbort || null;
        state.onWarmupTick = options.onWarmupTick || null;
        state.onWarmupEnd = options.onWarmupEnd || null;
        state.lastProgressAt = 0;
        state.bucketIndex = 0;
        state.bucketFrames = [];
        state.bucketGood = 0;
        state.bucketTotal = 0;
        state.bucketList = [];
        state.dotToggle = 0;
        state.warmupRedSamples = [];
        state.redMid = 60;
        state.redMidLocked = false;
        state.redMidLastUpdate = 0;
        state.redMidRecent = [];
        state.redMaxEver = 0;
        state.totalFrames = 0;
        state.validFrames = 0;
        state.lastDotAt = 0;

        renderUI(container);
        updateTimerMain(0, state.durationSec);
        updateTimerModal(0, state.durationSec);
        const pf = document.getElementById('qx1_heal_modal_progress');
        if (pf) pf.style.width = '0%';
        setHint('未开始', '#5A6B87');
        showIdleHint(true);
        emitState({ quality: 'unknown', hint: '未开始' });

        state.btnStart.onclick = () => startCapture();
        state.btnStop.onclick = () => stopCapture('user');

        try {
            await requestCamera();
        } catch (e) {
            console.error('摄像头申请失败', e);
            setHint('未检测到摄像头', '#C0392B');
            state.btnStart.disabled = true;
            return false;
        }
        return true;
    }

    function startCapture() {
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }

        state.phase = 'warmup';
        state.capturing = true;
        state.rafAlive = true;
        state.aborted = false;
        state.noPressStreak = 0;
        state.elapsedAccum = 0;
        state.lastTs = 0;
        state.lastProgressAt = 0;
        state.samples = [];
        state.timestamps = [];
        state.rrWithTime = [];
        state.result = null;
        state.recentFrames = [];
        state.bucketIndex = 0;
        state.bucketFrames = [];
        state.bucketGood = 0;
        state.bucketTotal = 0;
        state.bucketList = [];
        state.dotToggle = 0;
        state.warmupRemain = state.warmupSec;
        state.warmupLastTick = 0;
        state.warmupFeedback = '';
        state.warmupRedSamples = [];
        state.redMid = 60;
        state.redMidLocked = false;
        state.redMidLastUpdate = 0;
        state.redMidRecent = [];
        state.redMaxEver = 0;
        state.totalFrames = 0;
        state.validFrames = 0;
        state.lastDotAt = 0;
        _dbgFrame = 0;
        if (state.btnStart) state.btnStart.disabled = true;
        if (state.btnStop) state.btnStop.disabled = false;
        setHint(`预备中… ${state.warmupSec} 秒 · 请调整手指轻重`, '#B9770E');
        showIdleHint(false);
        updateTimerMain(`预备 ${state.warmupSec}`, state.warmupSec);
        updateTimerModal(0, state.durationSec);
        emitState({ quality: 'unknown', hint: '预备中' });

        state.rafId = requestAnimationFrame(captureLoop);
    }

    function stop() { stopCapture('user'); }

    function release() {
        state.phase = 'idle';
        state.capturing = false;
        state.rafAlive = false;
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        releaseCamera();
        if (state.container) state.container.innerHTML = '';
        state.container = null;
        state.video = null;
        state.videoWrap = null;
        state.videoWrapSmall = null;
        state.qx2VideoEl = null;
        state.idleHintEl = null;
        state.dotA = null;
        state.dotB = null;
        state.qx2DotA = null;
        state.qx2DotB = null;
        state.result = null;
        state.samples = [];
        state.timestamps = [];
        state.rrWithTime = [];
        state.recentFrames = [];
        state.noPressStreak = 0;
        state.bucketFrames = [];
        state.bucketList = [];
        state.warmupRedSamples = [];
        state.redMid = 60;
        state.redMidLocked = false;
        state.redMidLastUpdate = 0;
        state.redMidRecent = [];
        state.redMaxEver = 0;
        state.totalFrames = 0;
        state.validFrames = 0;
        state.lastDotAt = 0;
        state.onProgress = null;
        state.onComplete = null;
        state.onState = null;
        state.onAbort = null;
        state.onWarmupTick = null;
        state.onWarmupEnd = null;
    }

    function getResult() { return state.result; }
    function getRealtime() { return computeRealtime(); }
    function getPhase() { return state.phase; }
    function getRedMid() { return state.redMid; }

    window.qxHrvCapture = {
        start: start,
        stop: stop,
        release: release,
        getResult: getResult,
        getRealtime: getRealtime,
        getPhase: getPhase,
        getRedMid: getRedMid,
        computeLFHF: computeLFHF,
        drawRadarChart: drawRadarChart,
        drawTrendChart: drawTrendChart,
        drawScatterChart: drawScatterChart,
        drawCardChart: drawCardChart,
        drawDashboard: drawDashboard,
        DEFAULTS: DEFAULTS,
    };

})();