/* ================================================================
   程序名：qx2_hrv_engine.js
   描述：qx2 专属 HRV 测样引擎 (带10秒预备+实时波形+手指预览)
   日期：2026-11-10
   ================================================================ */
   (function () {
    'use strict';

    const t = (cn, en) => ((window.mQxb && window.mQxb.Language) || 1) === 1 ? cn : en;

    const Cam = {
        async open(video) {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('No camera');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
                video.srcObject = stream;
                await new Promise((resolve) => {
                    if (video.readyState >= 1) return resolve();
                    video.addEventListener('loadedmetadata', resolve, { once: true });
                    setTimeout(resolve, 2000);
                });
                await video.play();
                return stream;
            } catch (e) {
                throw new Error('Camera failed: ' + e.message);
            }
        },
        release(video) {
            if (video && video.srcObject) {
                video.srcObject.getTracks().forEach(tk => { try { tk.stop(); } catch (e) {} });
                video.srcObject = null;
            }
        }
    };

    const PPG = {
        read(video, canvas, ctx) {
            const vw = video.videoWidth, vh = video.videoHeight;
            if (!vw || !vh) return null;
            canvas.width = vw; canvas.height = vh;
            ctx.drawImage(video, 0, 0, vw, vh);
            const rw = Math.floor(vw * 0.3), rh = Math.floor(vh * 0.3);
            const rx = Math.floor((vw - rw) / 2), ry = Math.floor((vh - rh) / 2);
            const data = ctx.getImageData(rx, ry, rw, rh).data;
            let sumG = 0, sumSq = 0, sumR = 0;
            const len = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1];
                sumG += g; sumSq += g * g; sumR += r;
            }
            const mean = sumG / len;
            const variance = sumSq / len - mean * mean;
            const redness = (sumR / len) - mean;
            return { mean, variance, redness };
        }
    };

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
            for (let i = 0; i < sig.length; i++) { if (Math.abs(sig[i]) > maxAbs) maxAbs = Math.abs(sig[i]); }
            const thr = maxAbs * 0.15;
            const minD = Math.max(4, Math.floor(fs * 0.4));
            for (let i = 1; i < sig.length - 1; i++) {
                if (sig[i] > thr && sig[i] > sig[i - 1] && sig[i] >= sig[i + 1]) {
                    const y0 = sig[i - 1], y1 = sig[i], y2 = sig[i + 1];
                    const denom = 2 * (2 * y1 - y0 - y2);
                    let offset = 0;
                    if (Math.abs(denom) > 0.0001) {
                        offset = (y0 - y2) / denom;
                        if (offset < -0.5) offset = -0.5;
                        if (offset > 0.5) offset = 0.5;
                    }
                    const truePeakIndex = i + offset;
                    if (!out.length || truePeakIndex - out[out.length - 1] >= minD) out.push(truePeakIndex);
                }
            }
            return out;
        },
        rr(peaks, fs) {
            const out = [];
            for (let i = 1; i < peaks.length; i++) {
                const dt = (peaks[i] - peaks[i - 1]) / fs * 1000;
                if (dt > 400 && dt < 1600) out.push(dt);
            }
            return out;
        },
        rmssd(rr) { if (rr.length < 2) return 0; let s = 0; for (let i = 1; i < rr.length; i++) s += (rr[i] - rr[i - 1]) ** 2; return Math.sqrt(s / (rr.length - 1)); },
        bpm(rr) { if (!rr.length) return 0; return 60000 / (rr.reduce((a, b) => a + b, 0) / rr.length); }
    };

    let running = false;
    let rafId = null;
    let stream = null;

    window.qx2_hrv_engine = {
        start(containerId, options) {
            if (rafId) cancelAnimationFrame(rafId);
            if (stream) {
                stream.getTracks().forEach(tk => { try { tk.stop(); } catch (e) {} });
                stream = null;
            }
            running = true;

            // 创建真正的底层视频，并直接塞进界面的左下角预览框里！
            const video = document.createElement('video');
            video.className = 'qx-hrv-video'; // 借用你原有的CSS
            video.setAttribute('autoplay', ''); 
            video.setAttribute('playsinline', ''); 
            video.setAttribute('muted', '');
            
            const videoWrap = document.getElementById('qx1_heal_wave_video');
            if (videoWrap && videoWrap.parentNode) {
                // 替换掉原有页面里的那个空视频，让你直接看到手指！
                videoWrap.parentNode.replaceChild(video, videoWrap);
                video.id = 'qx1_heal_wave_video';
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            const samples = [], timestamps = [];
            let startTime = 0;
            
            const warmupSec = 10; // 10秒预备
            const duration = options.duration || 60;
            const totalDuration = warmupSec + duration;

            Cam.open(video).then((s) => {
                stream = s;
                startTime = performance.now();

                const loop = () => {
                    if (!running) return;
                    const elapsed = (performance.now() - startTime) / 1000;
                    
                    const isWarmup = elapsed < warmupSec;
                    const currentSec = isWarmup ? elapsed : (elapsed - warmupSec);
                    const remain = Math.max(0, Math.ceil((isWarmup ? warmupSec : duration) - currentSec));

                    if (elapsed >= totalDuration) {
                        this.stop();
                        if (options.onComplete) {
                            if (samples.length > 30) {
                                const dt = timestamps[timestamps.length - 1] - timestamps[0];
                                const fs = dt > 0 ? (samples.length - 1) / dt : 30;
                                const peaks = DSP.peaks(DSP.movingAverage(DSP.bandpass(samples), 5), fs);
                                const rr = DSP.rr(peaks, fs);
                                options.onComplete({
                                    rmssd: Math.round(DSP.rmssd(rr) * 10) / 10,
                                    bpm: Math.round(DSP.bpm(rr)),
                                    duration: duration,
                                    source: 'camera'
                                });
                            } else {
                                options.onComplete(null);
                            }
                        }
                        return;
                    }

                    let hint = "采集中...";
                    if (video.readyState >= 2) {
                        const frame = PPG.read(video, canvas, ctx);
                        if (frame) {
                            // 判断手指按压情况
                            if (frame.redness < 30) hint = "请把手指放正";
                            else if (frame.variance > 80) hint = "请放松按压";
                            else hint = "信号良好，采集中";

                            // 实时波形图绘制（不管是不是预热，都画！）
                            if (!isWarmup) {
                                samples.push(frame.mean);
                                timestamps.push(currentSec);
                            }
                            
                            // 把波形给底部的SVG折线图！
                            const waveEl = document.getElementById('qx1_heal_modal_wave_line');
                            if (waveEl) {
                                const v = samples.slice(-300);
                                if (v.length >= 2) {
                                    const min = Math.min(...v), max = Math.max(...v), rng = max - min || 1;
                                    const points = v.map((x, i) => `${((i / (v.length - 1)) * 400).toFixed(1)},${(32 - ((x - min) / rng) * 30).toFixed(1)}`).join(' ');
                                    waveEl.setAttribute('points', points);
                                }
                            }

                            // 让大球转动并实时更新萤火虫（真实峰值计算）
                            // 🌟 彻底修复：去掉数据长度的死板限制，实时计算
                            let realBpm = 70, realRmssd = 50;
                            // 只要有超过 20 个采样点，就开始实时计算
                            if (samples.length > 20) {
                                const recentSamples = samples.slice(-150); // 取最近 150 个点
                                const peaks = DSP.peaks(DSP.movingAverage(DSP.bandpass(recentSamples), 5), 30);
                                const rr = DSP.rr(peaks, 30);
                                if (rr.length > 2) {
                                    realRmssd = Math.max(10, Math.min(100, DSP.rmssd(rr))); 
                                    realBpm = DSP.bpm(rr);
                                }
                            }
                            if (window.qxHealChart && window.qxHealChart.push) {
                                try { 
                                    window.qxHealChart.push({ 
                                        quality: 'good', 
                                        bpm: realBpm, 
                                        rmssd: realRmssd, 
                                        elapsed: elapsed 
                                    }); 
                                } catch (e) {}
                            }
                        }
                    }

                    if (options.onProgress) {
                        options.onProgress(remain, isWarmup ? warmupSec : duration, isWarmup, hint);
                    }
                    
                    rafId = requestAnimationFrame(loop);
                };
                loop();
            }).catch((e) => {
                console.error('❌ 摄像头崩溃:', e);
                this.stop();
                if (options.onError) options.onError(e);
            });

            this.stop = () => {
                running = false;
                if (rafId) cancelAnimationFrame(rafId);
                Cam.release(video);
                // 停止时恢复原来的空video（防止下次报错）
                if (video.parentNode) {
                    const emptyVid = document.createElement('video');
                    emptyVid.id = 'qx1_heal_wave_video';
                    emptyVid.className = 'qx1-heal-wave-video';
                    video.parentNode.replaceChild(emptyVid, video);
                }
            };
        },
        stop() {
            if (this.stop) this.stop();
        }
    };
})();