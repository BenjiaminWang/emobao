/* ================================================================
   情绪宝 - qx00 登录前逻辑（v8，含登录/注册 + 密码登录 + 强制设密码 + 契约 + Toast）
   ================================================================ */

   const SUPABASE_URL = 'https://lmmnwmueppkdbzvufxar.supabase.co';
   const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';
   
   const MQXB_VERSION = 1;
   const PASSWORD_SALT = 'emobao_salt_2026';
   
   window.mQxb = {
       user_id: null,
       user_id_Type: null,
       Language: 1,
       Username: null,
       UserImage: null,
       IsGuest: false,
       ExpiryDate: null,
       IsTeamLeader: false,
       TeamCode: null,
   };
   
   let _pendingUser = null;
   
   /* ================================================================
      密码哈希（SHA-256 + salt）
      ================================================================ */
   async function hashPassword(plain) {
       const buf = new TextEncoder().encode(plain + PASSWORD_SALT);
       const hash = await crypto.subtle.digest('SHA-256', buf);
       return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
   }
   
   /* ================================================================
      身份 → 主图映射
      ================================================================ */
   function getUserImage(usertype) {
       const t = parseInt(usertype);
       if (t >= 1 && t <= 6) return 'qxbaouser2.jpg';
       if (t === 7 || t === 8) return 'qxbaouser4.jpg';
       if (t === 9 || t === 10) return 'qxbaouser5.jpg';
       if (t === 11 || t === 12 || t === 13) return 'qxbaouser3.jpg';
       if (t === 14) return 'qxbaouser1.jpg';
       return 'qxbaouser2.jpg';
   }
   
   /* ================================================================
      契约字段统一写入
      ================================================================ */
   function saveMqxb() {
       window.mQxb._version = MQXB_VERSION;
       window.mQxb._createdAt = new Date().toISOString();
       localStorage.setItem('mQxb', JSON.stringify(window.mQxb));
   }
   
   /* ================================================================
      Toast 提示条
      ================================================================ */
   let _toastTimer = null;
   
   function showToast(text, type = 'info', duration = 3000) {
       const bar = document.getElementById('toast_bar');
       if (!bar) return;
   
       if (_toastTimer) {
           clearTimeout(_toastTimer);
           _toastTimer = null;
       }
   
       const iconMap = {
           info: 'ℹ️',
           success: '✓',
           warning: '⚠️',
           error: '✕'
       };
   
       bar.className = 'toast-bar toast-' + type;
       bar.innerHTML =
           '<span class="toast-icon"></span>' +
           '<span class="toast-text"></span>' +
           '<button class="toast-close" type="button" aria-label="关闭">✕</button>';
   
       bar.querySelector('.toast-icon').textContent = iconMap[type] || iconMap.info;
       bar.querySelector('.toast-text').textContent = text;
   
       bar.querySelector('.toast-close').addEventListener('click', () => {
           hideToast();
       });
   
       requestAnimationFrame(() => {
           bar.classList.add('show');
       });
   
       if (duration > 0) {
           _toastTimer = setTimeout(() => {
               hideToast();
           }, duration);
       }
   }
   
   function hideToast() {
       const bar = document.getElementById('toast_bar');
       if (!bar) return;
       bar.classList.remove('show');
       if (_toastTimer) {
           clearTimeout(_toastTimer);
           _toastTimer = null;
       }
   }
   
   /* ================================================================
      多语言文案
      ================================================================ */
   const TEXT = {
       1: {
           welcome: "情绪宝帮助您记录理解改善自己的情绪。\n情绪宝作为一个工具不替代任何专业的医疗诊断和医疗处理。\n情绪宝遵循隐私高于一切的原则，情绪数据属于用户本人。\n系统不会上传个人敏感信息。",
           agree: "同意",
           disagree: "不同意",
           tabLogin: "登录",
           tabRegister: "注册",
           loginNamePlaceholder: "请输入用户名",
           loginPasswordPlaceholder: "请输入密码",
           loginBtn: "登 录",
           registerBtn: "注 册",
           accountPlaceholder: "请输入手机号或邮箱",
           codePlaceholder: "请输入验证码",
           getCode: "获取验证码",
           otherRegister: "其他注册方式",
           wechat: "微信注册",
           activation: "激活码",
           guest: "访客体验",
           guestNamePlaceholder: "请输入您的名字（必填）",
           confirm: "确 认",
           back: "返 回",
           activationPlaceholder: "请输入激活码",
           activationNamePlaceholder: "请输入您的名字（必填）",
           alertGuestName: "请输入您的名字",
           alertActivationEmpty: "请输入激活码",
           alertActivationNameEmpty: "请输入您的名字",
           alertLoginEmpty: "请输入用户名和密码",
           loginFailed: "用户名或密码错误",
           loginSuccess: "登录成功，正在进入...",
           checking: "校验中...",
           activationSuccess: "激活成功！请设置登录密码",
           activationInvalid: "激活码无效或已使用",
           activationUsed: "激活码已被使用",
           activationExpired: "激活码已过期",
           activationExhausted: "激活码已用尽",
           usernameTaken: "该用户名已被占用，请换一个",
           networkError: "网络错误，请重试",
           sessionExpired: "登录已过期，请重新登录",
           passwordIntro: "请设置您的登录密码",
           passwordRules1: "至少 8 位",
           passwordRules2: "包含字母 / 数字 / 大写 / 小写 / 特殊字符（至少 3 类）",
           passwordTooWeak: "密码强度不足",
           passwordComplete: "完 成",
           passwordSuccess: "设置成功，正在进入...",
           passwordEmpty: "请输入密码",
           strength0: "太弱",
           strength1: "弱",
           strength2: "中",
           strength3: "强",
           strength4: "很强",
       },
       2: {
           welcome: "Emo Treasure helps you record, understand, and improve your emotions.\nAs a tool, Emo Treasure does not replace any professional medical diagnosis or medical treatment.\nEmo Treasure follows the principle that privacy is above all. Your emotional data belongs to you.\nThe system will not upload any of your personal sensitive information.",
           agree: "Agree",
           disagree: "Disagree",
           tabLogin: "Login",
           tabRegister: "Register",
           loginNamePlaceholder: "Username",
           loginPasswordPlaceholder: "Password",
           loginBtn: "Log In",
           registerBtn: "Register",
           accountPlaceholder: "Phone or Email",
           codePlaceholder: "Verification code",
           getCode: "Get Code",
           otherRegister: "Other ways",
           wechat: "WeChat",
           activation: "Activation",
           guest: "Guest",
           guestNamePlaceholder: "Enter your name (required)",
           confirm: "Confirm",
           back: "Back",
           activationPlaceholder: "Enter activation code",
           activationNamePlaceholder: "Enter your name (required)",
           alertGuestName: "Please enter your name",
           alertActivationEmpty: "Please enter activation code",
           alertActivationNameEmpty: "Please enter your name",
           alertLoginEmpty: "Please enter username and password",
           loginFailed: "Invalid username or password",
           loginSuccess: "Login successful. Entering...",
           checking: "Checking...",
           activationSuccess: "Activated! Please set your password",
           activationUsed: "Code already used",
           activationInvalid: "Invalid or used code",
           activationExpired: "Code expired",
           activationExhausted: "Code exhausted",
           usernameTaken: "Username already taken, please choose another",
           networkError: "Network error, please retry",
           sessionExpired: "Your session has expired. Please log in again.",
           passwordIntro: "Please set your login password",
           passwordRules1: "At least 8 characters",
           passwordRules2: "Include letters / digits / uppercase / lowercase / special chars (at least 3 types)",
           passwordTooWeak: "Password too weak",
           passwordComplete: "Complete",
           passwordSuccess: "Success! Entering...",
           passwordEmpty: "Please enter password",
           strength0: "Too weak",
           strength1: "Weak",
           strength2: "Medium",
           strength3: "Strong",
           strength4: "Very strong",
       }
   };
   
   /* ================================================================
      页面切换
      ================================================================ */
   function showLayer(layerId) {
       document.querySelectorAll('.layer').forEach(l => l.classList.remove('active'));
       document.getElementById(layerId).classList.add('active');
   }
   
   /* ================================================================
      Tab 切换（登录 / 注册）
      ================================================================ */
   function switchAuthTab(tab) {
       const tabLogin = document.getElementById('tab_login');
       const tabRegister = document.getElementById('tab_register');
       const panelLogin = document.getElementById('auth_login_panel');
       const panelRegister = document.getElementById('auth_register_panel');
   
       if (tab === 'login') {
           tabLogin.classList.add('active');
           tabRegister.classList.remove('active');
           panelLogin.classList.add('active');
           panelRegister.classList.remove('active');
       } else {
           tabRegister.classList.add('active');
           tabLogin.classList.remove('active');
           panelRegister.classList.add('active');
           panelLogin.classList.remove('active');
       }
   }
   
   function initAuthTabs() {
       document.getElementById('tab_login').addEventListener('click', () => switchAuthTab('login'));
       document.getElementById('tab_register').addEventListener('click', () => switchAuthTab('register'));
   }
   
   /* ================================================================
      多语言应用
      ================================================================ */
   function applyLanguage() {
       const lang = window.mQxb.Language;
       const t = TEXT[lang];
   
       document.getElementById('welcome_text').innerText = t.welcome;
       document.getElementById('btn_welcome_agree').innerText = t.agree;
       document.getElementById('btn_welcome_disagree').innerText = t.disagree;
   
       document.getElementById('tab_login').innerText = t.tabLogin;
       document.getElementById('tab_register').innerText = t.tabRegister;
   
       document.getElementById('input_login_name').placeholder = t.loginNamePlaceholder;
       document.getElementById('input_login_password').placeholder = t.loginPasswordPlaceholder;
       document.getElementById('btn_do_login').innerText = t.loginBtn;
   
       document.getElementById('input_account').placeholder = t.accountPlaceholder;
       document.getElementById('input_code').placeholder = t.codePlaceholder;
       document.getElementById('btn_get_code').innerText = t.getCode;
       document.getElementById('btn_login').innerText = t.registerBtn;
       document.querySelector('#auth_register_panel .divider span').innerText = t.otherRegister;
       document.getElementById('btn_wechat').innerHTML = `<span class="icon">💬</span> ${t.wechat}`;
       document.getElementById('btn_activation').innerHTML = `<span class="icon">🔑</span> ${t.activation}`;
       document.getElementById('btn_guest').innerText = `👤 ${t.guest}`;
   
       document.getElementById('input_guest_name').placeholder = t.guestNamePlaceholder;
       document.getElementById('btn_guest_confirm').innerText = t.confirm;
       document.getElementById('btn_guest_back').innerText = t.back;
   
       document.getElementById('input_activation_code').placeholder = t.activationPlaceholder;
       document.getElementById('input_activation_name').placeholder = t.activationNamePlaceholder;
       document.getElementById('btn_activation_confirm').innerText = t.confirm;
       document.getElementById('btn_activation_back').innerText = t.back;
   
       document.getElementById('password_intro').innerText = t.passwordIntro;
       document.getElementById('input_new_password').placeholder = t.loginPasswordPlaceholder;
       document.getElementById('password_rules').innerHTML =
           `<div>${t.passwordRules1}</div><div>${t.passwordRules2}</div>`;
       document.getElementById('btn_password_confirm').innerText = t.passwordComplete;
   
       const langBtn = document.getElementById('lang_switch');
       if (langBtn) {
           langBtn.innerText = lang === 1 ? '中 / EN' : 'EN / 中';
       }
   
       document.querySelectorAll('.logo-block').forEach(block => {
           if (lang === 2) {
               block.classList.add('en-mode');
           } else {
               block.classList.remove('en-mode');
           }
       });
   }
   
   /* ================================================================
      语言切换
      ================================================================ */
   function initLangSwitch() {
       const langBtn = document.getElementById('lang_switch');
       if (!langBtn) return;
       langBtn.addEventListener('click', () => {
           window.mQxb.Language = window.mQxb.Language === 1 ? 2 : 1;
           applyLanguage();
           localStorage.setItem('emobao_lang', window.mQxb.Language);
       });
   }
   
   /* ================================================================
      欢迎页
      ================================================================ */
   function initWelcome() {
       document.getElementById('btn_welcome_agree').addEventListener('click', () => {
           localStorage.setItem('emobao_agreed', 'true');
           showLayer('login_layer');
       });
       document.getElementById('btn_welcome_disagree').addEventListener('click', () => {
           alert('感谢您的访问');
           window.close();
       });
   }
   
   /* ================================================================
      密码强度计算
      ================================================================ */
   function calcPasswordStrength(pwd) {
       if (!pwd || pwd.length < 8) return 0;
       const weakList = ['88888888', '66666666', '12345678', '11111111', '00000000', '123456789'];
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
   
   function renderPasswordStrength(strength) {
       const fill = document.getElementById('pwd_strength_fill');
       const text = document.getElementById('pwd_strength_text');
       const t = TEXT[window.mQxb.Language];
   
       const colors = ['#E74C3C', '#E67E22', '#F1C40F', '#2C7BE5', '#2ECC71'];
       const widths = ['20%', '40%', '60%', '80%', '100%'];
       const labels = [t.strength0, t.strength1, t.strength2, t.strength3, t.strength4];
   
       fill.style.width = widths[strength];
       fill.style.background = colors[strength];
       text.innerText = labels[strength];
       text.style.color = colors[strength];
   }
   
   /* ================================================================
      设置密码页
      ================================================================ */
/* ================================================================
   密码框眼睛切换
   ================================================================ */
   function initPasswordEyes() {
    document.querySelectorAll('.password-eye').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;

            const eyeOpen = btn.querySelector('.eye-open');
            const eyeClosed = btn.querySelector('.eye-closed');

            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            } else {
                input.type = 'password';
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            }
        });
    });
}

      function initPasswordPage() {
       const pwdInput = document.getElementById('input_new_password');
       const confirmBtn = document.getElementById('btn_password_confirm');
       const statusMsg = document.getElementById('password_status');
   
       function showStatus(text, type) {
           statusMsg.innerText = text;
           statusMsg.classList.remove('success', 'error');
           statusMsg.classList.add('show', type);
       }
   
       pwdInput.addEventListener('input', () => {
           const pwd = pwdInput.value;
           const strength = calcPasswordStrength(pwd);
           renderPasswordStrength(strength);
           confirmBtn.disabled = (strength < 3);
       });
   
       confirmBtn.addEventListener('click', async () => {
           const t = TEXT[window.mQxb.Language];
           const pwd = pwdInput.value;
   
           if (!pwd) {
               showStatus(t.passwordEmpty, 'error');
               return;
           }
   
           const strength = calcPasswordStrength(pwd);
           if (strength < 3) {
               showStatus(t.passwordTooWeak, 'error');
               return;
           }
   
           confirmBtn.disabled = true;
           confirmBtn.innerText = t.checking;
   
           try {
               const hash = await hashPassword(pwd);
   
               const resp = await fetch(
                   `${SUPABASE_URL}/rest/v1/rpc/emobao_set_password`,
                   {
                       method: 'POST',
                       headers: {
                           'apikey': SUPABASE_KEY,
                           'Authorization': `Bearer ${SUPABASE_KEY}`,
                           'Content-Type': 'application/json'
                       },
                       body: JSON.stringify({
                           p_userid: _pendingUser.user_id,
                           p_passwordhash: hash
                       })
                   }
               );
   
               const result = await resp.json();
               if (!result || !result[0] || !result[0].success) {
                   throw new Error('更新密码失败');
               }
   
               window.mQxb.user_id = _pendingUser.user_id;
               window.mQxb.user_id_Type = _pendingUser.user_id_Type;
               window.mQxb.Username = _pendingUser.Username;
               window.mQxb.UserImage = _pendingUser.UserImage;
               window.mQxb.IsGuest = false;
               window.mQxb.ExpiryDate = _pendingUser.ExpiryDate;
               window.mQxb.IsTeamLeader = _pendingUser.IsTeamLeader;
               window.mQxb.TeamCode = _pendingUser.TeamCode;
   
               saveMqxb();
   
               showStatus(t.passwordSuccess, 'success');
   
               setTimeout(() => {
                   window.location.href = 'index.html';
               }, 800);
   
           } catch (err) {
               console.error('设置密码失败:', err);
               showStatus(TEXT[window.mQxb.Language].networkError, 'error');
               confirmBtn.disabled = false;
               confirmBtn.innerText = t.passwordComplete;
           }
       });
   }
   
   /* ================================================================
      登录（名字 + 密码）
      ================================================================ */
   function initLoginForm() {
       const nameInput = document.getElementById('input_login_name');
       const passInput = document.getElementById('input_login_password');
       const btn = document.getElementById('btn_do_login');
       const statusMsg = document.getElementById('login_status');
   
       function showStatus(text, type) {
           statusMsg.innerText = text;
           statusMsg.classList.remove('success', 'error');
           statusMsg.classList.add('show', type);
       }
   
       btn.addEventListener('click', async () => {
           const t = TEXT[window.mQxb.Language];
           const name = nameInput.value.trim();
           const pass = passInput.value;
   
           if (!name || !pass) {
               showStatus(t.alertLoginEmpty, 'error');
               return;
           }
   
           btn.disabled = true;
           btn.innerText = t.checking;
           showStatus(t.checking, 'success');
   
           try {
               const hash = await hashPassword(pass);
   
               const resp = await fetch(
                   `${SUPABASE_URL}/rest/v1/emobao_user?username=eq.${encodeURIComponent(name)}&passwordhash=eq.${hash}&select=*`,
                   {
                       headers: {
                           'apikey': SUPABASE_KEY,
                           'Authorization': `Bearer ${SUPABASE_KEY}`
                       }
                   }
               );
   
               const users = await resp.json();
   
               if (!users || users.length === 0) {
                   showStatus(t.loginFailed, 'error');
                   btn.disabled = false;
                   btn.innerText = t.loginBtn;
                   return;
               }
   
               if (users.length !== 1) {
                   showStatus(t.loginFailed, 'error');
                   btn.disabled = false;
                   btn.innerText = t.loginBtn;
                   return;
               }
   
               const user = users[0];
   
               const today = new Date();
               today.setHours(0, 0, 0, 0);
               const expiry = new Date(user.expirydate + 'T00:00:00');
               if (expiry < today) {
                   showStatus(t.sessionExpired, 'error');
                   btn.disabled = false;
                   btn.innerText = t.loginBtn;
                   return;
               }
   
               if (user.isactive === false) {
                   showStatus(t.loginFailed, 'error');
                   btn.disabled = false;
                   btn.innerText = t.loginBtn;
                   return;
               }
   
               if (user.mustchangepassword === true) {
                   _pendingUser = {
                       user_id: user.userid,
                       user_id_Type: user.usertypekey,
                       Username: user.username,
                       UserImage: getUserImage(user.usertypekey),
                       ExpiryDate: user.expirydate,
                       IsTeamLeader: user.isteamleader || false,
                       TeamCode: user.teamcode || null,
                   };
   
                   document.getElementById('input_new_password').value = '';
                   document.getElementById('pwd_strength_fill').style.width = '0%';
                   document.getElementById('pwd_strength_text').innerText = '';
                   document.getElementById('btn_password_confirm').disabled = true;
   
                   showStatus(t.loginSuccess, 'success');
   
                   setTimeout(() => {
                       showLayer('password_layer');
                       applyLanguage();
                   }, 500);
                   return;
               }
   
               window.mQxb.user_id = user.userid;
               window.mQxb.user_id_Type = user.usertypekey;
               window.mQxb.Username = user.username;
               window.mQxb.UserImage = getUserImage(user.usertypekey);
               window.mQxb.IsGuest = user.isguest || false;
               window.mQxb.ExpiryDate = user.expirydate;
               window.mQxb.IsTeamLeader = user.isteamleader || false;
               window.mQxb.TeamCode = user.teamcode || null;
   
               saveMqxb();
   
               fetch(
                   `${SUPABASE_URL}/rest/v1/emobao_user?userid=eq.${user.userid}`,
                   {
                       method: 'PATCH',
                       headers: {
                           'apikey': SUPABASE_KEY,
                           'Authorization': `Bearer ${SUPABASE_KEY}`,
                           'Content-Type': 'application/json'
                       },
                       body: JSON.stringify({ lastloginat: new Date().toISOString() })
                   }
               ).catch(() => {});
   
               showStatus(t.loginSuccess, 'success');
   
               setTimeout(() => {
                   window.location.href = 'index.html';
               }, 800);
   
           } catch (err) {
               console.error('登录失败:', err);
               showStatus(TEXT[window.mQxb.Language].networkError, 'error');
               btn.disabled = false;
               btn.innerText = t.loginBtn;
           }
       });
   
       passInput.addEventListener('keydown', (e) => {
           if (e.key === 'Enter') btn.click();
       });
   }
   
   /* ================================================================
      获取验证码（占位）
      ================================================================ */
   function initGetCode() {
       document.getElementById('btn_get_code').addEventListener('click', () => {
           const account = document.getElementById('input_account').value.trim();
           if (!account) {
               alert('请输入手机号或邮箱');
               return;
           }
           alert('验证码已发送（演示）');
       });
   }
   
   /* ================================================================
      注册（占位）
      ================================================================ */
   function initRegister() {
       document.getElementById('btn_login').addEventListener('click', () => {
           const account = document.getElementById('input_account').value.trim();
           const code = document.getElementById('input_code').value.trim();
           if (!account || !code) {
               alert('请输入账号和验证码');
               return;
           }
           alert('注册功能待接入（演示）');
       });
   }
   
   /* ================================================================
      微信注册（占位）
      ================================================================ */
   function initWechat() {
       document.getElementById('btn_wechat').addEventListener('click', () => {
           alert('微信注册待接入（演示）');
       });
   }
   
   /* ================================================================
      激活码入口
      ================================================================ */
   function initActivationEntry() {
       document.getElementById('btn_activation').addEventListener('click', () => {
           showLayer('activation_layer');
           const msg = document.getElementById('activation_status');
           if (msg) {
               msg.classList.remove('show', 'success', 'error');
               msg.innerText = '';
           }
           document.getElementById('input_activation_code').value = '';
           document.getElementById('input_activation_name').value = '';
       });
   }
   
   /* ================================================================
      激活码校验 + 落库
      ================================================================ */
   function initActivationPage() {
       const inputCode = document.getElementById('input_activation_code');
       const inputName = document.getElementById('input_activation_name');
       const confirmBtn = document.getElementById('btn_activation_confirm');
       const backBtn = document.getElementById('btn_activation_back');
       const statusMsg = document.getElementById('activation_status');
   
       function showStatus(text, type) {
           statusMsg.innerText = text;
           statusMsg.classList.remove('success', 'error');
           statusMsg.classList.add('show', type);
       }
   
       confirmBtn.addEventListener('click', async () => {
           const t = TEXT[window.mQxb.Language];
           const code = inputCode.value.trim();
           const name = inputName.value.trim();
   
           if (!code) {
               showStatus(t.alertActivationEmpty, 'error');
               return;
           }
           if (!name) {
               showStatus(t.alertActivationNameEmpty, 'error');
               return;
           }
   
           confirmBtn.disabled = true;
           confirmBtn.innerText = t.checking;
           showStatus(t.checking, 'success');
   
           try {
               const codeResp = await fetch(
                   `${SUPABASE_URL}/rest/v1/emobao_redemptioncode?code=eq.${encodeURIComponent(code)}&select=*`,
                   {
                       headers: {
                           'apikey': SUPABASE_KEY,
                           'Authorization': `Bearer ${SUPABASE_KEY}`
                       }
                   }
               );
               const codeArr = await codeResp.json();
   
               if (!codeArr || codeArr.length === 0) {
                   showStatus(t.activationInvalid, 'error');
                   confirmBtn.disabled = false;
                   confirmBtn.innerText = t.confirm;
                   return;
               }
   
               const codeData = codeArr[0];
   
               const rpcResp = await fetch(
                   `${SUPABASE_URL}/rest/v1/rpc/emobao_activate_code`,
                   {
                       method: 'POST',
                       headers: {
                           'apikey': SUPABASE_KEY,
                           'Authorization': `Bearer ${SUPABASE_KEY}`,
                           'Content-Type': 'application/json'
                       },
                       body: JSON.stringify({
                           p_code: code,
                           p_username: name,
                           p_validays: codeData.validays
                       })
                   }
               );
               const rpcArr = await rpcResp.json();
               const r = rpcArr[0];
   
               if (!r || !r.success) {
                   if (r && r.message === 'CODE_EXHAUSTED') {
                       showStatus(t.activationExhausted, 'error');
                   } else if (r && r.message === 'CODE_NOT_FOUND') {
                       showStatus(t.activationInvalid, 'error');
                   } else if (r && r.message === 'USERNAME_TAKEN') {
                       showStatus(t.usernameTaken, 'error');
                   } else {
                       showStatus(t.networkError, 'error');
                   }
                   confirmBtn.disabled = false;
                   confirmBtn.innerText = t.confirm;
                   return;
               }
   
               const usertype = parseInt(r.usertypekey);
               const isTeam = (codeData.maxactivations > 1);
   
               _pendingUser = {
                   user_id: r.new_userid,
                   user_id_Type: usertype,
                   Username: r.final_username,
                   UserImage: getUserImage(usertype),
                   ExpiryDate: calculateExpiryByDays(new Date(), codeData.validays),
                   IsTeamLeader: r.is_leader,
                   TeamCode: isTeam ? code : null,
               };
   
               showStatus(t.activationSuccess, 'success');
   
               document.getElementById('input_new_password').value = '';
               document.getElementById('pwd_strength_fill').style.width = '0%';
               document.getElementById('pwd_strength_text').innerText = '';
               document.getElementById('btn_password_confirm').disabled = true;
   
               setTimeout(() => {
                   showLayer('password_layer');
                   applyLanguage();
               }, 1000);
   
           } catch (err) {
               console.error('激活失败:', err);
               showStatus(TEXT[window.mQxb.Language].networkError, 'error');
               confirmBtn.disabled = false;
               confirmBtn.innerText = t.confirm;
           }
       });
   
       backBtn.addEventListener('click', () => {
           showLayer('login_layer');
       });
   }
   
   /* ================================================================
      到期日计算
      ================================================================ */
   function calculateExpiryByDays(startDate, days) {
       const d = new Date(startDate);
       d.setDate(d.getDate() + (days || 30));
       return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
   }
   
   /* ================================================================
      访客流程
      ================================================================ */
   function initGuest() {
       document.getElementById('btn_guest').addEventListener('click', () => {
           const lastName = localStorage.getItem('emobao_guest_name') || '';
           document.getElementById('input_guest_name').value = lastName;
           showLayer('guest_layer');
       });
   
       document.getElementById('btn_guest_confirm').addEventListener('click', () => {
           const name = document.getElementById('input_guest_name').value.trim();
           if (!name) {
               alert(TEXT[window.mQxb.Language].alertGuestName);
               return;
           }
   
           localStorage.setItem('emobao_guest_name', name);
   
           const now = new Date();
           const dateStr = now.getFullYear() +
               String(now.getMonth() + 1).padStart(2, '0') +
               String(now.getDate()).padStart(2, '0');
           const timeStr = String(now.getHours()).padStart(2, '0') +
               String(now.getMinutes()).padStart(2, '0') +
               String(now.getSeconds()).padStart(2, '0');
           const rand4 = Math.random().toString(36).substring(2, 6);
   
           window.mQxb.user_id = `guest-${dateStr}-${timeStr}-${rand4}`;
           window.mQxb.user_id_Type = 14;
           window.mQxb.Username = name;
           window.mQxb.UserImage = 'qxbaouser1.jpg';
           window.mQxb.IsGuest = true;
           window.mQxb.ExpiryDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
           window.mQxb.IsTeamLeader = false;
           window.mQxb.TeamCode = null;
   
           saveMqxb();
   
           window.location.href = 'index.html';
       });
   
       document.getElementById('btn_guest_back').addEventListener('click', () => {
           showLayer('login_layer');
       });
   }
   
   /* ================================================================
      URL reason 处理
      ================================================================ */
   function handleUrlReason() {
       const params = new URLSearchParams(window.location.search);
       const reason = params.get('reason');
       if (!reason) return;
   
       const t = TEXT[window.mQxb.Language] || TEXT[1];
   
       if (reason === 'expired') {
           showToast(t.sessionExpired, 'warning', 4000);
       }
   
       history.replaceState(null, '', window.location.pathname);
   }
   
   /* ================================================================
      检查 mQxb 是否有效，有效直接进主屏
      ================================================================ */
   function checkMqxbAndRedirect() {
       const saved = localStorage.getItem('mQxb');
       if (!saved) return false;
   
       try {
           const data = JSON.parse(saved);
           if (data.user_id && data.user_id_Type && data.ExpiryDate) {
               const today = new Date();
               today.setHours(0, 0, 0, 0);
               const expiry = new Date(data.ExpiryDate + 'T00:00:00');
               if (expiry >= today) {
                   window.location.href = 'index.html';
                   return true;
               }
           }
       } catch (e) {
           // 解析失败，忽略
       }
       return false;
   }
   
   /* ================================================================
      入口
      ================================================================ */
   document.addEventListener('DOMContentLoaded', () => {
       console.log('qx00_login.js 已加载');
   
       if (checkMqxbAndRedirect()) return;
   
       const agreed = localStorage.getItem('emobao_agreed');
       if (agreed === 'true') {
           showLayer('login_layer');
       } else {
           showLayer('welcome_layer');
       }
   
       const savedLang = localStorage.getItem('emobao_lang');
       window.mQxb.Language = savedLang ? parseInt(savedLang) : 1;
   
       applyLanguage();
       initLangSwitch();
       initWelcome();
       initAuthTabs();
       initLoginForm();
       initPasswordPage();
       initPasswordEyes();
       initGetCode();
       initRegister();
       initWechat();
       initActivationEntry();
       initActivationPage();
       initGuest();
   
       handleUrlReason();
   });