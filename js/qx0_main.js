/* ================================================================
   情绪宝 - qx0 主屏框架
   v6 改动：
   - loadGlobalVars() 里初始化 mQxb.Sensor
     · hrvSource: 'camera' | 'polar'，默认 'camera'
     · hrvCameraFacing: 'environment' | 'user'，默认 'environment'
     · 从 localStorage 读，写到 mQxb.Sensor
   - 其余同 v5
   ================================================================ */

   const MQXB_VERSION = 1;
   const EXPIRY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

   const SUPABASE_URL = 'https://api.emobao.com';
   const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

   /* 内联兜底身份字典 */
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

   function getTypeMapSafe() {
       if (window.qxTypeLabel && typeof window.qxTypeLabel.getMap === 'function') {
           return window.qxTypeLabel.getMap();
       }
       return INLINE_TYPE_FALLBACK;
   }

   function typeHasSafe(ut) {
       const k = parseInt(ut);
       if (isNaN(k)) return false;
       if (window.qxTypeLabel && typeof window.qxTypeLabel.has === 'function') {
           return window.qxTypeLabel.has(k);
       }
       return !!INLINE_TYPE_FALLBACK[k];
   }

   function typeLabelSafe(ut) {
       const k = parseInt(ut);
       if (window.qxTypeLabel && typeof window.qxTypeLabel.get === 'function') {
           return window.qxTypeLabel.get(k);
       }
       const lb = INLINE_TYPE_FALLBACK[k] || INLINE_TYPE_FALLBACK[1];
       const lang = (window.mQxb && window.mQxb.Language) || 1;
       return lang === 1 ? lb.cn : lb.en;
   }

   async function ensureTypeDictLoaded() {
       if (!window.qxTypeLabel) {
           console.warn('[qx0_main] qxTypeLabel 未加载，使用内联兜底字典');
           return false;
       }
       if (typeof window.qxTypeLabel.waitFor === 'function') {
           const ok = await window.qxTypeLabel.waitFor(3000);
           if (!ok) console.warn('[qx0_main] qxTypeLabel.waitFor 超时，继续');
           return ok;
       }
       if (typeof window.qxTypeLabel.load === 'function') {
           try { await window.qxTypeLabel.load(); return true; }
           catch (e) { return false; }
       }
       return false;
   }

   /* ================================================================
      多语言文案
      ================================================================ */
   const I18N = {
       1: {
           brand: '情绪宝 / Emo Treasure',
           menu_perceive: '感知',
           menu_regulate: '调节',
           menu_report: '报告',
           menu_qa: '问答',
           menu_assessment: '测评',
           menu_settings: '设置',
           title_main: '情绪宝 / Emo Treasure',
           title_qx1: '情绪感知',
           title_qx2: '情绪调节',
           title_qx3: '报告分析',
           title_qx4: '智能问答',
           title_qx5: '趣味评测',
           title_qx6: '设置工作',
           back: '← 返回主屏',
           placeholder_qx1: '情绪感知功能开发中...',
           placeholder_qx2: '情绪调节功能开发中...',
           placeholder_qx3: '报告分析功能开发中...',
           placeholder_qx4: '智能问答功能开发中...',
           placeholder_qx5: '趣味评测功能开发中...',
           placeholder_qx6: '设置功能开发中...',
           week: ['日', '一', '二', '三', '四', '五', '六'],
           userPrefix: '👤',
       },
       2: {
           brand: 'Emo Treasure / 情绪宝',
           menu_perceive: 'Perceive',
           menu_regulate: 'Regulate',
           menu_report: 'Report',
           menu_qa: 'Q&A',
           menu_assessment: 'Assessment',
           menu_settings: 'Settings',
           title_main: 'Emo Treasure / 情绪宝',
           title_qx1: 'Emotion Perceive',
           title_qx2: 'Emotion Regulate',
           title_qx3: 'Report Analysis',
           title_qx4: 'Smart Q&A',
           title_qx5: 'Fun Assessment',
           title_qx6: 'Settings',
           back: '← Back',
           placeholder_qx1: 'Emotion Perceive - Coming soon...',
           placeholder_qx2: 'Emotion Regulate - Coming soon...',
           placeholder_qx3: 'Report Analysis - Coming soon...',
           placeholder_qx4: 'Smart Q&A - Coming soon...',
           placeholder_qx5: 'Fun Assessment - Coming soon...',
           placeholder_qx6: 'Settings - Coming soon...',
           week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
           userPrefix: '👤',
       }
   };

   function clearMqxbAndGoLogin(reason) {
       localStorage.removeItem('mQxb');
       const url = reason
           ? `qx00_login.html?reason=${encodeURIComponent(reason)}`
           : 'qx00_login.html';
       window.location.href = url;
   }

   /* ================================================================
      初始化 mQxb.Sensor（采样源偏好）
      ================================================================ */
   function initSensorPrefs() {
       if (!window.mQxb) window.mQxb = {};
       if (!window.mQxb.Sensor) window.mQxb.Sensor = {};

       let hrvSource = 'camera';
       let hrvCameraFacing = 'environment';

       try {
           const s = localStorage.getItem('emobao_hrv_source');
           if (s === 'polar' || s === 'camera') hrvSource = s;
       } catch (e) {}

       try {
           const f = localStorage.getItem('emobao_camera_facing');
           if (f === 'user' || f === 'environment') hrvCameraFacing = f;
       } catch (e) {}

       window.mQxb.Sensor.hrvSource = hrvSource;
       window.mQxb.Sensor.hrvCameraFacing = hrvCameraFacing;

       console.log('[qx0_main] mQxb.Sensor 初始化：', window.mQxb.Sensor);
   }

   /* ================================================================
      加载 + 校验全局变量
      ================================================================ */
   async function loadGlobalVars() {
       const saved = localStorage.getItem('mQxb');

       if (!saved) {
           console.warn('mQxb 不存在，跳回登录页');
           clearMqxbAndGoLogin();
           return false;
       }

       let data;
       try {
           data = JSON.parse(saved);
       } catch (e) {
           console.error('mQxb 解析失败:', e);
           clearMqxbAndGoLogin();
           return false;
       }

       if (data._version !== MQXB_VERSION) {
           console.warn('mQxb 版本不匹配:', data._version);
           clearMqxbAndGoLogin();
           return false;
       }

       if (!data._createdAt || isNaN(Date.parse(data._createdAt))) {
           console.warn('mQxb _createdAt 非法:', data._createdAt);
           clearMqxbAndGoLogin();
           return false;
       }

       const required = ['user_id', 'user_id_Type', 'Username', 'UserImage'];
       for (const key of required) {
           if (data[key] === null || data[key] === undefined || data[key] === '') {
               console.warn(`mQxb 缺失字段: ${key}`);
               clearMqxbAndGoLogin();
               return false;
           }
       }

       await ensureTypeDictLoaded();

       const ut = parseInt(data.user_id_Type);
       if (!typeHasSafe(ut)) {
           console.warn('mQxb user_id_Type 不在字典:', data.user_id_Type);
           clearMqxbAndGoLogin();
           return false;
       }

       if (!EXPIRY_REGEX.test(data.ExpiryDate)) {
           console.warn('mQxb ExpiryDate 格式错误:', data.ExpiryDate);
           clearMqxbAndGoLogin();
           return false;
       }

       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const expiry = new Date(data.ExpiryDate + 'T00:00:00');
       if (expiry < today) {
           console.warn('mQxb 已过期:', data.ExpiryDate);
           clearMqxbAndGoLogin('expired');
           return false;
       }

       window.mQxb = Object.assign(window.mQxb || {}, data);

       const savedLang = localStorage.getItem('emobao_lang');
       if (savedLang) {
           window.mQxb.Language = parseInt(savedLang);
       }

       /* 关键：初始化 Sensor 偏好 */
       initSensorPrefs();

       console.log('全局变量已加载:', window.mQxb);
       return true;
   }

   function getUserTypeLabel() {
       const type = parseInt(window.mQxb.user_id_Type) || 1;
       return typeLabelSafe(type);
   }

   function updateStatusBar(middleTitle) {
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       const now = new Date();
       const dayIndex = now.getDay();

       let dateStr;
       if (lang === 1) {
           dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} 周${t.week[dayIndex]}`;
       } else {
           dateStr = `${t.week[dayIndex]}, ${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;
       }

       const dateEl = document.getElementById('status_date');
       if (dateEl) dateEl.innerText = dateStr;
       const titleEl = document.getElementById('status_title');
       if (titleEl) titleEl.innerText = middleTitle || t.title_main;
       const userEl = document.getElementById('status_user');
       if (userEl) {
           userEl.innerText = `${t.userPrefix} ${getUserTypeLabel()} ${window.mQxb.Username || 'User'}`;
       }
   }

   function updateMenuBar() {
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       document.querySelectorAll('.qx0-menu-bar .menu-item').forEach(btn => {
           const key = btn.dataset.i18n;
           if (key && t[key]) btn.innerText = t[key];
       });
   }

   function updateFunctionTexts() {
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];

       document.querySelectorAll('.qx-function-layer').forEach(layer => {
           const layerId = layer.id.replace('_layer', '');

           const titleEl = layer.querySelector('.qx-title');
           if (titleEl) {
               const titleKey = `title_${layerId}`;
               if (t[titleKey]) titleEl.innerText = t[titleKey];
           }

           const backBtn = layer.querySelector('.qx-back-btn');
           if (backBtn) backBtn.innerText = t.back;

           const placeholder = layer.querySelector('.qx-placeholder');
           if (placeholder) {
               const phKey = `placeholder_${layerId}`;
               if (t[phKey]) placeholder.innerText = t[phKey];
           }
       });
   }

   async function updateBackground() {
       const bgEl = document.getElementById('qx0_bg');
       if (!bgEl) return;

       const teamcode = window.mQxb.TeamCode;
       if (teamcode) {
           const customUrl = await fetchTeamBgUrl(teamcode);
           if (customUrl) {
               bgEl.src = customUrl;
               return;
           }
       }

       const img = window.mQxb.UserImage || 'qxbaouser1.jpg';
       bgEl.src = `picture/${img}`;
   }

   async function fetchTeamBgUrl(teamcode) {
       try {
           const res = await fetch(
               `${SUPABASE_URL}/rest/v1/emobao_redemptioncode?code=eq.${encodeURIComponent(teamcode)}&select=custom_bg_url&limit=1`,
               {
                   headers: {
                       'apikey': SUPABASE_KEY,
                       'Authorization': `Bearer ${SUPABASE_KEY}`,
                   },
               }
           );
           if (!res.ok) return null;
           const rows = await res.json();
           return (rows && rows[0] && rows[0].custom_bg_url) || null;
       } catch (e) {
           return null;
       }
   }

   function updateLogo() { /* 保留空函数 */ }

   function applyAllI18n() {
       updateStatusBar();
       updateMenuBar();
       updateFunctionTexts();
   }

   function initMenuBar() {
       document.querySelectorAll('.qx0-menu-bar .menu-item').forEach(btn => {
           btn.addEventListener('click', () => {
               enterFunction(btn.dataset.page);
           });
       });
   }

   function enterFunction(page) {
       document.body.classList.add('function-active');
       document.querySelectorAll('.qx-function-layer').forEach(l => l.classList.remove('active'));
       const target = document.getElementById(`${page}_layer`);
       if (target) target.classList.add('active');

       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       const titleKey = `title_${page}`;
       updateStatusBar(t[titleKey] || t.title_main);

       const initFn = window[`${page}_init`];
       if (typeof initFn === 'function') initFn();
   }

   function returnToMain() {
       const activeLayer = document.querySelector('.qx-function-layer.active');
       if (activeLayer) {
           const pageId = activeLayer.id.replace('_layer', '');
           const destroyFn = window[`${pageId}_destroy`];
           if (typeof destroyFn === 'function') destroyFn();
           activeLayer.classList.remove('active');
       }
       document.body.classList.remove('function-active');

       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       updateStatusBar(t.title_main);
   }

   function initBackButtons() {
       document.querySelectorAll('.qx-back-btn').forEach(btn => {
           btn.addEventListener('click', () => returnToMain());
       });
   }

   document.addEventListener('DOMContentLoaded', async () => {
       console.log('qx0_main.js 已加载');

       const ok = await loadGlobalVars();
       if (!ok) return;

       applyAllI18n();
       updateBackground();
       initMenuBar();
       initBackButtons();
   });

   window.qx0GetTypeMapSafe = getTypeMapSafe;
   window.qx0TypeHasSafe = typeHasSafe;
   window.qx0TypeLabelSafe = typeLabelSafe;