/* ================================================================
   情绪宝 - Polar H10 蓝牙心率带模块
   v8：2026-10-10
   彻底换路：
   - 放弃 PMD（Polar 私有协议），改走标准 Heart Rate Service
   - 0x180D / 0x2A37（所有蓝牙心率带都支持）
   - 每帧解析 flags & 0x10：带 RR 就用真实 RR，不带就用 bpm 反推
   - 代码量减少 60%，稳定性质变
   ================================================================ */
   (function () {
    'use strict';

    const HR_SERVICE_UUID     = '0000180d-0000-1000-8000-00805f9b34fb';
    const HR_MEASUREMENT_UUID = '00002a37-0000-1000-8000-00805f9b34fb';

    /* 兼容旧引用（其他文件可能引用这些常量） */
    const PMD_SERVICE_UUID = HR_SERVICE_UUID;

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    function isBluetoothSupported() {
        return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
    }

    function getUnsupportedReason() {
        if (!navigator.bluetooth) {
            const ua = navigator.userAgent || '';
            if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
                return t('Safari 不支持蓝牙心率带，请使用 Chrome 或 Android 手机',
                         'Safari does not support Bluetooth heart rate straps. Please use Chrome or an Android device.');
            }
            if (/iPhone|iPad|iPod/.test(ua)) {
                return t('iOS 不支持蓝牙心率带，请使用摄像头测量',
                         'iOS does not support Bluetooth heart rate straps. Please use the camera.');
            }
            return t('本机浏览器不支持蓝牙心率带',
                     'This browser does not support Bluetooth heart rate straps.');
        }
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            return t('蓝牙需要 HTTPS 环境', 'Bluetooth requires HTTPS');
        }
        return '';
    }

    let state = {
        device: null,
        server: null,
        hrService: null,
        hrChar: null,
        connected: false,
        measuring: false,

        rrList: [],
        startTime: 0,
        lastRRTime: 0,
        latestBpm: 0,

        totalFramesReceived: 0,
        totalRRPushed: 0,

        onRR: null,
        onDisconnect: null,
        onError: null,
    };

    /* ================================================================
       连接
       ================================================================ */
    async function connect(options) {
        options = options || {};

        if (!isBluetoothSupported()) {
            const reason = getUnsupportedReason();
            if (state.onError) state.onError({ code: 'UNSUPPORTED', message: reason });
            throw new Error(reason);
        }

        try {
            console.log('[PolarH10] 请求设备…');
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [HR_SERVICE_UUID] },
                    { namePrefix: 'Polar' },
                ],
                optionalServices: [HR_SERVICE_UUID],
            });

            console.log('[PolarH10] 设备已选：', device.name, device.id);
            state.device = device;
            device.addEventListener('gattserverdisconnected', onGattDisconnected);

            const server = await device.gatt.connect();
            state.server = server;
            console.log('[PolarH10] GATT 已连接');

            const hrService = await server.getPrimaryService(HR_SERVICE_UUID);
            state.hrService = hrService;
            console.log('[PolarH10] Heart Rate Service 拿到');

            const hrChar = await hrService.getCharacteristic(HR_MEASUREMENT_UUID);
            state.hrChar = hrChar;
            console.log('[PolarH10] HR Measurement 特征拿到');
            console.log('[PolarH10] properties:', JSON.stringify(hrChar.properties));

            state.connected = true;
            console.log('[PolarH10] 连接完成（标准 HR 模式）');

            return {
                ok: true,
                deviceName: device.name || 'Polar H10',
                deviceId: device.id,
                mode: 'HR',
            };
        } catch (e) {
            state.connected = false;
            if (e.name === 'NotFoundError' || /User cancelled/i.test(e.message || '')) {
                if (state.onError) state.onError({ code: 'CANCELLED', message: t('已取消选择', 'Selection cancelled') });
                throw new Error('CANCELLED');
            }
            if (state.onError) state.onError({ code: 'CONNECT_FAILED', message: e.message });
            throw e;
        }
    }

    function onGattDisconnected() {
        console.log('[PolarH10] GATT 断开');
        state.connected = false;
        state.measuring = false;
        if (state.onDisconnect) state.onDisconnect();
    }

    async function disconnect() {
        try {
            if (state.hrChar && state.measuring) {
                await stopMeasurement();
            }
        } catch (e) {}
        try {
            if (state.device && state.device.gatt && state.device.gatt.connected) {
                state.device.gatt.disconnect();
            }
        } catch (e) {}
        state.connected = false;
        state.measuring = false;
        state.server = null;
        state.hrService = null;
        state.hrChar = null;
    }

    /* ================================================================
       启动 / 停止测量
       ================================================================ */
    async function startMeasurement() {
        if (!state.connected) throw new Error('NOT_CONNECTED');
        if (state.measuring) return;

        state.rrList = [];
        state.startTime = performance.now() / 1000;
        state.lastRRTime = 0;
        state.latestBpm = 0;
        state.totalFramesReceived = 0;
        state.totalRRPushed = 0;

        state.hrChar.addEventListener('characteristicvaluechanged', onHRData);
        await state.hrChar.startNotifications();
        state.measuring = true;
        console.log('[PolarH10] 标准 HR 通知已开启，开始接收数据');
    }

    async function stopMeasurement() {
        if (!state.measuring) return;
        state.measuring = false;

        try {
            state.hrChar.removeEventListener('characteristicvaluechanged', onHRData);
        } catch (e) {}

        try {
            await state.hrChar.stopNotifications();
        } catch (e) {}

        console.log('[PolarH10] 测量已停止');
    }

    /* ================================================================
       数据解析（标准 0x2A37）
       ================================================================ */
    function onHRData(event) {
        const dv = event.target.value;
        state.totalFramesReceived++;

        const flags = dv.getUint8(0);
        const hr16 = (flags & 0x01) !== 0;   /* bit0: 心率值是否 16 位 */
        const hasRR = (flags & 0x10) !== 0;  /* bit4: 是否带 RR */

        let offset = 1;
        let bpm;
        if (hr16) {
            bpm = dv.getUint16(offset, true);
            offset += 2;
        } else {
            bpm = dv.getUint8(offset);
            offset += 1;
        }
        state.latestBpm = bpm;

        /* 跳过后面的 Energy Expended 字段（如果存在） */
        if (flags & 0x08) {
            offset += 2;
        }

        const nowSec = performance.now() / 1000;
        const baseElapsed = nowSec - state.startTime;

        if (hasRR && dv.byteLength > offset) {
            /* 每 2 字节一个 RR，单位 1/1024 秒 */
            const n = Math.floor((dv.byteLength - offset) / 2);
            for (let i = 0; i < n; i++) {
                const raw = dv.getUint16(offset + i * 2, true);
                const rrMs = (raw / 1024) * 1000;
                if (rrMs < 300 || rrMs > 2000) continue;

                /* 时间戳：从帧末尾往前推 */
                const offsetSec = (n - i) * (rrMs / 1000);
                const tSec = baseElapsed - offsetSec;

                state.rrList.push({ t: tSec, rr: rrMs });
                state.lastRRTime = tSec;
                state.totalRRPushed++;

                if (state.onRR) {
                    try { state.onRR(rrMs, tSec); } catch (e) {}
                }
            }
        } else {
            /* 没带 RR：用 bpm 反推，标记为估算 */
            const rrMs = 60000 / bpm;
            state.rrList.push({ t: baseElapsed, rr: rrMs, estimated: true });
            state.totalRRPushed++;

            if (state.onRR) {
                try { state.onRR(rrMs, baseElapsed); } catch (e) {}
            }
        }

        /* 前几帧 + 每 10 帧打日志 */
        if (state.totalFramesReceived <= 5 || state.totalFramesReceived % 10 === 0) {
            console.log('[标准HR] #' + state.totalFramesReceived +
                        ' bpm=' + bpm +
                        ' hasRR=' + hasRR +
                        ' 累计RR=' + state.totalRRPushed);
        }
    }

    /* ================================================================
       统计计算
       ================================================================ */
    function computeStats(rrList) {
        const rr = rrList.map(x => x.rr).filter(v => v > 300 && v < 2000);
        if (rr.length < 2) {
            return { bpm: 0, rmssd: 0, sdnn: 0, pnn50: 0, lf: 0, hf: 0, lfHf: 0, rrIntervals: rr };
        }

        const meanRR = rr.reduce((a, b) => a + b, 0) / rr.length;
        const bpm = Math.round(60000 / meanRR);

        const variance = rr.reduce((a, b) => a + (b - meanRR) ** 2, 0) / (rr.length - 1);
        const sdnn = Math.sqrt(variance);

        let sumSq = 0;
        for (let i = 1; i < rr.length; i++) sumSq += (rr[i] - rr[i - 1]) ** 2;
        const rmssd = Math.sqrt(sumSq / (rr.length - 1));

        let nn50 = 0;
        for (let i = 1; i < rr.length; i++) {
            if (Math.abs(rr[i] - rr[i - 1]) > 50) nn50++;
        }
        const pnn50 = (nn50 / (rr.length - 1)) * 100;

        const { lf, hf } = computeLFHF(rr);
        const lfHf = hf > 0 ? lf / hf : 0;

        return {
            bpm,
            rmssd: Math.round(rmssd * 10) / 10,
            sdnn: Math.round(sdnn * 10) / 10,
            pnn50: Math.round(pnn50 * 10) / 10,
            lf,
            hf,
            lfHf: Math.round(lfHf * 100) / 100,
            rrIntervals: rr,
        };
    }

    function computeLFHF(rr) {
        if (!rr || rr.length < 30) return { lf: 0, hf: 0 };

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
        for (let i = 0; i < n; i++) win[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));

        const re = new Array(n);
        const im = new Array(n).fill(0);
        for (let i = 0; i < n; i++) re[i] = centered[i] * win[i];

        fft(re, im);

        const power = new Array(Math.floor(n / 2));
        for (let i = 0; i < power.length; i++) power[i] = (re[i] * re[i] + im[i] * im[i]) / n;
        const freqRes = fs / n;

        let lfSum = 0, hfSum = 0;
        for (let i = 1; i < power.length; i++) {
            const f = i * freqRes;
            if (f >= 0.04 && f < 0.15) lfSum += power[i];
            else if (f >= 0.15 && f < 0.40) hfSum += power[i];
        }
        return {
            lf: Math.round(lfSum * freqRes * 100) / 100,
            hf: Math.round(hfSum * freqRes * 100) / 100,
        };
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

    /* ================================================================
       对外 API
       ================================================================ */
    window.qxPolarH10 = {
        isSupported: isBluetoothSupported,
        getUnsupportedReason,
        connect,
        disconnect,
        startMeasurement,
        stopMeasurement,
        computeStats,
        getRRList: () => state.rrList.slice(),
        isConnected: () => state.connected,
        isMeasuring: () => state.measuring,
        getDeviceName: () => (state.device ? (state.device.name || 'Polar H10') : ''),
        getStats: () => ({
            frames: state.totalFramesReceived,
            parsed: state.totalFramesReceived,
            rrPushed: state.totalRRPushed,
        }),
        __debug__: () => ({
            hrChar: state.hrChar,
            device: state.device,
        }),
        set onRR(fn) { state.onRR = fn; },
        set onDisconnect(fn) { state.onDisconnect = fn; },
        set onError(fn) { state.onError = fn; },
    };

    console.log('[PolarH10] 模块已注册（v8，标准 HR 服务）');
})();