/* ================================================================
   情绪宝 - qx0 主屏框架（含契约校验 + 中英文全站切换 + 统一状态栏）
   ================================================================ */

   const MQXB_VERSION = 1;
   const EXPIRY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
   
   /* ================================================================
      身份简称映射
      ================================================================ */
   const TYPE_LABEL = {
       1: { cn: '普通', en: 'Normal' },
       2: { cn: 'VIP', en: 'VIP' },
       3: { cn: 'VIP', en: 'VIP' },
       4: { cn: 'VIP', en: 'VIP' },
       5: { cn: 'VIP', en: 'VIP' },
       6: { cn: '家庭', en: 'Family' },
       7: { cn: '导师', en: 'Counselor' },
       8: { cn: '音乐', en: 'Music' },
       9: { cn: '系统', en: 'System' },
       10: { cn: '财务', en: 'Finance' },
       11: { cn: '企业', en: 'Enterprise' },
       12: { cn: '学生', en: 'Student' },
       13: { cn: '13', en: '13' },
       14: { cn: '访客', en: 'Guest' },
   };
   
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
   
   /* ================================================================
      契约校验失败 → 清除 + 跳登录页
      ================================================================ */
   function clearMqxbAndGoLogin(reason) {
       localStorage.removeItem('mQxb');
       const url = reason
           ? `qx00_login.html?reason=${encodeURIComponent(reason)}`
           : 'qx00_login.html';
       window.location.href = url;
   }
   
   /* ================================================================
      加载 + 校验全局变量
      ================================================================ */
   function loadGlobalVars() {
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
   
       const ut = parseInt(data.user_id_Type);
       if (isNaN(ut) || ut < 1 || ut > 14) {
           console.warn('mQxb user_id_Type 越界:', data.user_id_Type);
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
   
       console.log('全局变量已加载:', window.mQxb);
       return true;
   }
   
   /* ================================================================
      获取身份简称
      ================================================================ */
   function getUserTypeLabel() {
       const lang = window.mQxb.Language || 1;
       const type = parseInt(window.mQxb.user_id_Type) || 1;
       const label = TYPE_LABEL[type] || TYPE_LABEL[1];
       return lang === 1 ? label.cn : label.en;
   }
   
   /* ================================================================
      状态栏（左日期 / 中标题 / 右身份+名字）
      ================================================================ */
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
   
       document.getElementById('status_date').innerText = dateStr;
       document.getElementById('status_title').innerText = middleTitle || t.title_main;
       document.getElementById('status_user').innerText = `${t.userPrefix} ${getUserTypeLabel()} ${window.mQxb.Username || 'User'}`;
   }
   
   /* ================================================================
      菜单条
      ================================================================ */
   function updateMenuBar() {
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       document.querySelectorAll('.qx0-menu-bar .menu-item').forEach(btn => {
           const key = btn.dataset.i18n;
           if (key && t[key]) btn.innerText = t[key];
       });
   }
   
   /* ================================================================
      功能层标题 / 返回 / 占位符（qx2~qx6 还在用）
      ================================================================ */
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
   
   /* ================================================================
      背景图
      ================================================================ */
   function updateBackground() {
       const img = window.mQxb.UserImage || 'qxbaouser1.jpg';
       document.getElementById('qx0_bg').src = `picture/${img}`;
   }
   
   /* ================================================================
      Logo 中英文顺序
      ================================================================ */
   function updateLogo() {
       const lang = window.mQxb.Language || 1;
       const overlay = document.getElementById('qx0_logo');
       if (!overlay) return;
   
       overlay.classList.remove('en-mode');
   
       if (lang === 2) {
           overlay.classList.add('en-mode');
       }
   
       overlay.innerHTML = `
           <div class="logo-cn">情绪宝</div>
           <div class="logo-en">Emo Treasure</div>
       `;
   }
   
   /* ================================================================
      一键应用所有多语言
      ================================================================ */
   function applyAllI18n() {
       updateStatusBar();
       updateMenuBar();
       updateFunctionTexts();
       updateLogo();
   }
   
   /* ================================================================
      菜单条事件
      ================================================================ */
   function initMenuBar() {
       document.querySelectorAll('.qx0-menu-bar .menu-item').forEach(btn => {
           btn.addEventListener('click', () => {
               enterFunction(btn.dataset.page);
           });
       });
   }
   
   /* ================================================================
      进入功能
      ================================================================ */
   function enterFunction(page) {
       document.body.classList.add('function-active');
       document.querySelectorAll('.qx-function-layer').forEach(l => l.classList.remove('active'));
       const target = document.getElementById(`${page}_layer`);
       if (target) target.classList.add('active');
   
       // 中间标题随功能切换
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       const titleKey = `title_${page}`;
       updateStatusBar(t[titleKey] || t.title_main);
   
       const initFn = window[`${page}_init`];
       if (typeof initFn === 'function') initFn();
   
       console.log(`进入功能：${page}`);
   }
   
   /* ================================================================
      返回主屏
      ================================================================ */
   function returnToMain() {
       const activeLayer = document.querySelector('.qx-function-layer.active');
       if (activeLayer) {
           const pageId = activeLayer.id.replace('_layer', '');
           const destroyFn = window[`${pageId}_destroy`];
           if (typeof destroyFn === 'function') destroyFn();
           activeLayer.classList.remove('active');
       }
       document.body.classList.remove('function-active');
   
       // 中间标题改回主屏
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       updateStatusBar(t.title_main);
   
       console.log('返回主屏');
   }
   
   /* ================================================================
      返回按钮事件（qx2~qx6 还在用）
      ================================================================ */
   function initBackButtons() {
       document.querySelectorAll('.qx-back-btn').forEach(btn => {
           btn.addEventListener('click', () => returnToMain());
       });
   }
   
   /* ================================================================
      入口
      ================================================================ */
   document.addEventListener('DOMContentLoaded', () => {
       console.log('qx0_main.js 已加载');
   
       const ok = loadGlobalVars();
       if (!ok) return;
   
       applyAllI18n();
       updateBackground();
       initMenuBar();
       initBackButtons();
   });