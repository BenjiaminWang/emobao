/* ================================================================
   情绪宝 - qx6 公共工具
   路径：js/qx6/qx6_utils.js
   日期：2026-10-13
   说明：
   - qx6 所有子模块共用的工具函数
   - 必须在所有 qx6_N_xxx.js 之前加载
   - 导出到 window.qx6Utils
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';
    const PASSWORD_SALT = 'emobao_salt_2026';

    /* ================================================================
       身份字典兜底（当 qxTypeLabel 不可用时）
       ================================================================ */
    const INLINE_TYPE_FALLBACK = {
        1:  { cn: '普通用户',  en: 'Normal User',   sortorder: 1 },
        2:  { cn: 'VIP',      en: 'VIP',           sortorder: 2 },
        3:  { cn: 'VIP',      en: 'VIP',           sortorder: 3 },
        4:  { cn: 'VIP',      en: 'VIP',           sortorder: 4 },
        5:  { cn: 'VIP',      en: 'VIP',           sortorder: 5 },
        6:  { cn: '家庭',     en: 'Family',        sortorder: 6 },
        7:  { cn: '辅导员',   en: 'Counselor',     sortorder: 7 },
        8:  { cn: '音乐管理', en: 'Music Admin',   sortorder: 8 },
        9:  { cn: '系统管理', en: 'System Admin',  sortorder: 9 },
        10: { cn: '财务',     en: 'Finance',       sortorder: 10 },
        11: { cn: '企业',     en: 'Enterprise',    sortorder: 11 },
        12: { cn: '学生',     en: 'Student',       sortorder: 12 },
        13: { cn: '待用身份', en: 'Reserved',      sortorder: 13 },
        14: { cn: '访客',     en: 'Guest',         sortorder: 14 },
    };

    function typeMap() {
        if (window.qxTypeLabel && typeof window.qxTypeLabel.getMap === 'function') {
            const m = window.qxTypeLabel.getMap();
            if (m && Object.keys(m).length > 0) return m;
        }
        return INLINE_TYPE_FALLBACK;
    }

    function typeLabel(ut) {
        const k = parseInt(ut);
        if (isNaN(k)) return '';
        if (window.qxTypeLabel && typeof window.qxTypeLabel.get === 'function') {
            try { return window.qxTypeLabel.get(k); } catch (e) {}
        }
        const lb = INLINE_TYPE_FALLBACK[k] || INLINE_TYPE_FALLBACK[1];
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? lb.cn : lb.en;
    }

    function typeKeysSorted() {
        const map = typeMap();
        return Object.keys(map).sort((a, b) =>
            (map[a].sortorder || 0) - (map[b].sortorder || 0)
        );
    }

    async function ensureTypeDictLoaded() {
        if (!window.qxTypeLabel) return false;
        if (typeof window.qxTypeLabel.waitFor === 'function') {
            return await window.qxTypeLabel.waitFor(3000);
        }
        if (typeof window.qxTypeLabel.load === 'function') {
            try { await window.qxTypeLabel.load(); return true; }
            catch (e) { return false; }
        }
        return false;
    }

    /* ================================================================
       多语言
       ================================================================ */
    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    /* ================================================================
       当前用户信息
       ================================================================ */
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getUserId()   { return (window.mQxb && window.mQxb.user_id) || null; }
    function getUserName() { return (window.mQxb && window.mQxb.Username) || ''; }
    function getExpiry()   { return (window.mQxb && window.mQxb.ExpiryDate) || ''; }
    function isGuest()     { return getUserType() === 14; }
    function isAdmin()     { return getUserType() === 9; }
    function isMusician()  { return getUserType() === 8; }
    function isFinance()   { return getUserType() === 10; }

    /* ================================================================
       密码
       ================================================================ */
    async function hashPassword(plain) {
        const buf = new TextEncoder().encode(plain + PASSWORD_SALT);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function calcStrength(pwd) {
        if (!pwd || pwd.length < 8) return 0;
        const weakList = [
            '11111111','22222222','33333333','44444444','55555555',
            '66666666','77777777','88888888','99999999','00000000',
            '12345678','123456789','87654321','abcdefgh','aaaaaaaa',
            'qwertyui','password','passw0rd','iloveyou'
        ];
        if (weakList.includes(pwd)) return 0;
        let types = 0;
        if (/[a-z]/.test(pwd)) types++;
        if (/[A-Z]/.test(pwd)) types++;
        if (/[0-9]/.test(pwd)) types++;
        if (/[^a-zA-Z0-9]/.test(pwd)) types++;
        if (types <= 1) return 1;
        if (types === 2) return 2;
        if (types === 3) return 3;
        return 4;
    }

    /* ================================================================
       网络
       ================================================================ */
    async function restGet(path) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST GET ${path}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    async function rpc(fnName, params) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify(params),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`RPC ${fnName}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    /* ================================================================
       格式化
       ================================================================ */
    function formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
    function formatSize(bytes) {
        if (!bytes) return '--';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)} KB`;
        return `${(bytes/1024/1024).toFixed(1)} MB`;
    }

    function readAudioDuration(url) {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.preload = 'metadata';
            audio.src = url;
            const timer = setTimeout(() => { audio.src = ''; resolve(null); }, 15000);
            audio.addEventListener('loadedmetadata', () => {
                clearTimeout(timer);
                const d = Math.round(audio.duration);
                audio.src = '';
                resolve(isFinite(d) && d > 0 ? d : null);
            });
            audio.addEventListener('error', () => {
                clearTimeout(timer);
                audio.src = '';
                resolve(null);
            });
        });
    }

    async function fetchFileSize(url) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (!res.ok) return null;
            const cl = res.headers.get('content-length');
            return cl ? parseInt(cl) : null;
        } catch (e) { return null; }
    }

    /* ================================================================
       采样源 / 摄像头方向 / 摄像头 deviceId
       ================================================================ */
    function getHrvSource() {
        try {
            const v = localStorage.getItem('emobao_hrv_source');
            if (v === 'polar' || v === 'camera') return v;
        } catch (e) {}
        if (window.mQxb && window.mQxb.Sensor && window.mQxb.Sensor.hrvSource) {
            return window.mQxb.Sensor.hrvSource;
        }
        return 'camera';
    }
    function setHrvSource(v) {
        if (v !== 'polar' && v !== 'camera') return;
        try { localStorage.setItem('emobao_hrv_source', v); } catch (e) {}
        if (!window.mQxb) window.mQxb = {};
        if (!window.mQxb.Sensor) window.mQxb.Sensor = {};
        window.mQxb.Sensor.hrvSource = v;
        console.log('[qx6-utils] 采样源已切为 =', v);
    }

    function getCameraFacing() {
        try {
            const v = localStorage.getItem('emobao_camera_facing');
            if (v === 'environment' || v === 'user') return v;
        } catch (e) {}
        if (window.mQxb && window.mQxb.Sensor && window.mQxb.Sensor.hrvCameraFacing) {
            return window.mQxb.Sensor.hrvCameraFacing;
        }
        return 'environment';
    }
    function setCameraFacing(v) {
        if (v !== 'environment' && v !== 'user') return;
        try { localStorage.setItem('emobao_camera_facing', v); } catch (e) {}
        if (!window.mQxb) window.mQxb = {};
        if (!window.mQxb.Sensor) window.mQxb.Sensor = {};
        window.mQxb.Sensor.hrvCameraFacing = v;
        console.log('[qx6-utils] 摄像头方向已切为 =', v);
    }

    function getHrvCameraDeviceId() {
        try { return localStorage.getItem('emobao_hrv_camera_deviceid') || ''; }
        catch (e) { return ''; }
    }
    function setHrvCameraDeviceId(v) {
        try {
            if (v) localStorage.setItem('emobao_hrv_camera_deviceid', v);
            else localStorage.removeItem('emobao_hrv_camera_deviceid');
        } catch (e) {}
        if (!window.mQxb) window.mQxb = {};
        if (!window.mQxb.Sensor) window.mQxb.Sensor = {};
        window.mQxb.Sensor.hrvCameraDeviceId = v || '';
        console.log('[qx6-utils] HRV 摄像头 deviceId =', v || '(自动)');
    }

    /* ================================================================
       摄像头测试结果缓存
       ================================================================ */
    function getCameraTestResults() {
        try {
            const raw = localStorage.getItem('emobao_camera_test_results');
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function saveCameraTestResult(cam, stats) {
        if (!cam || !cam.deviceId) return;
        try {
            const all = getCameraTestResults();
            all[cam.deviceId] = {
                deviceId:         cam.deviceId,
                cameraindex:      cam.index,
                label:            cam.label || '',
                labelPattern:     extractLabelPattern(cam.label),
                deviceModelGuess: guessDeviceModel(navigator.userAgent || ''),
                osName:           guessOSName(),
                browserName:      guessBrowserName(),

                score:       stats.score,
                grade:       stats.grade,
                rmssd:       stats.rmssd,
                bpm:         stats.bpm,
                goodRatio:   stats.goodRatio,
                durationSec: stats.durationSec || 10,
                testedAt:    Date.now(),
            };
            localStorage.setItem('emobao_camera_test_results', JSON.stringify(all));
        } catch (e) {
            console.warn('[qx6-utils] 保存测试结果失败', e);
        }
    }
    function clearCameraTestResult(deviceId) {
        if (!deviceId) return;
        try {
            const all = getCameraTestResults();
            delete all[deviceId];
            localStorage.setItem('emobao_camera_test_results', JSON.stringify(all));
        } catch (e) {}
    }

    function extractLabelPattern(label) {
        const l = (label || '').toLowerCase();
        const parts = [];
        if (/front|前置|facetime|user/.test(l))          parts.push('front');
        else if (/back|rear|后置|environment/.test(l))   parts.push('back');
        else                                             parts.push('unknown');
        if (/macro|微距/.test(l))                        parts.push('macro');
        if (/ultra|wide|超广角/.test(l))                 parts.push('ultra');
        if (/tele|长焦/.test(l))                         parts.push('tele');
        if (/depth|景深/.test(l))                        parts.push('depth');
        return parts.join('_') || 'unknown';
    }
    function guessDeviceModel(ua) {
        const m1 = ua.match(/\(([^)]+)\)/);
        if (!m1) return '';
        const tokens = m1[1].split(';').map(s => s.trim());
        for (const tk of tokens) {
            if (/Pixel|SM-|Redmi|Mi |HUAWEI|OnePlus|OPPO|vivo|iPhone/.test(tk)) return tk;
        }
        return '';
    }
    function guessOSName() {
        const ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
        if (/Android/.test(ua))         return 'Android';
        if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
        if (/Windows/.test(ua))         return 'Windows';
        return 'Other';
    }
    function guessBrowserName() {
        const ua = navigator.userAgent || '';
        if (/Edg\//.test(ua)) return 'Edge';
        if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'Safari';
        if (/Firefox\//.test(ua)) return 'Firefox';
        return 'Other';
    }

    function gradeText(grade) {
        return {
            excellent: t('极佳', 'Excellent'),
            good:      t('良好', 'Good'),
            fair:      t('一般', 'Fair'),
            poor:      t('差', 'Poor'),
        }[grade] || t('未测', 'Not tested');
    }
    function gradeColor(grade) {
        return {
            excellent: '#2ECC71',
            good:      '#2C7BE5',
            fair:      '#F39C12',
            poor:      '#E74C3C',
        }[grade] || '#96A3B8';
    }

    /* ================================================================
       导出
       ================================================================ */
    window.qx6Utils = {
        SUPABASE_URL,
        SUPABASE_KEY,

        t,
        typeMap, typeLabel, typeKeysSorted, ensureTypeDictLoaded,

        getUserType, getUserId, getUserName, getExpiry,
        isGuest, isAdmin, isMusician, isFinance,

        hashPassword, calcStrength,

        restGet, rpc,

        formatDuration, formatSize, readAudioDuration, fetchFileSize,

        getHrvSource, setHrvSource,
        getCameraFacing, setCameraFacing,
        getHrvCameraDeviceId, setHrvCameraDeviceId,
        getCameraTestResults, saveCameraTestResult, clearCameraTestResult,

        extractLabelPattern, guessDeviceModel, guessOSName, guessBrowserName,
        gradeText, gradeColor,

        INLINE_TYPE_FALLBACK,
    };

    console.log('[qx6_utils] 模块已注册');
})();