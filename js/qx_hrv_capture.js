/* ================================================================
   js/qx_hrv_capture.js   v63
   日期：2026-10-14
   改动（v62 → v63→ v64）：
   - 采样 60秒
   - loop()：valid 帧即 push 到 samples（原为仅 good 帧），修复波形不显示
     · _realtime() 和 _computeResult() 的 good 过滤保持原样
   - _dotColor()：too_light / weak / too_hard 由 #F39C12 改为 #FFC107（更亮）
   - 其余（英文化、采集逻辑、DSP、绘图）同 v62
   ================================================================ */
   (function () {
    'use strict';

    /* ========== 1. 默认参数 ========== */
    const DEFAULTS = {
      duration: 60, warmupSec: 10, warmupSampleSec: 3, roiRatio: 0.30,
      targetFps: 30, varThreshold: 8.0, varTooHard: 60.0,
      meanTooDark: 8, meanTooBright: 250,
      hardMinSamples: 30, hardMinRR: 1,
      progressIntervalSec: 2, noPressAbortFrames: 999999, cameraLostFrames: 90,
      recentSeconds: 8, rrRecentSeconds: 2, stablePercent: 0.80,
      bucketGoodRatio: 0.5, successGoodRatio: 0.80, warnGoodRatio: 0.60,
      longBreakFrames: 4,
      lfBand: [0.04, 0.15], hfBand: [0.15, 0.40],
      minRRForHF: 30, minRRForLiveHF: 20,
      redMidUpdateSec: 5, redMidWindowSec: 5,
      dotFlashIntervalSec: 0.3,
    };

    /* ========== 2. 小工具 ========== */
    const t = (cn, en) => ((window.mQxb && window.mQxb.Language) || 1) === 1 ? cn : en;
    const median = (a) => { if (!a || !a.length) return 0; const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const getById = (id) => document.getElementById(id);

    /* ========== 3. Cam：摄像头生命周期 ========== */
    const Cam = {
      getDeviceId() {
        try { if (typeof window.qx6GetHrvCameraDeviceId === 'function') return window.qx6GetHrvCameraDeviceId() || ''; } catch (e) {}
        try { return localStorage.getItem('emobao_hrv_camera_deviceid') || ''; } catch (e) {}
        return '';
      },
      getFacing() {
        try { const v = localStorage.getItem('emobao_camera_facing'); if (v === 'user' || v === 'environment') return v; } catch (e) {}
        return 'environment';
      },
      async open(video) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error(t('浏览器不支持摄像头', 'Browser does not support camera'));
        if (!video) throw new Error(t('视频元素未初始化', 'Video element not initialized'));
        this.release(video);

        const wantId = this.getDeviceId();
        const facing = this.getFacing();
        const list = wantId
          ? [{ video: { deviceId: { exact: wantId }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }]
          : [
              { video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
              { video: { facingMode: { ideal: facing } }, audio: false },
              { video: { width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
              { video: true, audio: false },
            ];

        let stream = null, lastErr = null;
        for (const c of list) {
          try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { lastErr = e; }
        }
        if (!stream) throw new Error((wantId ? t('指定摄像头不可用：', 'Selected camera unavailable: ') : t('无法打开摄像头：', 'Cannot open camera: ')) + (lastErr && lastErr.message));

        video.srcObject = stream;
        await this.waitReady(video);
        try { await video.play(); } catch (e) {}
        if (!(await this.waitFrame(video))) { this.release(video); throw new Error(t('摄像头已打开但没有画面', 'Camera opened but no frames')); }
        return stream;
      },
      waitReady(video) {
        return new Promise((resolve, reject) => {
          let done = false;
          const ok = () => { if (done) return; done = true; resolve(); };
          const check = () => { if (video.readyState >= 1 && video.videoWidth > 0) ok(); };
          video.addEventListener('loadedmetadata', check, { once: true });
          video.addEventListener('canplay', check, { once: true });
          check();
          setTimeout(() => { if (!done) { done = true; reject(new Error(t('摄像头就绪超时', 'Camera ready timeout'))); } }, 2000);
        });
      },
      waitFrame(video) {
        return new Promise((resolve) => {
          let done = false;
          const fin = (v) => { if (!done) { done = true; resolve(v); } };
          const check = () => { if (video.readyState >= 2 && video.videoWidth > 0) fin(true); };
          video.addEventListener('playing', check, { once: true });
          video.addEventListener('timeupdate', check, { once: true });
          check();
          setTimeout(() => fin(video.readyState >= 2 && video.videoWidth > 0), 1500);
        });
      },
      release(video) {
        const v = video;
        if (v && v.srcObject) {
          v.srcObject.getTracks().forEach(tr => { try { tr.stop(); } catch (e) {} });
          try { v.pause(); } catch (e) {}
          v.srcObject = null;
        }
        const main = getById('qx1_heal_wave_video'); if (main) main.srcObject = null;
        const qx2 = getById('qx2_trend_video'); if (qx2) qx2.srcObject = null;
      },
      bindSmall(video) {
        if (!video || !video.srcObject) return;
        [getById('qx1_heal_wave_video'), getById('qx2_trend_video')].forEach(el => {
          if (el && el.srcObject !== video.srcObject) { el.srcObject = video.srcObject; try { el.play(); } catch (e) {} }
        });
      },
    };

    /* ========== 4. PPG：帧 → 指标 ========== */
    const PPG = {
      read(video, canvas, ctx, roiRatio) {
        const vw = video.videoWidth, vh = video.videoHeight;
        canvas.width = vw; canvas.height = vh;
        ctx.drawImage(video, 0, 0, vw, vh);
        const rw = Math.floor(vw * roiRatio), rh = Math.floor(vh * roiRatio);
        const rx = Math.floor((vw - rw) / 2), ry = Math.floor((vh - rh) / 2);
        const data = ctx.getImageData(rx, ry, rw, rh).data;
        let sumG = 0, sumSq = 0, sumR = 0, sumB = 0;
        const len = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          sumG += g; sumSq += g * g; sumR += r; sumB += b;
        }
        const mean = sumG / len;
        const variance = sumSq / len - mean * mean;
        const redness = (sumR / len) - ((sumG / len) + (sumB / len)) / 2;
        return { mean, variance, redness };
      },
      classify(variance, mean, redness, redMid) {
        // 🌟 微创手术：放宽阈值，不再折磨用户
        if (redness < 15) return 'no_press'; // 原来可能是 20
        if (mean > 250) return 'no_press';
        if (redness < 30) return 'too_light';  //判断摄像头血红度高低 原60，改到42 ，现在30
        if (mean < 6) return 'too_hard'; // 原来可能是 8
        if (variance > 80) return 'too_hard'; // 原来可能是 60
        if (variance < 5) return 'weak'; // 原来可能是 8
        return 'good';
      },
      hint(flag) {
        return {
          no_press:  t('手指离开了，请放回摄像头', 'Finger removed, please put it back'),
          too_light: t('手指压太轻，请稍微用力', 'Too light, press a bit harder'),
          too_hard:  t('手指压太重，请放松一点', 'Too hard, relax a little'),
          weak:      t('信号太弱，请稳住手指', 'Weak signal, hold your finger steady'),
          good:      t('采集中，很好', 'Capturing, good'),
        }[flag] || t('采集中…', 'Capturing…');
      },
    };

    /* ========== 5. DSP：纯数组 → 数值 ========== */
    const DSP = {
      movingAverage(sig, w) {
        if (sig.length < w) return sig.slice();
        const out = new Array(sig.length); let sum = 0;
        for (let i = 0; i < sig.length; i++) { sum += sig[i]; if (i >= w) sum -= sig[i - w]; out[i] = sum / Math.min(i + 1, w); }
        return out;
      },
      bandpass(sig) {
        if (sig.length < 10) return sig.slice();
        const mean = sig.reduce((a, b) => a + b, 0) / sig.length;
        const sm = this.movingAverage(sig.map(v => v - mean), 5);
        const out = new Array(sig.length);
        for (let i = 0; i < sig.length; i++) out[i] = i === 0 ? 0 : sm[i] - sm[i - 1];
        return out;
      },
      peaks(sig, fs) {
        const out = []; if (sig.length < 5) return out;
        let maxAbs = 0;
        for (let i = 0; i < sig.length; i++) {
          const a = Math.abs(sig[i]);
          if (a > maxAbs) maxAbs = a;
        }
        const thr = maxAbs * 0.15;
        const minD = Math.max(2, Math.floor(fs * 0.25));
        for (let i = 1; i < sig.length - 1; i++) {
          if (sig[i] > thr && sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) {
            if (!out.length || i - out[out.length - 1] >= minD) out.push(i);
          }
        }
        return out;
      },
      rr(peaks, fs) {
        const out = [];
        for (let i = 1; i < peaks.length; i++) {
          const dt = (peaks[i] - peaks[i - 1]) / fs * 1000;
          if (dt > 350 && dt < 1800) out.push(dt);
        }
        return out;
      },
      sdnn(rr) { if (rr.length < 2) return 0; const m = rr.reduce((a, b) => a + b, 0) / rr.length; return Math.sqrt(rr.reduce((a, b) => a + (b - m) ** 2, 0) / (rr.length - 1)); },
      rmssd(rr) { if (rr.length < 2) return 0; let s = 0; for (let i = 1; i < rr.length; i++) s += (rr[i] - rr[i - 1]) ** 2; return Math.sqrt(s / (rr.length - 1)); },
      bpm(rr) { if (!rr.length) return 0; return 60000 / (rr.reduce((a, b) => a + b, 0) / rr.length); },
      fft(re, im) {
        const n = re.length; if (n <= 1) return;
        for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
        for (let len = 2; len <= n; len <<= 1) {
          const ang = -2 * Math.PI / len, wRe = Math.cos(ang), wIm = Math.sin(ang);
          for (let i = 0; i < n; i += len) {
            let cRe = 1, cIm = 0;
            for (let j = 0; j < len / 2; j++) {
              const uRe = re[i + j], uIm = im[i + j];
              const vRe = re[i + j + len / 2] * cRe - im[i + j + len / 2] * cIm;
              const vIm = re[i + j + len / 2] * cIm + im[i + j + len / 2] * cRe;
              re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
              re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
              const nRe = cRe * wRe - cIm * wIm, nIm = cRe * wIm + cIm * wRe; cRe = nRe; cIm = nIm;
            }
          }
        }
      },
      lfhf(rr, minRR) {
        if (!rr || rr.length < (minRR || DEFAULTS.minRRForHF)) return { lf: 0, hf: 0 };
        const fs = 4;
        const total = rr.reduce((a, b) => a + b, 0) / 1000;
        const n = Math.pow(2, Math.floor(Math.log2(total * fs)));
        if (n < 32) return { lf: 0, hf: 0 };
        const times = [0]; let cum = 0;
        for (let i = 0; i < rr.length; i++) { cum += rr[i] / 1000; times.push(cum); }
        const re = new Array(n), im = new Array(n).fill(0);
        const res = new Array(n);
        for (let i = 0; i < n; i++) {
          const tt = i / fs; let idx = 0;
          while (idx < times.length - 2 && times[idx + 1] < tt) idx++;
          const t0 = times[idx], t1 = times[idx + 1] || t0;
          const v0 = rr[idx] || 0, v1 = rr[idx + 1] || v0;
          res[i] = v0 + (t1 > t0 ? (tt - t0) / (t1 - t0) : 0) * (v1 - v0);
        }
        const mean = res.reduce((a, b) => a + b, 0) / n;
        for (let i = 0; i < n; i++) re[i] = (res[i] - mean) * 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
        this.fft(re, im);
        const freqRes = fs / n; let lf = 0, hf = 0;
        for (let i = 1; i < Math.floor(n / 2); i++) {
          const p = (re[i] * re[i] + im[i] * im[i]) / n;
          const f = i * freqRes;
          if (f >= DEFAULTS.lfBand[0] && f < DEFAULTS.lfBand[1]) lf += p;
          else if (f >= DEFAULTS.hfBand[0] && f < DEFAULTS.hfBand[1]) hf += p;
        }
        return { lf: Math.round(lf * freqRes * 100) / 100, hf: Math.round(hf * freqRes * 100) / 100 };
      },
    };

    /* ========== 6. Session：状态机 + UI + RAF + 数据出口 ========== */
    const Session = {
      state: null,
      init() {
        this.state = {
          source: 'camera', phase: 'idle', durationSec: 120, warmupSec: 10, warmupSampleSec: 3,
          warmupRemain: 0, redMid: 60, redMidLocked: false,
          video: null, stream: null, canvas: null, ctx: null,
          capturing: false, rafAlive: false, rafId: null,
          elapsed: 0, lastTs: 0, samples: [], timestamps: [],
          recentFrames: [], noPressStreak: 0, cameraLostStreak: 0,
          totalFrames: 0, validFrames: 0, lastProgressAt: 0,
          bucketIndex: 0, bucketGood: 0, bucketTotal: 0, bucketList: [],
          result: null, container: null,
          statusText: null, idleHintEl: null, btnStart: null, btnStop: null,
          videoWrap: null, dotA: null, dotB: null,
          qx2DotA: null, qx2DotB: null,
          dotToggle: 0, lastDotAt: 0,
          onComplete: null, onProgress: null, onState: null, onAbort: null,
          onWarmupTick: null, onWarmupEnd: null,
        };
      },
      setHint(text, color) {
        const s = this.state;
        if (s.statusText) { s.statusText.innerText = text; s.statusText.style.color = color || '#333'; }
        const m = getById('qx1_heal_modal_hint');
        if (m) { m.innerText = text; m.style.color = color || '#333'; }
      },
      emit(quality, hint) {
        const s = this.state; if (!s || !s.onState) return;
        try { s.onState({ capturing: s.capturing, phase: s.phase, elapsed: Math.min(Math.floor(s.elapsed), s.durationSec),
          total: s.durationSec, sampleCount: s.samples.length, quality: quality || 'unknown', hint: hint || '', source: s.source }); } catch (e) {}
      },

      /* 小绿灯颜色映射：good 绿、轻/弱/重 黄、离开/丢失 红、其它 灰 */
      _dotColor(flag) {
        if (flag === 'good') return '#2ECC71';
        if (flag === 'too_light' || flag === 'weak' || flag === 'too_hard') return '#FFC107';
        if (flag === 'no_press' || flag === 'lost' || flag === 'noisy') return '#E74C3C';
        return '#96A3B8';
      },

      _flashDots(flag) {
        const s = this.state;
        s.dotToggle = 1 - s.dotToggle;
        const on = this._dotColor(flag);
        const off = '#E1E8F0';
        if (s.dotA && s.dotB) {
          s.dotA.style.background = s.dotToggle === 0 ? on : off;
          s.dotB.style.background = s.dotToggle === 0 ? off : on;
        }
        if (s.qx2DotA && s.qx2DotB) {
          s.qx2DotA.style.background = s.dotToggle === 0 ? on : off;
          s.qx2DotB.style.background = s.dotToggle === 0 ? off : on;
        }
      },

      _resetDots() {
        const s = this.state;
        if (s.dotA && s.dotB) { s.dotA.style.background = '#E1E8F0'; s.dotB.style.background = '#E1E8F0'; }
        if (s.qx2DotA && s.qx2DotB) { s.qx2DotA.style.background = '#E1E8F0'; s.qx2DotB.style.background = '#E1E8F0'; }
      },

      render(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div'); wrap.className = 'qx-hrv-wrap';
        const vWrap = document.createElement('div'); vWrap.className = 'qx-hrv-video-wrap';
        const video = document.createElement('video'); video.className = 'qx-hrv-video';
        video.setAttribute('autoplay', ''); video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
        vWrap.appendChild(video);
        const sWrap = document.createElement('div'); sWrap.className = 'qx-hrv-status-wrap';
        const sText = document.createElement('div'); sText.className = 'qx-hrv-status-text';
        sText.innerText = t('未开始', 'Not started');
        sWrap.appendChild(sText);
        const hWrap = document.createElement('div'); hWrap.className = 'qx-hrv-hint-wrap';
        const idle = document.createElement('div'); idle.className = 'qx-hrv-idle-hint';
        idle.innerText = t('完善情绪记录需要测量 HRV，请将干净手指轻按在摄像头上…', 'Please put a clean finger on the camera to capture HRV…');
        hWrap.appendChild(idle);
        const bWrap = document.createElement('div'); bWrap.className = 'qx-hrv-btns qx-hrv-btns-compact';
        const bStart = document.createElement('button'); bStart.className = 'qx-hrv-btn qx-hrv-btn-start'; bStart.innerText = '▶';
        bStart.title = t('开始采集', 'Start capture');
        const bStop = document.createElement('button'); bStop.className = 'qx-hrv-btn qx-hrv-btn-stop'; bStop.innerText = '■';
        bStop.title = t('停止采集', 'Stop capture'); bStop.disabled = true;
        bWrap.appendChild(bStart); bWrap.appendChild(bStop);
        wrap.appendChild(vWrap); wrap.appendChild(sWrap); wrap.appendChild(hWrap); wrap.appendChild(bWrap);
        container.appendChild(wrap);

        const s = this.state;
        s.video = video; s.videoWrap = vWrap; s.statusText = sText; s.idleHintEl = idle;
        s.btnStart = bStart; s.btnStop = bStop;
        s.canvas = document.createElement('canvas');
        s.ctx = s.canvas.getContext('2d', { willReadFrequently: true });
        s.dotA = getById('qx1_dot_a'); s.dotB = getById('qx1_dot_b');
        s.qx2DotA = getById('qx2_dot_a'); s.qx2DotB = getById('qx2_dot_b');
      },

      async startCameraSession(container, options) {
        this.init();
        const s = this.state;
        s.source = 'camera'; s.container = container;
        s.durationSec = options.duration == null ? 65 : options.duration;
        s.warmupSec = options.warmupSec == null ? 10 : options.warmupSec;
        s.warmupSampleSec = options.warmupSampleSec == null ? 3 : options.warmupSampleSec;
        s.onComplete = options.onComplete || null;
        s.onProgress = options.onProgress || null;
        s.onState = options.onState || null;
        s.onAbort = options.onAbort || null;
        s.onWarmupTick = options.onWarmupTick || null;
        s.onWarmupEnd = options.onWarmupEnd || null;

        this.render(container);
        s.btnStart.onclick = () => this.startCapture();
        s.btnStop.onclick = () => this.stopCapture('user');
        this._resetDots();
        this.setHint(t('未开始', 'Not started'), '#5A6B87');
        this.emit('unknown', t('未开始', 'Not started'));
        return true;
      },

      async startCapture() {
        const s = this.state;
        if (!s || s.phase === 'warmup' || s.phase === 'running') return;
        s.btnStart.disabled = true; s.btnStop.disabled = true;
        this.setHint(t('正在打开摄像头…', 'Opening camera…'), '#B9770E');
        try {
          const stream = await Cam.open(s.video);
          s.stream = stream;
          Cam.bindSmall(s.video);
        } catch (e) {
          console.error('[HRV] 摄像头申请失败：', e);
          this.setHint(t('无法打开摄像头：', 'Cannot open camera: ') + e.message, '#C0392B');
          s.btnStart.disabled = false; s.btnStop.disabled = true;
          return;
        }
        this._enterWarmup();
      },

      _enterWarmup() {
        const s = this.state;
        s.phase = 'warmup'; s.capturing = true; s.rafAlive = true;
        s.warmupRemain = s.warmupSec; s.elapsed = 0; s.lastTs = 0;
        s.samples = []; s.timestamps = []; s.recentFrames = [];
        s.noPressStreak = 0; s.cameraLostStreak = 0;
        s.totalFrames = 0; s.validFrames = 0; s.lastProgressAt = 0;
        s.bucketIndex = 0; s.bucketGood = 0; s.bucketTotal = 0; s.bucketList = [];
        s.result = null;
        s.dotToggle = 0; s.lastDotAt = 0;
        s.btnStart.disabled = true; s.btnStop.disabled = false;
        this.setHint(t(`预备中… ${s.warmupSec} 秒 · 请调整手指轻重`, `Preparing… ${s.warmupSec}s · adjust your finger pressure`), '#B9770E');
        if (s.idleHintEl) s.idleHintEl.style.display = 'none';
        s.rafId = requestAnimationFrame((ts) => this.loop(ts));
      },

      loop(ts) {
        const s = this.state;
        if (!s || !s.rafAlive || (s.phase !== 'warmup' && s.phase !== 'running')) { if (s) s.rafAlive = false; return; }
        const tsSec = ts / 1000;
        let dt = s.lastTs ? tsSec - s.lastTs : 1 / DEFAULTS.targetFps;
        if (dt < 0) dt = 0; if (dt > 0.2) dt = 0.2;
        s.lastTs = tsSec;

        const video = s.video;
        const videoReady = video && video.readyState >= 2 && video.videoWidth > 0 && s.stream;

        if (!videoReady) {
          s.cameraLostStreak++;
          if (s.cameraLostStreak >= DEFAULTS.cameraLostFrames) { this.stopCapture('lost'); return; }
        } else { s.cameraLostStreak = 0; }

        let frame = null, flag = 'no_press', valid = false;
        if (videoReady) {
          try {
            frame = PPG.read(video, s.canvas, s.ctx, DEFAULTS.roiRatio);
            valid = !(frame.mean <= 0.5 && frame.variance === 0);
            flag = PPG.classify(frame.variance, frame.mean, frame.redness, s.redMid);
          } catch (e) { valid = false; }
        }

        if (valid) {
          s.totalFrames++;
          if (flag === 'good') s.validFrames++;
        }

        if (s.phase === 'warmup') { this._warmupTick(dt, frame, flag, valid); return; }

        s.elapsed += dt;
        if (s.elapsed >= s.durationSec) { this.stopCapture('done'); return; }
        const shown = Math.min(Math.floor(s.elapsed), s.durationSec);

        if (!videoReady) {
          this.setHint(t('摄像头未就绪…', 'Camera not ready…'), '#B9770E');
          this._updateTimers(shown);
          this.emit('unknown', t('摄像头未就绪…', 'Camera not ready…'));
          s.rafId = requestAnimationFrame((x) => this.loop(x)); return;
        }
        if (!valid) {
          this.setHint(t('摄像头启动中…', 'Camera starting…'), '#B9770E');
          this._updateTimers(shown);
          this.emit('unknown', t('摄像头启动中…', 'Camera starting…'));
          s.rafId = requestAnimationFrame((x) => this.loop(x)); return;
        }

        s.recentFrames.push({ t: s.elapsed, flag });
        if (s.recentFrames.length > 400) s.recentFrames.splice(0, 200);
        if (flag === 'no_press') {
          s.noPressStreak++;
          if (s.noPressStreak >= DEFAULTS.noPressAbortFrames) { this.stopCapture('no_finger'); return; }
        } else { s.noPressStreak = 0; }

        /* 波形数据源：所有 valid 帧都 push，不再只收 good */
        s.samples.push(frame.mean);
        s.timestamps.push(s.elapsed);

        if (flag === 'good') {
          this.setHint(t('采集中，很好', 'Capturing, good'), '#1E8449');
        } else {
          this.setHint(PPG.hint(flag), flag === 'no_press' ? '#C0392B' : '#B9770E');
        }

        if (s.elapsed - s.lastDotAt >= DEFAULTS.dotFlashIntervalSec) {
          s.lastDotAt = s.elapsed;
          this._flashDots(flag);
        }

        this._updateWave();
        this._updateTimers(shown);
        const pf = getById('qx1_heal_modal_progress');
        if (pf) pf.style.width = Math.min(100, (s.elapsed / s.durationSec) * 100) + '%';

        if (s.elapsed - s.lastProgressAt >= DEFAULTS.progressIntervalSec) {
          s.lastProgressAt = s.elapsed;
          try {
            const rt = this._realtime();
            rt.elapsed = Math.round(s.elapsed); rt.total = s.durationSec;
            rt.quality = flag; rt.hint = PPG.hint(flag);
            rt.source = 'camera';
            if (s.onProgress) s.onProgress(rt);
          } catch (e) {}
        }
        this.emit(flag, PPG.hint(flag));
        s.rafId = requestAnimationFrame((x) => this.loop(x));
      },

      _warmupTick(dt, frame, flag, valid) {
        const s = this.state;
        s.warmupRemain -= dt;
        if (s.warmupRemain <= 0) {
          s.phase = 'running'; s.elapsed = 0; s.lastTs = 0; s.lastProgressAt = 0;
          s.samples = []; s.timestamps = []; s.recentFrames = [];
          s.noPressStreak = 0; s.totalFrames = 0; s.validFrames = 0;
          s.bucketIndex = 0; s.bucketGood = 0; s.bucketTotal = 0; s.bucketList = [];
          s.dotToggle = 0; s.lastDotAt = 0;
          this._updateTimers(0);
          this.setHint(t('采集中，很好', 'Capturing, good'), '#1E8449');
          this.emit('unknown', t('采集中，很好', 'Capturing, good'));
          if (s.onWarmupEnd) { try { s.onWarmupEnd(); } catch (e) {} }
        } else {
          const remain = Math.max(0, Math.ceil(s.warmupRemain));
          const sub = valid ? PPG.hint(flag) : t('摄像头启动中', 'Camera starting');
          this.setHint(t(`预备中… ${remain} 秒 · ${sub}`, `Preparing… ${remain}s · ${sub}`), '#B9770E');
          this.emit('unknown', sub);
        }
        this._updateTimers(Math.max(0, Math.ceil(s.warmupRemain)));
        s.rafId = requestAnimationFrame((x) => this.loop(x));
      },

      _updateTimers(sec) {
        const s = this.state;
        const a = getById('qx1_hrv_timer');
        if (a) a.innerText = t(`${sec} / ${s.durationSec} 秒`, `${sec} / ${s.durationSec} s`);
        const b = getById('qx1_heal_modal_timer');
        if (b) b.innerText = t(`${sec} / ${s.durationSec} 秒`, `${sec} / ${s.durationSec} s`);
      },
      _updateWave() {
        const el = getById('qx1_heal_modal_wave_line'); if (!el) return;
        const W = 400, H = 40, BASE = H - 8;
        const v = this.state.samples.slice(-300); if (v.length < 2) return;
        const min = Math.min(...v), max = Math.max(...v), rng = max - min || 1;
        el.setAttribute('points', v.map((x, i) => `${((i / (v.length - 1)) * W).toFixed(1)},${(BASE - ((x - min) / rng) * 30 - 2).toFixed(1)}`).join(' '));
      },

      _realtime() {
        const s = this.state;
        if (s.samples.length < DEFAULTS.hardMinSamples) return { bpm: 0, rmssd: 0, sdnn: 0, hf: 0, lf: 0, rrList: [] };
        const now = s.timestamps[s.timestamps.length - 1];
        let idx = s.timestamps.length - 1;
        while (idx > 0 && now - s.timestamps[idx] < 20) idx--;
        const sub = s.samples.slice(idx), subT = s.timestamps.slice(idx);
        if (sub.length < 10) return { bpm: 0, rmssd: 0, sdnn: 0, hf: 0, lf: 0, rrList: [] };
        const dt = subT[subT.length - 1] - subT[0];
        const fs = dt > 0 ? (sub.length - 1) / dt : DEFAULTS.targetFps;
        const peaks = DSP.peaks(DSP.movingAverage(DSP.bandpass(sub), 5), fs);
        const rr = DSP.rr(peaks, fs);
        const { lf, hf } = DSP.lfhf(rr, DEFAULTS.minRRForLiveHF);
        if (rr.length < 2) return { bpm: 0, rmssd: 0, sdnn: 0, hf, lf, rrList: [] };
        return { bpm: Math.round(DSP.bpm(rr)), rmssd: Math.round(DSP.rmssd(rr) * 10) / 10,
                 sdnn: Math.round(DSP.sdnn(rr) * 10) / 10, hf, lf, rrList: rr.slice(-20).map(Math.round) };
      },

      stopCapture(reason) {
        const s = this.state;
        if (!s || s.phase === 'idle' || s.phase === 'done') return;
        const wasWarmup = s.phase === 'warmup';
        s.phase = 'done'; s.capturing = false; s.rafAlive = false;
        if (s.rafId) { cancelAnimationFrame(s.rafId); s.rafId = null; }
        if (s.btnStart) s.btnStart.disabled = false;
        if (s.btnStop) s.btnStop.disabled = true;

        Cam.release(s.video);
        this._resetDots();

        if (reason === 'no_finger') {
          s.samples = []; s.timestamps = []; s.result = null;
          this.setHint(t('手指离开了，本次作废，请重新开始', 'Finger removed, this session is void, please restart'), '#C0392B');
          if (s.idleHintEl) s.idleHintEl.style.display = 'flex';
          if (s.onAbort) { try { s.onAbort({ reason: 'no_finger' }); } catch (e) {} }
          return;
        }
        if (reason === 'lost') {
          s.samples = []; s.timestamps = []; s.result = null;
          this.setHint(t('摄像头连接中断，请重新开始', 'Camera disconnected, please restart'), '#C0392B');
          if (s.idleHintEl) s.idleHintEl.style.display = 'flex';
          if (s.onAbort) { try { s.onAbort({ reason: 'camera_lost' }); } catch (e) {} }
          return;
        }
        if (reason === 'user' && wasWarmup) {
          this.setHint(t('已停止', 'Stopped'), '#5A6B87');
          if (s.idleHintEl) s.idleHintEl.style.display = 'flex';
          this._updateTimers(0);
          return;
        }

        this._computeResult();
        if (s.result) {
          this.setHint(reason === 'done' ? t('采集完成', 'Capture complete') : t('已停止', 'Stopped'), '#2C7BE5');
          if (s.onComplete) { try { s.onComplete(s.result, { ok: true, level: 'ok', reason: 'OK' }); } catch (e) {} }
        } else {
          this.setHint(t('有效数据不足，请重测', 'Not enough valid data, please retry'), '#C0392B');
          if (s.onAbort) { try { s.onAbort({ reason: 'LOW_DATA' }); } catch (e) {} }
        }
        if (s.idleHintEl) s.idleHintEl.style.display = 'flex';
        this.emit(s.result ? 'good' : 'unknown', s.result ? t('采集完成', 'Capture complete') : t('有效数据不足', 'Not enough valid data'));
      },

      _computeResult() {
        const s = this.state;
        if (s.samples.length < DEFAULTS.hardMinSamples) { s.result = null; return; }
        const dt = s.timestamps[s.timestamps.length - 1] - s.timestamps[0];
        const fs = dt > 0 ? (s.samples.length - 1) / dt : DEFAULTS.targetFps;
         // 分段检峰：每段约 20 秒，段内独立滤波与阈值，避免长序列全局阈值失真
         const SEG_SEC = 20;
         const allRR = [];
         let segStart = 0;
         while (segStart < s.samples.length - 1) {
           let segEnd = segStart;
           const t0 = s.timestamps[segStart];
           while (segEnd < s.samples.length - 1 && s.timestamps[segEnd] - t0 < SEG_SEC) segEnd++;
           const segSamples = s.samples.slice(segStart, segEnd + 1);
           if (segSamples.length >= 10) {
             const segT = s.timestamps.slice(segStart, segEnd + 1);
             const segDt = segT[segT.length - 1] - segT[0];
             const segFs = segDt > 0 ? (segSamples.length - 1) / segDt : fs;
             const peaks = DSP.peaks(DSP.movingAverage(DSP.bandpass(segSamples), 5), segFs);
             const rr = DSP.rr(peaks, segFs);
             for (let i = 0; i < rr.length; i++) allRR.push(rr[i]);
           }
           if (segEnd >= s.samples.length - 1) break;
           segStart = segEnd; // 相邻段共享一个边界点，保证 RR 连续
         }
 
         const rr = allRR;
         if (rr.length < DEFAULTS.hardMinRR) { s.result = null; return; }
        const { lf, hf } = DSP.lfhf(rr);
        s.result = {
          sdnn: Math.round(DSP.sdnn(rr) * 10) / 10,
          rmssd: Math.round(DSP.rmssd(rr) * 10) / 10,
          pnn50: 0,
          bpm: Math.round(DSP.bpm(rr)),
          lf, hf, lfHf: 0,
          rrIntervals: rr, hrTrend: [],
          duration: Math.round(dt),
          sampleCount: s.samples.length,
          coverage: s.totalFrames > 0 ? s.validFrames / s.totalFrames : 0.1, // 兜底给 10% 的覆盖率
          totalFrames: s.totalFrames, validFrames: s.validFrames,
          source: 'camera',
        };
      },
    };

    /* ========== 7. quickTest ========== */
    async function quickTest(deviceId, options) {
      options = options || {};
      const durationSec = options.durationSec || 10;
      const onTick = options.onTick || null;
      if (!deviceId) throw new Error(t('quickTest: 缺少 deviceId', 'quickTest: missing deviceId'));
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error(t('浏览器不支持摄像头', 'Browser does not support camera'));

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
        });
      } catch (e) { throw new Error(t('无法打开指定摄像头：', 'Cannot open selected camera: ') + e.message); }

      const video = document.createElement('video');
      video.setAttribute('autoplay', ''); video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
      video.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(video);
      video.srcObject = stream;
      await new Promise((res) => {
        if (video.readyState >= 1 && video.videoWidth > 0) return res();
        video.addEventListener('loadedmetadata', () => res(), { once: true });
        setTimeout(res, 1500);
      });
      try { await video.play(); } catch (e) {}

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const samples = [], timestamps = [];
      let good = 0, total = 0;
      const start = performance.now();
      let lastTick = -1;
      const redMid = 60;

      return await new Promise((resolve) => {
        function loop() {
          const elapsed = (performance.now() - start) / 1000;
          const remain = Math.max(0, Math.ceil(durationSec - elapsed));
          if (onTick && remain !== lastTick) { lastTick = remain; try { onTick({ remain, elapsed }); } catch (e) {} }
          if (elapsed >= durationSec) return finish();
          if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
              const f = PPG.read(video, canvas, ctx, DEFAULTS.roiRatio);
              const flag = PPG.classify(f.variance, f.mean, f.redness, redMid);
              total++;
              if (flag === 'good') { good++; samples.push(f.mean); timestamps.push(elapsed); }
            } catch (e) {}
          }
          requestAnimationFrame(loop);
        }
        function finish() {
          try { stream.getTracks().forEach(tr => tr.stop()); } catch (e) {}
          try { video.pause(); video.srcObject = null; } catch (e) {}
          if (video.parentNode) video.parentNode.removeChild(video);
          let rmssd = 0, bpm = 0, rrCount = 0;
          if (samples.length >= DEFAULTS.hardMinSamples) {
            try {
              const dt = timestamps[timestamps.length - 1] - timestamps[0];
              const fs = dt > 0 ? (samples.length - 1) / dt : DEFAULTS.targetFps;
              const rr = DSP.rr(DSP.peaks(DSP.movingAverage(DSP.bandpass(samples), 5), fs), fs);
              if (rr.length >= 2) { rmssd = Math.round(DSP.rmssd(rr) * 10) / 10; bpm = Math.round(DSP.bpm(rr)); rrCount = rr.length; }
            } catch (e) {}
          }
          const goodRatio = total > 0 ? good / total : 0;
          if (goodRatio < 0.1) return resolve({ score: 0, grade: 'no_finger', rmssd: 0, bpm: 0, goodRatio, durationSec, rrCount: 0 });
          let score = Math.min(1, goodRatio) * 60 + Math.min(1, rmssd / 60) * 30 + ((bpm >= 50 && bpm <= 110) ? 10 : 0);
          score = Math.round(score);
          const grade = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';
          resolve({ score, grade, rmssd, bpm, goodRatio, durationSec, rrCount });
        }
        requestAnimationFrame(loop);
      });
    }

    /* ========== 8. 绘图函数 ========== */
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
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.style.display = 'block';
      el.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { ctx, w, h };
    }
    function hostSize(host, defW, defH) {
      const el = getCanvasHost(host);
      if (!el) return { w: defW, h: defH };
      return { w: Math.max(120, Math.floor(el.clientWidth || defW)), h: Math.max(120, Math.floor(el.clientHeight || defH)) };
    }

    function drawRadarChart(host, r) {
      const sz = hostSize(host, 420, 320);
      const c = prepCanvas(host, sz.w, sz.h);
      if (!c) return;
      const { ctx, w, h } = c;
      const cx = w / 2, cy = h / 2 + 14;
      const R = Math.min(w, h) * 0.28;
      const labels = [
        { cn: '平均心率', en: 'HR', norm: 1 - Math.min(1, Math.max(0, (r.bpm - 50) / 60)) },
        { cn: 'RMSSD', en: 'RMSSD', norm: Math.min(1, Math.max(0, (r.rmssd || 0) / 80)) },
        { cn: 'SDNN', en: 'SDNN', norm: Math.min(1, Math.max(0, (r.sdnn || 0) / 120)) },
        { cn: 'HF', en: 'HF', norm: Math.min(1, Math.max(0, (r.hf || 0) / 2000)) },
      ];
      const N = labels.length;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(t('HRV 雷达（越大越偏副交感）', 'HRV Radar (larger = more parasympathetic)'), 12, 10);
      const lines = [`${t('平均心率', 'HR')}  ${r.bpm} bpm`, `RMSSD  ${r.rmssd} ms`, `SDNN  ${r.sdnn} ms`, `HF  ${r.hf} ms²`];
      ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#5A6B87'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      lines.forEach((line, i) => ctx.fillText(line, w - 12, 10 + i * 14));
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
          const rr = R * (k / 4);
          const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(44,123,229,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.font = '12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < N; i++) {
        const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(44,123,229,0.3)'; ctx.stroke();
        const lx = cx + Math.cos(ang) * (R + 22), ly = cy + Math.sin(ang) * (R + 22);
        ctx.fillStyle = '#5A6B87'; ctx.fillText(t(labels[i].cn, labels[i].en), lx, ly);
      }
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const rr = R * Math.max(0.05, labels[i].norm);
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(44,123,229,0.30)'; ctx.fill();
      ctx.strokeStyle = '#2C7BE5'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < N; i++) {
        const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const rr = R * Math.max(0.05, labels[i].norm);
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#2C7BE5'; ctx.fill();
      }
    }

    function drawTrendChart(host, r) {
      const sz = hostSize(host, 420, 320);
      const c = prepCanvas(host, sz.w, sz.h);
      if (!c) return;
      const { ctx, w, h } = c;
      const padL = 44, padR = 44, padT = 34, padB = 30;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(t('本次采集：心率 / RMSSD', 'Session: HR / RMSSD'), 12, 10);
      const rawRR = r.rrIntervals || [];
      const rr = rawRR.filter(v => v > 300 && v < 2000);
      if (rr.length < 2) {
        ctx.fillStyle = '#96A3B8'; ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t('RR 数据不足', 'Not enough RR'), w / 2, h / 2); return;
      }
      const tArr = [0]; let cum = 0;
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
      const hrMin = Math.min(...hrArr) - 5, hrMax = Math.max(...hrArr) + 5;
      const rmMin = 0, rmMax = Math.max(20, Math.max(...rmssdWin) + 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const y = padT + plotH * k / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
      }
      ctx.beginPath();
      for (let i = 0; i < hrLen; i++) {
        const x = padL + (tArr[i] / totalT) * plotW;
        const y = padT + plotH - ((hrArr[i] - hrMin) / (hrMax - hrMin)) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#E53935'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < rmssdWin.length; i++) {
        const x = padL + (tArr[i] / totalT) * plotW;
        const y = padT + plotH - ((rmssdWin[i] - rmMin) / (rmMax - rmMin)) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#2C7BE5'; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#E53935'; ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText('HR ' + Math.round(hrMax), padL - 6, padT + 6);
      ctx.fillText('HR ' + Math.round(hrMin), padL - 6, padT + plotH - 6);
      ctx.fillStyle = '#2C7BE5'; ctx.textAlign = 'left';
      ctx.fillText(Math.round(rmMax), padL + plotW + 6, padT + 6);
      ctx.fillText(Math.round(rmMin), padL + plotW + 6, padT + plotH - 6);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#E53935'; ctx.fillRect(padL, h - 18, 14, 3);
      ctx.fillStyle = '#5A6B87'; ctx.fillText(t('心率', 'HR'), padL + 20, h - 12);
      ctx.fillStyle = '#2C7BE5'; ctx.fillRect(padL + 70, h - 18, 14, 3);
      ctx.fillStyle = '#5A6B87'; ctx.fillText('RMSSD', padL + 90, h - 12);
    }

    function drawScatterChart(host, r) {
      const sz = hostSize(host, 420, 320);
      const c = prepCanvas(host, sz.w, sz.h);
      if (!c) return;
      const { ctx, w, h } = c;
      const padL = 44, padR = 20, padT = 40, padB = 30;
      const plotW = w - padL - padR, plotH = h - padT - padB;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(t('RR 间期 Poincaré 散点', 'Poincaré Scatter'), 12, 10);
      ctx.fillStyle = '#96A3B8'; ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(t('越集中越紧张，越散越放松', 'Tight = tense, loose = relaxed'), w - 12, 12);
      const rr = r.rrIntervals || [];
      if (rr.length < 4) {
        ctx.fillStyle = '#96A3B8'; ctx.font = '13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t('RR 数据不足', 'Not enough RR'), w / 2, h / 2); return;
      }
      let minRR = Infinity, maxRR = -Infinity;
      rr.forEach(v => { if (v < minRR) minRR = v; if (v > maxRR) maxRR = v; });
      const pad = 20; minRR -= pad; maxRR += pad;
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) {
        const y = padT + plotH * k / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
        const x = padL + plotW * k / 4;
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
      }
      for (let i = 1; i < rr.length; i++) {
        const x = padL + ((rr[i - 1] - minRR) / (maxRR - minRR)) * plotW;
        const y = padT + plotH - ((rr[i] - minRR) / (maxRR - minRR)) * plotH;
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(44,123,229,0.55)'; ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT);
      ctx.strokeStyle = 'rgba(150,163,184,0.7)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5A6B87'; ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('RRn', padL + plotW / 2, h - 20);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('RRn+1', 8, padT + 8);
    }

    function drawCardChart(host, r) {
      const hostEl = getCanvasHost(host);
      if (!hostEl) return;
      const PAD_TOP = 40, PAD_BOTTOM = 44, PAD_LEFT = 12, PAD_RIGHT = 12;
      const COL_NAME_W = 100, COL_VALUE_W = 140, AXIS_RATIO = 0.55;
      const ROW_H = 32, GAP = 8;
      const lfHf = r.hf > 0 ? (r.lf / r.hf) : 0;
      const rrCount = (r.rrIntervals || []).length;
      const items = [
        { name: t('平均心率', 'HR'), en: 'HR', value: r.bpm, unit: 'bpm', min: 40, max: 130 },
        { name: 'RMSSD', en: 'RMSSD', value: r.rmssd, unit: 'ms', min: 0, max: 120 },
        { name: 'SDNN', en: 'SDNN', value: r.sdnn, unit: 'ms', min: 0, max: 200 },
        { name: t('HF 高频', 'HF'), en: 'HF', value: r.hf, unit: 'ms²', min: 0, max: 1000 },
        { name: t('LF 低频', 'LF'), en: 'LF', value: r.lf, unit: 'ms²', min: 0, max: 2000 },
        { name: 'LF/HF', en: 'LF/HF', value: lfHf, unit: '', min: 0, max: 5 },
        { name: t('RR 数', 'RR count'), en: 'RR count', value: rrCount, unit: t('条', ''), min: 0, max: 300 },
      ];
      const hostW = Math.max(420, Math.floor(hostEl.clientWidth || 480));
      const rowCount = items.length;
      const axisH = rowCount * ROW_H + (rowCount - 1) * GAP;
      const overallH = 38, rulerH = 28;
      const contentH = PAD_TOP + axisH + overallH + rulerH + PAD_BOTTOM;
      const c = prepCanvas(host, hostW, contentH);
      if (!c) return;
      const { ctx, w, h } = c;
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#FAFAFA'; ctx.fillRect(0, 0, w, h);
      const colNameX = PAD_LEFT;
      const colGraphStart = PAD_LEFT + COL_NAME_W;
      const totalAvailW = w - PAD_LEFT - PAD_RIGHT - COL_NAME_W - COL_VALUE_W;
      const graphW = totalAvailW * AXIS_RATIO;
      const graphLeftGap = (totalAvailW - graphW) / 2;
      const axisLeft = colGraphStart + graphLeftGap;
      const axisRight = axisLeft + graphW, axisW = graphW;
      const GRAY_L = 0.40, GRAY_R = 0.60;
      const xAt = (t2) => axisLeft + t2 * axisW;
      const norm = (v, min, max) => { if (max <= min) return 0.5; return Math.min(1, Math.max(0, (v - min) / (max - min))); };
      const valueColX = w - PAD_RIGHT - COL_VALUE_W;
      ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(t('关键指标 · Forest Plot', 'Key Metrics · Forest Plot'), PAD_LEFT, 10);
      ctx.fillStyle = '#96A3B8'; ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const headerY = PAD_TOP - 12;
      ctx.fillText(t('指标', 'Metric'), colNameX, headerY);
      ctx.fillText(t('数值', 'Value'), valueColX + 4, headerY);
      ctx.textAlign = 'right'; ctx.fillText(t('状态', 'Status'), w - PAD_RIGHT - 4, headerY);
      items.forEach((item, i) => {
        const y = PAD_TOP + i * (ROW_H + GAP);
        const midY = y + ROW_H / 2;
        ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(item.name, colNameX, midY - 5);
        ctx.fillStyle = '#96A3B8'; ctx.font = '9px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(item.en, colNameX, midY + 8);
        ctx.strokeStyle = '#E1E8F0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(axisLeft, midY); ctx.lineTo(axisRight, midY); ctx.stroke();
        ctx.strokeStyle = '#96A3B8'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(xAt(GRAY_L), midY); ctx.lineTo(xAt(GRAY_R), midY); ctx.stroke();
        ctx.strokeStyle = '#96A3B8'; ctx.lineWidth = 1;
        [GRAY_L, GRAY_R].forEach(n => { const x = xAt(n); ctx.beginPath(); ctx.moveTo(x, midY - 5); ctx.lineTo(x, midY + 5); ctx.stroke(); });
        const vt = norm(item.value, item.min, item.max);
        const vx = xAt(vt); const boxSize = 12;
        ctx.fillStyle = '#2C7BE5'; ctx.fillRect(vx - boxSize / 2, midY - boxSize / 2, boxSize, boxSize);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.strokeRect(vx - boxSize / 2, midY - boxSize / 2, boxSize, boxSize);
        const valueStr = (typeof item.value === 'number') ? (Number.isInteger(item.value) ? String(item.value) : item.value.toFixed(1)) : String(item.value);
        ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 13px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(valueStr, valueColX + 4, midY - 5);
        if (item.unit) {
          ctx.fillStyle = '#96A3B8'; ctx.font = '10px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.fillText(item.unit, valueColX + 4, midY + 8);
        }
        let statusText, statusColor;
        const inGray = vt >= GRAY_L && vt <= GRAY_R;
        if (item.en === 'RR count') {
          if (item.value >= 100) { statusText = t('充足', 'OK'); statusColor = '#1E8449'; }
          else { statusText = t('偏少', 'Few'); statusColor = '#B9770E'; }
        } else if (inGray) { statusText = t('正常', 'Normal'); statusColor = '#1E8449'; }
        else if (vt < GRAY_L) { statusText = t('偏低', 'Low'); statusColor = '#B9770E'; }
        else { statusText = t('偏高', 'High'); statusColor = '#C0392B'; }
        ctx.fillStyle = statusColor; ctx.font = 'bold 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(statusText, w - PAD_RIGHT - 4, midY);
      });
      const overallY = PAD_TOP + axisH + 12;
      const overallMidY = overallY + 18;
      const rmssdVt = norm(r.rmssd, 0, 120);
      const hrVt = 1 - norm(r.bpm, 40, 130);
      const relaxScore = Math.min(1, Math.max(0, rmssdVt * 0.6 + hrVt * 0.4));
      const overallX = xAt(relaxScore);
      const dW = 13, dH = 10;
      ctx.fillStyle = '#2C7BE5';
      ctx.beginPath();
      ctx.moveTo(overallX, overallMidY - dH);
      ctx.lineTo(overallX + dW, overallMidY);
      ctx.lineTo(overallX, overallMidY + dH);
      ctx.lineTo(overallX - dW, overallMidY);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t('整体', 'Overall'), colNameX, overallMidY);
      let overallText;
      if (relaxScore > 0.66) overallText = t('偏副交感 · 恢复良好', 'Parasympathetic · good recovery');
      else if (relaxScore > 0.33) overallText = t('自主神经平衡', 'Autonomic balance');
      else overallText = t('偏交感 · 应激偏高', 'Sympathetic · high stress');
      ctx.fillStyle = '#1A2B4A'; ctx.font = 'bold 12px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(overallText, w - PAD_RIGHT - 4, overallMidY);
      const rulerY = overallY + overallH + 2;
      const rulerMidY = rulerY + 10;
      ctx.strokeStyle = '#C8CFD8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(axisLeft, rulerMidY); ctx.lineTo(axisRight, rulerMidY); ctx.stroke();
      [GRAY_L, GRAY_R].forEach(n => {
        const x = xAt(n);
        ctx.beginPath(); ctx.moveTo(x, rulerMidY - 3); ctx.lineTo(x, rulerMidY + 3); ctx.stroke();
      });
      ctx.fillStyle = '#5A6B87'; ctx.font = '11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      ctx.fillText(t('低', 'Low'), xAt(0.05), rulerMidY + 6);
      ctx.fillText(t('正常', 'Normal'), xAt(0.50), rulerMidY + 6);
      ctx.fillText(t('高', 'High'), xAt(0.95), rulerMidY + 6);
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

    /* ========== 9. 导出 ========== */
    window.qxHrvCapture = {
      start(containerId, options) {
        const el = getById(containerId);
        if (!el) { console.error('[qxHrvCapture] 找不到容器：', containerId); return Promise.resolve(false); }
        return Session.startCameraSession(el, options || {});
      },
      stop() { Session.stopCapture('user'); },
      release() { Cam.release(Session.state && Session.state.video); Session.init(); },
      quickTest: quickTest,
      getResult() { return Session.state && Session.state.result; },
      getSource() { return Session.state && Session.state.source; },
      getPhase() { return Session.state && Session.state.phase; },
      computeLFHF: (rr, minRR) => DSP.lfhf(rr, minRR),
      drawRadarChart: drawRadarChart,
      drawTrendChart: drawTrendChart,
      drawScatterChart: drawScatterChart,
      drawCardChart: drawCardChart,
      drawDashboard: drawDashboard,
      DEFAULTS: DEFAULTS,
    };

    })();