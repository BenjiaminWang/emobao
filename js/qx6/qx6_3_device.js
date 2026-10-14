/* ================================================================
   情绪宝 - qx6-3 设备管理面板
   路径：js/qx6/qx6_3_device.js
   日期：2026-10-13
   内容：
   - 本机环境
   - 心率采集方式（摄像头 PPG / Polar H10）
   - Polar H10 连接
   - HRV 采样摄像头：
     · 数设备（enumerateDevices）→ 判断"有没有摄像头"
     · 猜方向（label 关键词）→ 判断"前置/后置"
     · 试打开 → 判断"能不能用"
     · 方向按钮：根据结果亮/灰 + 文字说明
     · 具体镜头列表 + 测一测 + 选用
     · [重新探测] 按钮
   - 数据与隐私
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_3_device] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    /* 探测结果缓存 */
    let _probe = {
        checked: false,
        checking: false,
        camCount: 0,           /* 摄像头总数 */
        hasUser: false,        /* 有前置 */
        hasEnv: false,         /* 有后置 */
        unknownFacing: false,  /* 有摄像头但 label 认不出方向 */
        usable: false,         /* 至少有一个摄像头能试开 */
        permissionDenied: false,
        busy: false,
        error: '',
        cams: [],              /* [{deviceId, label, facing: 'user'|'environment'|'unknown'}] */
    };

    /* ================================================================
       猜方向（靠 label 关键词）
       ================================================================ */
    function guessFacingFromLabel(label) {
        const l = (label || '').toLowerCase();
        if (/front|前置|facetime|user|内建|built-in|builtin/.test(l)) return 'user';
        if (/back|rear|后置|environment|背面/.test(l)) return 'environment';
        return 'unknown';
    }

    /* ================================================================
       试开一个 deviceId（只判断"能不能用"）
       ================================================================ */
    async function tryOpen(deviceId) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return { ok: false, reason: 'unsupported' };
        }
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: false,
            });
            return { ok: true };
        } catch (e) {
            let reason = 'unknown';
            if (e && e.name === 'NotAllowedError') reason = 'denied';
            else if (e && e.name === 'NotReadableError') reason = 'busy';
            else if (e && e.name === 'NotFoundError') reason = 'not_found';
            return { ok: false, reason: reason, message: (e && e.message) || '' };
        } finally {
            if (stream) {
                try { stream.getTracks().forEach(tr => tr.stop()); } catch (e) {}
            }
        }
    }

    /* ================================================================
       完整探测
       ================================================================ */
    async function probeAll() {
        _probe.checking = true;
        _probe.error = '';
        _probe.permissionDenied = false;
        _probe.busy = false;
        _probe.cams = [];

        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            _probe.checked = true;
            _probe.checking = false;
            _probe.camCount = 0;
            _probe.error = 'unsupported';
            return _probe;
        }

        /* 1. 数设备 */
        let devices = [];
        try {
            devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
            _probe.checked = true;
            _probe.checking = false;
            _probe.camCount = 0;
            _probe.error = 'enumerate_failed';
            return _probe;
        }

        const cams = devices.filter(d => d.kind === 'videoinput');
        _probe.camCount = cams.length;

        /* 2. 按 label 猜方向 */
        let hasUser = false, hasEnv = false, unknownFacing = false;
        cams.forEach(c => {
            const facing = guessFacingFromLabel(c.label);
            _probe.cams.push({
                deviceId: c.deviceId,
                label: c.label || '',
                facing: facing,
            });
            if (facing === 'user') hasUser = true;
            else if (facing === 'environment') hasEnv = true;
            else unknownFacing = true;
        });

        _probe.hasUser = hasUser;
        _probe.hasEnv = hasEnv;
        _probe.unknownFacing = unknownFacing;

        /* 3. 试打开 —— 判断"能不能用" */
        if (cams.length > 0) {
            /* 试第一个能开的 */
            let anyOk = false;
            let anyDenied = false;
            let anyBusy = false;
            for (const c of cams) {
                const r = await tryOpen(c.deviceId);
                if (r.ok) { anyOk = true; break; }
                if (r.reason === 'denied') anyDenied = true;
                else if (r.reason === 'busy') anyBusy = true;
            }
            _probe.usable = anyOk;
            _probe.permissionDenied = anyDenied;
            _probe.busy = anyBusy;
            if (!anyOk) {
                if (anyDenied) _probe.error = 'denied';
                else if (anyBusy) _probe.error = 'busy';
                else _probe.error = 'unreadable';
            }
        } else {
            _probe.usable = false;
            _probe.error = 'no_camera';
        }

        _probe.checked = true;
        _probe.checking = false;
        return _probe;
    }

    /* ================================================================
       探测结果 → 界面文字
       ================================================================ */
    function describeProbe(p) {
        if (!p.checked) return t('尚未探测', 'Not probed');
        if (p.error === 'unsupported') return t('本环境不支持摄像头 API', 'Camera API not supported');
        if (p.error === 'enumerate_failed') return t('枚举摄像头失败', 'Failed to enumerate cameras');
        if (p.error === 'no_camera' || p.camCount === 0) {
            return t('❌ 本机没有检测到任何摄像头', '❌ No camera detected');
        }

        const parts = [];
        parts.push(t(`检测到 ${p.camCount} 个摄像头`, `${p.camCount} camera(s)`));

        if (p.hasUser) parts.push('✅ ' + t('前置可用', 'Front OK'));
        if (p.hasEnv) parts.push('✅ ' + t('后置可用', 'Rear OK'));
        if (!p.hasUser && !p.hasEnv && p.unknownFacing) {
            parts.push(t('方向未知（不限制）', 'Facing unknown'));
        }

        if (!p.usable) {
            if (p.permissionDenied) parts.push('⚠️ ' + t('权限被拒', 'Permission denied'));
            else if (p.busy) parts.push('⚠️ ' + t('被其他程序占用', 'Busy'));
            else parts.push('⚠️ ' + t('打不开', 'Unreadable'));
        }

        return parts.join(' · ');
    }

    /* ================================================================
       HRV 采样可行性判断
       ================================================================ */
    function hrvFeasibility(p) {
        if (!p.checked) return { ok: false, message: t('正在探测…', 'Probing…') };
        if (p.error === 'unsupported') {
            return { ok: false, message: t('本环境不支持摄像头，无法进行 HRV 采样。请改用 Polar H10。',
                                          'Camera API not supported. Use Polar H10 for HRV.') };
        }
        if (p.camCount === 0) {
            return { ok: false, message: t('本机没有任何摄像头，无法进行 HRV 采样。请改用 Polar H10 心率带。',
                                          'No camera detected. HRV capture is not possible. Please use a Polar H10 strap.') };
        }
        if (!p.usable) {
            if (p.permissionDenied) {
                return { ok: false, message: t('摄像头权限被拒绝。请在浏览器地址栏左侧允许摄像头权限，然后点[重新探测]。',
                                              'Camera permission denied. Allow it in browser and re-probe.') };
            }
            if (p.busy) {
                return { ok: false, message: t('摄像头被其他程序占用。请关闭占用摄像头的程序（如 Zoom / FaceTime / 其他浏览器标签），然后点[重新探测]。',
                                              'Camera is busy. Close other apps using it and re-probe.') };
            }
            return { ok: false, message: t('摄像头无法打开，请检查设备连接或权限。',
                                          'Camera cannot be opened. Check device / permission.') };
        }
        return { ok: true, message: '' };
    }

    /* ================================================================
       渲染
       ================================================================ */
    function render(bodyEl) {
        const ua = navigator.userAgent || '';
        const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        const isAndroid = /Android/.test(ua);
        const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
        const isWeChat = /MicroMessenger/.test(ua);

        const hasBT = !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
        const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';

        function browserName() {
            if (/Edg\//.test(ua)) return 'Edge';
            if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
            if (isSafari) return 'Safari';
            if (/Firefox\//.test(ua)) return 'Firefox';
            if (isWeChat) return t('微信浏览器', 'WeChat Browser');
            return t('其他', 'Other');
        }
        function osName() {
            if (isIOS) return 'iOS';
            if (isAndroid) return 'Android';
            if (isMac) return 'macOS';
            if (/Windows/.test(ua)) return 'Windows';
            return t('其他', 'Other');
        }

        const curSource = U.getHrvSource();
        const curFacing = U.getCameraFacing();
        const curDevId  = U.getHrvCameraDeviceId();

        const connectedNow = !!(window.qxPolarH10
                             && typeof window.qxPolarH10.isConnected === 'function'
                             && window.qxPolarH10.isConnected());
        const deviceName = (connectedNow && window.qxPolarH10.getDeviceName)
                         ? window.qxPolarH10.getDeviceName()
                         : '';

        const probeDesc = describeProbe(_probe);
        const feasibility = hrvFeasibility(_probe);

        /* 方向按钮灰不灰：
           - 明确有该方向 → 亮
           - 明确没有该方向 → 灰
           - label 认不出方向 → 都亮（保守）
        */
        const frontDisable = _probe.checked && !_probe.hasUser && !_probe.unknownFacing && _probe.camCount > 0;
        const rearDisable  = _probe.checked && !_probe.hasEnv  && !_probe.unknownFacing && _probe.camCount > 0;
        /* 如果一个摄像头都没有 → 都灰 */
        const noCamAtAll = _probe.checked && _probe.camCount === 0;
        const frontFinalDisable = frontDisable || noCamAtAll;
        const rearFinalDisable  = rearDisable  || noCamAtAll;

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-card-title">${t('本机环境', 'This Device')}</div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('浏览器', 'Browser')}</div>
                    <div class="qx6-info-value">${browserName()}</div>
                </div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('系统', 'OS')}</div>
                    <div class="qx6-info-value">${osName()}</div>
                </div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('蓝牙心率带', 'Bluetooth Strap')}</div>
                    <div class="qx6-info-value">${hasBT && isHTTPS ? '✅ ' + t('可用', 'Available') : '❌ ' + t('不可用', 'Unavailable')}</div>
                </div>
            </div>

            <div class="qx6-card">
                <div class="qx6-card-title">${t('心率采集方式', 'HRV Source')}</div>
                <div class="qx6-lang-row">
                    <button class="qx6-lang-btn ${curSource === 'camera' ? 'active' : ''}"
                            data-src="camera" id="qx6_dev_src_camera">
                        ${t('摄像头 PPG', 'Camera PPG')}
                    </button>
                    <button class="qx6-lang-btn ${curSource === 'polar' ? 'active' : ''}"
                            data-src="polar" id="qx6_dev_src_polar">
                        ${t('Polar H10', 'Polar H10')}
                    </button>
                </div>
                <div class="qx6-buy-desc" style="margin-top:10px;">
                    ${curSource === 'polar'
                        ? t('有 Polar H10 时，HRV 采集使用蓝牙，不启用摄像头。',
                            'With Polar H10, HRV uses Bluetooth; camera is not used.')
                        : t('没有心率带时，HRV 采集使用摄像头 PPG。',
                            'Without a strap, HRV uses camera PPG.')}
                </div>
            </div>

            <div class="qx6-card">
                <div class="qx6-card-title">${t('Polar H10 连接', 'Polar H10 Connection')}</div>
                <div class="qx6-status ${connectedNow ? 'qx6-status-success' : ''}" id="qx6_dev_polar_status">
                    ${(!hasBT || !isHTTPS)
                        ? t('本机不支持蓝牙心率带', 'Bluetooth strap not supported on this device')
                        : (connectedNow
                            ? t('已连接：', 'Connected: ') + (deviceName || 'Polar H10')
                            : t('未连接', 'Not connected'))}
                </div>
                <button class="qx6-btn qx6-btn-primary" id="qx6_dev_polar_connect"
                        style="margin-top:8px;${(!hasBT || !isHTTPS) ? 'display:none;' : ''}">
                    ${t('连接心率带', 'Connect Strap')}
                </button>
                <button class="qx6-btn qx6-btn-secondary" id="qx6_dev_polar_disconnect"
                        style="margin-top:8px;${connectedNow ? '' : 'display:none;'}">
                    ${t('断开连接', 'Disconnect')}
                </button>
            </div>

            <div class="qx6-card">
                <div class="qx6-card-title">${t('HRV 采样摄像头', 'HRV Camera')}</div>
                <div class="qx6-buy-desc" style="margin-bottom:10px;">
                    ${t(
                        '此设置只影响"没有心率带时，HRV 采样用哪个摄像头"。情绪宝魔镜固定使用前置摄像头，不受此设置影响。',
                        'This setting only affects which camera HRV PPG uses when no strap is connected. The Emotion Mirror always uses the front camera regardless.'
                    )}
                </div>

                <div class="qx6-cam-facing-label">${t('选择方向', 'Choose facing')}</div>
                <div class="qx6-lang-row" style="margin-bottom:6px;">
                    <button class="qx6-lang-btn ${curFacing === 'environment' ? 'active' : ''} ${rearFinalDisable ? 'qx6-lang-btn-disabled' : ''}"
                            data-facing="environment" id="qx6_dev_face_env"
                            ${rearFinalDisable ? 'disabled' : ''}>
                        ${t('后置（推荐）', 'Rear (rec.)')}
                    </button>
                    <button class="qx6-lang-btn ${curFacing === 'user' ? 'active' : ''} ${frontFinalDisable ? 'qx6-lang-btn-disabled' : ''}"
                            data-facing="user" id="qx6_dev_face_user"
                            ${frontFinalDisable ? 'disabled' : ''}>
                        ${t('前置', 'Front')}
                    </button>
                </div>

                <div class="qx6-cam-probe-result" id="qx6_cam_probe_result">
                    ${probeDesc}
                </div>

                ${(!feasibility.ok) ? `
                <div class="qx6-cam-infeasible" style="margin-top:10px;">
                    ⚠️ ${feasibility.message}
                </div>` : ''}

                <div style="margin-top:8px;">
                    <button class="qx6-btn qx6-btn-secondary qx6-btn-small" id="qx6_dev_reprobe">
                        ${t('重新探测', 'Re-probe')}
                    </button>
                </div>

                <div class="qx6-cam-facing-label" style="margin-top:16px;">${t('进阶：指定具体镜头', 'Advanced: pick specific camera')}</div>
                <div class="qx6-cam-list" id="qx6_cam_list">
                    <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                </div>
            </div>

            <div class="qx6-card">
                <div class="qx6-card-title">${t('数据与隐私', 'Data & Privacy')}</div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('摄像头用途', 'Camera usage')}</div>
                    <div class="qx6-info-value">${t('仅本地 PPG 计算', 'Local PPG only')}</div>
                </div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('是否上传图像', 'Upload images')}</div>
                    <div class="qx6-info-value">${t('否', 'No')}</div>
                </div>
                <div class="qx6-info-row">
                    <div class="qx6-info-label">${t('蓝牙数据', 'Bluetooth data')}</div>
                    <div class="qx6-info-value">${t('仅本地处理', 'Local only')}</div>
                </div>
            </div>
        `;

        const polarStatus   = bodyEl.querySelector('#qx6_dev_polar_status');
        const btnConnect    = bodyEl.querySelector('#qx6_dev_polar_connect');
        const btnDisconnect = bodyEl.querySelector('#qx6_dev_polar_disconnect');
        const srcCameraBtn  = bodyEl.querySelector('#qx6_dev_src_camera');
        const srcPolarBtn   = bodyEl.querySelector('#qx6_dev_src_polar');
        const faceEnvBtn    = bodyEl.querySelector('#qx6_dev_face_env');
        const faceUserBtn   = bodyEl.querySelector('#qx6_dev_face_user');
        const reprobeBtn    = bodyEl.querySelector('#qx6_dev_reprobe');
        const camListEl     = bodyEl.querySelector('#qx6_cam_list');

        function setPolarStatus(text, type) {
            if (!polarStatus) return;
            polarStatus.innerText = text;
            polarStatus.className = 'qx6-status' + (type ? ' qx6-status-' + type : '');
        }
        function refreshPanel() { render(bodyEl); }

        /* ---------- 摄像头列表 ---------- */
        async function loadCameraList() {
            if (!camListEl) return;
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                camListEl.innerHTML = `<div class="qx6-empty">${t('本机不支持摄像头枚举', 'Camera enumeration not supported')}</div>`;
                return;
            }

            let devices = [];
            try {
                devices = await navigator.mediaDevices.enumerateDevices();
            } catch (e) {
                camListEl.innerHTML = `<div class="qx6-empty">${t('无法获取摄像头列表', 'Cannot get camera list')}</div>`;
                return;
            }

            const cams = devices.filter(d => d.kind === 'videoinput');

            if (cams.length === 0) {
                camListEl.innerHTML = `<div class="qx6-empty">${t('本机没有检测到摄像头', 'No camera detected')}</div>`;
                return;
            }

            const labeled = cams.some(c => c.label);

            if (!labeled) {
                camListEl.innerHTML = `
                    <div class="qx6-empty">
                        ${t(`检测到 ${cams.length} 路摄像头。授权后才能看到名称并逐个测试。`,
                            `${cams.length} camera(s) detected. Authorize to see names and test each.`)}
                    </div>
                    <button class="qx6-btn qx6-btn-primary" id="qx6_cam_authorize"
                            style="margin-top:10px;">
                        ${t('授权并列出摄像头', 'Authorize & list cameras')}
                    </button>
                `;
                const authBtn = camListEl.querySelector('#qx6_cam_authorize');
                if (authBtn) {
                    authBtn.onclick = async () => {
                        authBtn.disabled = true;
                        authBtn.innerText = t('请求授权中…', 'Requesting permission…');
                        let stream = null;
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                            stream.getTracks().forEach(tr => { try { tr.stop(); } catch (e) {} });
                            stream = null;
                            _probe.checked = false;
                            await probeAll();
                            refreshPanel();
                        } catch (e) {
                            if (stream) stream.getTracks().forEach(tr => { try { tr.stop(); } catch (e) {} });
                            authBtn.disabled = false;
                            authBtn.innerText = t('授权并列出摄像头', 'Authorize & list cameras');
                            alert(t('授权失败或已拒绝：', 'Permission denied: ') + e.message);
                        }
                    };
                }
                return;
            }

            const results = U.getCameraTestResults();
            const curDevId2 = U.getHrvCameraDeviceId();

            camListEl.innerHTML = '';

            /* 自动行 */
            const autoRow = document.createElement('div');
            autoRow.className = 'qx6-cam-row' + (!curDevId2 ? ' qx6-cam-row-current' : '');
            autoRow.innerHTML = `
                <div class="qx6-cam-row-head">
                    <span class="qx6-cam-row-tag">⚙️</span>
                    <span class="qx6-cam-row-label">${t('自动（用上面选的方向）', 'Auto (use facing above)')}</span>
                    ${!curDevId2 ? `<span class="qx6-cam-row-badge">${t('当前', 'Current')}</span>` : ''}
                </div>
                <div class="qx6-cam-row-body">
                    <div class="qx6-cam-row-score">
                        <span style="color:#96A3B8;">${t('系统默认', 'System default')}</span>
                    </div>
                    <div class="qx6-cam-row-actions">
                        <button class="qx6-btn qx6-btn-primary qx6-btn-small" data-act="pick"
                                ${!curDevId2 ? 'disabled' : ''}>
                            ${!curDevId2 ? t('已选用', 'In use') : t('选用', 'Use')}
                        </button>
                    </div>
                </div>
            `;
            camListEl.appendChild(autoRow);
            autoRow.querySelector('[data-act="pick"]').onclick = () => {
                U.setHrvCameraDeviceId('');
                refreshPanel();
            };

            /* 每个摄像头一行 */
            cams.forEach((cam, idx) => {
                const label = cam.label || (t('摄像头 ', 'Camera ') + (idx + 1));
                const facing = guessFacingFromLabel(label);
                const isFront = (facing === 'user');
                const tag = isFront
                    ? '🔵 ' + t('前置', 'Front')
                    : (facing === 'environment' ? '🟢 ' + t('后置', 'Rear') : '⚪ ' + t('未知', 'Unknown'));
                const isCurrent = (curDevId2 === cam.deviceId);
                const cached = results[cam.deviceId];

                const row = document.createElement('div');
                row.className = 'qx6-cam-row' + (isCurrent ? ' qx6-cam-row-current' : '');
                row.innerHTML = `
                    <div class="qx6-cam-row-head">
                        <span class="qx6-cam-row-tag">${tag}</span>
                        <span class="qx6-cam-row-label">${label}</span>
                        ${isCurrent ? `<span class="qx6-cam-row-badge">${t('当前', 'Current')}</span>` : ''}
                    </div>
                    <div class="qx6-cam-row-body">
                        <div class="qx6-cam-row-score">
                            ${cached && cached.grade !== 'no_finger'
                                ? `<span style="color:${U.gradeColor(cached.grade)};font-weight:bold;">${U.gradeText(cached.grade)}</span>
                                   · RMSSD ${cached.rmssd || '—'}
                                   · ${t('有效', 'Valid')} ${cached.goodRatio != null ? Math.round(cached.goodRatio * 100) + '%' : '—'}`
                                : (cached && cached.grade === 'no_finger'
                                    ? `<span style="color:#E74C3C;">${t('未检测到手指', 'No finger detected')}</span>`
                                    : `<span style="color:#96A3B8;">${t('未测', 'Not tested')}</span>`)}
                        </div>
                        <div class="qx6-cam-row-actions">
                            <button class="qx6-btn qx6-btn-secondary qx6-btn-small" data-act="test">
                                ${t('测一测', 'Test')}
                            </button>
                            <button class="qx6-btn qx6-btn-primary qx6-btn-small" data-act="pick"
                                    ${isCurrent ? 'disabled' : ''}>
                                ${isCurrent ? t('已选用', 'In use') : t('选用此镜头', 'Use this')}
                            </button>
                        </div>
                    </div>
                `;
                camListEl.appendChild(row);

                row.querySelector('[data-act="test"]').onclick = () => {
                    if (window.qxHrvCapture && typeof window.qxHrvCapture.quickTest === 'function') {
                        runCameraTest({ deviceId: cam.deviceId, index: idx, label: label }, row);
                    } else {
                        alert(t('测试模块未加载（qx_hrv_capture_ext.js 未生效）', 'Test module not loaded'));
                    }
                };

                row.querySelector('[data-act="pick"]').onclick = () => {
                    U.setHrvCameraDeviceId(cam.deviceId);
                    U.setCameraFacing(isFront ? 'user' : (facing === 'environment' ? 'environment' : ''));
                    refreshPanel();
                };
            });
        }

        async function runCameraTest(cam, row) {
            const scoreEl = row.querySelector('.qx6-cam-row-score');
            const originalText = scoreEl.innerHTML;
            scoreEl.innerHTML = `<span style="color:#2C7BE5;">${t('测试中… 请把手指搭上镜头', 'Testing… place finger on lens')}</span>`;

            try {
                const stats = await window.qxHrvCapture.quickTest(cam.deviceId, {
                    durationSec: 10,
                    onTick: (info) => {
                        const left = info && info.remain != null ? info.remain : '?';
                        scoreEl.innerHTML = `<span style="color:#2C7BE5;">${t('测试中… ', 'Testing… ') + left + 's · ' + (info.hint || '')}</span>`;
                    },
                });
                U.saveCameraTestResult(cam, stats);
                refreshPanel();
            } catch (e) {
                scoreEl.innerHTML = originalText;
                alert(t('测试失败：', 'Test failed: ') + e.message);
            }
        }

        if (srcCameraBtn) srcCameraBtn.onclick = () => { U.setHrvSource('camera'); refreshPanel(); };
        if (srcPolarBtn)  srcPolarBtn.onclick  = () => { U.setHrvSource('polar');  refreshPanel(); };

        if (faceEnvBtn) {
            faceEnvBtn.onclick = () => {
                if (faceEnvBtn.disabled) {
                    if (typeof window.showToast === 'function') window.showToast(t('本机无后置摄像头', 'No rear camera'), 'warning');
                    else alert(t('本机无后置摄像头', 'No rear camera'));
                    return;
                }
                U.setHrvCameraDeviceId('');
                U.setCameraFacing('environment');
                refreshPanel();
            };
        }
        if (faceUserBtn) {
            faceUserBtn.onclick = () => {
                if (faceUserBtn.disabled) {
                    if (typeof window.showToast === 'function') window.showToast(t('本机无前置摄像头', 'No front camera'), 'warning');
                    else alert(t('本机无前置摄像头', 'No front camera'));
                    return;
                }
                U.setHrvCameraDeviceId('');
                U.setCameraFacing('user');
                refreshPanel();
            };
        }

        if (reprobeBtn) {
            reprobeBtn.onclick = async () => {
                reprobeBtn.disabled = true;
                reprobeBtn.innerText = t('探测中…', 'Probing…');
                _probe.checked = false;
                await probeAll();
                refreshPanel();
            };
        }

        if (btnConnect && btnConnect.style.display !== 'none') {
            btnConnect.onclick = async () => {
                if (!window.qxPolarH10) { setPolarStatus(t('模块未加载', 'Module not loaded'), 'error'); return; }
                setPolarStatus(t('正在连接…', 'Connecting…'), 'info');
                try {
                    const info = await window.qxPolarH10.connect();
                    setPolarStatus(
                        t('已连接：', 'Connected: ') + info.deviceName
                        + (info.mode === 'HR' ? t('（仅心率，无 RR）', ' (HR only, no RR)') : ''),
                        'success'
                    );
                    refreshPanel();
                } catch (e) {
                    if (e.message === 'CANCELLED') setPolarStatus(t('已取消', 'Cancelled'), 'warning');
                    else setPolarStatus(t('连接失败：', 'Connect failed: ') + e.message, 'error');
                }
            };
        }

        if (btnDisconnect) {
            btnDisconnect.onclick = async () => {
                if (!window.qxPolarH10) return;
                try { await window.qxPolarH10.disconnect(); } catch (e) {}
                refreshPanel();
            };
        }

        loadCameraList();
    }

    /* ================================================================
       入口：先探测，再渲染
       ================================================================ */
    async function renderWithProbe(bodyEl) {
        if (!_probe.checked && !_probe.checking) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('正在探测摄像头…', 'Probing cameras…')}</div>`;
            await probeAll();
        }
        render(bodyEl);
    }

    window.qx6Register('device', (bodyEl) => {
        renderWithProbe(bodyEl);
    });
    console.log('[qx6_3_device] 已注册 device 面板');
})();