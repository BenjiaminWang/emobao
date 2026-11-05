/* ================================================================
   情绪宝 - qx0 主屏框架
   v21 改动（2026-10-19）：
   - 去除大色块，改为极简透明图标
   - 有声：深绿色喇叭；静音：浅灰色捂嘴
   ================================================================ */

   const MQXB_VERSION = 1;
   const EXPIRY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
   const SUPABASE_URL = 'https://lmmnwmueppkdbzvufxar.supabase.co'; 
   const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';
   
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
   
   const I18N = {
       1: {
           brand: '情绪宝 / Emo Treasure',
           menu_perceive: '感知', menu_regulate: '调节', menu_report: '报告', menu_qa: '问答', menu_assessment: '测评', menu_settings: '设置',
           title_main: '情绪宝 / Emo Treasure', title_qx1: '情绪感知', title_qx2: '情绪调节', title_qx3: '报告分析', title_qx4: '智能问答', title_qx5: '趣味评测', title_qx6: '设置工作',
           back: '← 返回主屏', placeholder_qx1: '情绪感知功能开发中...', placeholder_qx2: '情绪调节功能开发中...', placeholder_qx3: '报告分析功能开发中...', placeholder_qx4: '智能问答功能开发中...', placeholder_qx5: '趣味评测功能开发中...', placeholder_qx6: '设置功能开发中...',
           week: ['日', '一', '二', '三', '四', '五', '六'], userPrefix: '👤',
   
           emo_1: '焦躁', emo_2: '热烈', emo_3: '欢快', emo_4: '轻快', emo_5: '明朗', emo_6: '平静', emo_7: '压抑', emo_8: '忧伤', emo_9: '悲伤',
   
           qx1_today_emotion: '今日情绪', qx1_life_event: '生活事件', qx1_heart_title: '点击查看 HRV 图', qx1_optional_events: '可选生活事件', qx1_today_events: '当日生活事件', qx1_event_attr: '事件属性',
           qx1_nature_good: '好', qx1_nature_bad: '坏', qx1_nature_suffix: '事', qx1_impact_title: '影响程度', qx1_impact_1: '轻', qx1_impact_2: '中', qx1_impact_3: '重', qx1_impact_4: '极重',
           qx1_hrv_title: '心率与 HRV 采集', qx1_btn_save: '存入', qx1_btn_del: '删除当前此生活事件', qx1_btn_exit: '退出', qx1_heal_title: '情绪宝 HRV 采集 · 实时治愈主图', qx1_heal_close: '关闭', qx1_heal_wait: '等待采集开始…', qx1_heal_wait_hint: '等待采集开始…',
   
           qx2_before_label: '听前情绪', qx2_after_label: '听后情绪', qx2_flow_1: '听前', qx2_flow_2: '调整', qx2_flow_3: '评价', qx2_flow_4: '分析',
           qx2_camera_hint: '请把干净的手指放在摄像头上，准备安静地听音乐', qx2_btn_pick: '选曲', qx2_btn_start: '开始',
           qx2_analysis_title: '分析', qx2_analysis_ph: '进第 4 步，自动给出分析', qx2_heal_title: '实时治愈主图', qx2_heal_ph: '待定', qx2_feedback_title: '主观评价',
           qx2_fb_better: '更好', qx2_fb_same: '一样', qx2_fb_worse: '更差', qx2_btn_restart: '重新调整', qx2_btn_exit: '退出调整', qx2_collect_title: '选择经典作品', qx2_collect_close: '关闭',
   
           qx3_title: '情绪分析报告', qx3_range_week: '近一周', qx3_range_month: '近一月', qx3_range_half: '近半年', qx3_range_year: '近一年', qx3_emotion_card: '情绪基线', qx3_event_card: '生活事件综合', qx3_hrv_card: 'HRV 基线', qx3_summary_card: '总评语', qx3_baseline: '基线', qx3_good: '好事', qx3_bad: '坏事', qx3_avg_hr: '平均心率', qx3_summary_ph: '正在生成…', qx3_btn_exit: '退出',
   
           qx4_title: '知识问答', qx4_btn_pick: '选择', qx4_btn_exit: '退出',
   
           qx5_title: '趣味评测', qx5_subtitle: '玩一玩，看看你的大脑怎么工作', qx5_btn_exit: '退出', qx5_btn_quit: '退出游戏', qx5_profile_title: '我的认知画像',
   
           qx6_back_main: '‹ 主屏', qx6_title: '设置', qx6_panel_back: '‹ 返回',
       },
       2: {
           brand: 'Emo Treasure / 情绪宝',
           menu_perceive: 'Perceive', menu_regulate: 'Regulate', menu_report: 'Report', menu_qa: 'Q&A', menu_assessment: 'Assessment', menu_settings: 'Settings',
           title_main: 'Emo Treasure / 情绪宝', title_qx1: 'Emotion Perceive', title_qx2: 'Emotion Regulate', title_qx3: 'Report Analysis', title_qx4: 'Smart Q&A', title_qx5: 'Fun Assessment', title_qx6: 'Settings',
           back: '← Back', placeholder_qx1: 'Emotion Perceive - Coming soon...', placeholder_qx2: 'Emotion Regulate - Coming soon...', placeholder_qx3: 'Report Analysis - Coming soon...', placeholder_qx4: 'Smart Q&A - Coming soon...', placeholder_qx5: 'Fun Assessment - Coming soon...', placeholder_qx6: 'Settings - Coming soon...',
           week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], userPrefix: '👤',
   
           emo_1: 'Irritable', emo_2: 'Passionate', emo_3: 'Cheerful', emo_4: 'Lively', emo_5: 'Bright', emo_6: 'Calm', emo_7: 'Down', emo_8: 'Melancholy', emo_9: 'Sad',
   
           qx1_today_emotion: 'Today', qx1_life_event: 'Events', qx1_heart_title: 'Tap to view HRV chart', qx1_optional_events: 'Event Library', qx1_today_events: "Today's Events", qx1_event_attr: 'Details',
           qx1_nature_good: 'Good', qx1_nature_bad: 'Bad', qx1_nature_suffix: '', qx1_impact_title: 'Impact', qx1_impact_1: 'Mild', qx1_impact_2: 'Moderate', qx1_impact_3: 'Strong', qx1_impact_4: 'Severe',
           qx1_hrv_title: 'Heart Rate & HRV', qx1_btn_save: 'Save', qx1_btn_del: 'Delete', qx1_btn_exit: 'Exit', qx1_heal_title: 'HRV Capture · Live Chart', qx1_heal_close: 'Close', qx1_heal_wait: 'Waiting to start…', qx1_heal_wait_hint: 'Waiting to start…',
   
           qx2_before_label: 'Bf', qx2_after_label: 'Af', qx2_flow_1: 'B4', qx2_flow_2: 'Set', qx2_flow_3: 'Rate', qx2_flow_4: 'Read',
           qx2_camera_hint: 'Place a clean finger on the camera and listen quietly', qx2_btn_pick: 'Select', qx2_btn_start: 'Start',
           qx2_analysis_title: 'Analysis', qx2_analysis_ph: 'Analysis appears at step 4', qx2_heal_title: 'Live Healing Chart', qx2_heal_ph: 'Pending', qx2_feedback_title: 'Feedback', qx2_fb_better: 'Better', qx2_fb_same: 'Same', qx2_fb_worse: 'Worse',
           qx2_btn_restart: 'Restart', qx2_btn_collect: 'Save Playlist', qx2_btn_exit: 'Exit', qx2_collect_title: 'Classic Works', qx2_collect_close: 'Close',
   
           qx3_title: 'Emotion Report', qx3_range_week: 'Week', qx3_range_month: 'Month', qx3_range_half: '6 Months', qx3_range_year: 'Year', qx3_emotion_card: 'Emotion Baseline', qx3_event_card: 'Life Events', qx3_hrv_card: 'HRV Baseline', qx3_summary_card: 'Summary', qx3_baseline: 'Baseline', qx3_good: 'Positive', qx3_bad: 'Negative', qx3_avg_hr: 'Avg HR', qx3_summary_ph: 'Generating…', qx3_btn_exit: 'Exit',
   
           qx4_title: 'Q&A', qx4_btn_pick: 'Select', qx4_btn_exit: 'Exit',
   
           qx5_title: 'Fun Assessment', qx5_subtitle: 'Play and see how your brain works', qx5_btn_exit: 'Exit', qx5_btn_quit: 'Quit Game', qx5_profile_title: 'My Cognitive Profile',
   
           qx6_back_main: '‹ Main', qx6_title: 'Settings', qx6_panel_back: '‹ Back',
       }
   };
   
   /* ================================================================
   全局语音合成引擎 (V2 - 接入微软 Azure 神经语音)
   ================================================================ */
let _globalSpeechLock = false;
window.qxIsMuted = false;
let _currentTTSAudio = null; // 用于保存当前正在播放的云端音频，方便随时掐断

window.qxSpeak = function(text, onEnd) {
    // 1. 兜底检查：如果处于静音状态，直接跳过并触发回调
    if (window.qxIsMuted) { if (onEnd) onEnd(); return; }
    if (_globalSpeechLock && !onEnd) { return; }

    // 2. 停止上一次可能还在播的语音，解除锁定
    if (_currentTTSAudio) {
        _currentTTSAudio.pause();
        _currentTTSAudio = null;
    }
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel(); // 同时掐断浏览器自带的语音
    }
    _globalSpeechLock = true;

    // 3. 读取当前语言（1=中文，2=英文）和用户在设置里选的音色
    const lang = (window.mQxb && window.mQxb.Language) || 1;
    const isZh = (lang === 1);
    
    // 默认音色：中文用“云希”，英文用“Aria”（微软英语女声，非常自然）
    let defaultVoice = isZh ? 'zh-CN-YunxiNeural' : 'en-US-AriaNeural';
    const userVoice = localStorage.getItem('qx_tts_voice') || defaultVoice;

    // 4. 向 Supabase 代理发送请求，获取音频流
    fetch('https://lmmnwmueppkdbzvufxar.supabase.co/functions/v1/azure-tts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: text, voice: userVoice })
    })
    .then(res => {
        if (!res.ok) throw new Error('TTS API 请求失败');
        return res.blob();
    })
    .then(blob => {
        // 5. 拿到音频流，直接播放
        const audioUrl = URL.createObjectURL(blob);
        _currentTTSAudio = new Audio(audioUrl);

        // 6. 语音自然结束，释放锁并触发回调（这是驱动音乐播放的“发令枪”）
        _currentTTSAudio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            _currentTTSAudio = null;
            _globalSpeechLock = false;
            if (onEnd) onEnd();
        };

        // 7. 播放（如果浏览器拦截了自动播放，静默失败）
        _currentTTSAudio.play().catch(e => {
            console.warn('[qxSpeak] 播放被拦截或失败', e);
            _globalSpeechLock = false; 
            if (onEnd) onEnd();
        });
    })
    .catch(err => {
        console.warn('[qxSpeak] 云端请求失败，自动回退到本地语音', err);
        // 8. 兜底机制：如果网络断了，自动用回你之前的浏览器本地语音，保证不断播
        fallbackToBrowserTTS(text, onEnd);
    });
};

// 兜底方案：利用你原有的浏览器本地 TTS 逻辑
function fallbackToBrowserTTS(text, onEnd) {
    if (!window.speechSynthesis) { if (onEnd) onEnd(); return; }
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = (window.mQxb && window.mQxb.Language) || 1;
    utterance.lang = (lang === 1) ? 'zh-CN' : 'en-US';
    utterance.rate = 0.9;

    utterance.onend = () => { _globalSpeechLock = false; if (onEnd) onEnd(); };
    utterance.onerror = () => { _globalSpeechLock = false; if (onEnd) onEnd(); };
    
    window.speechSynthesis.speak(utterance);
}
   
   // ============ 极简素雅版静音按钮 ============
   function initMuteButton() {
       const btn = document.getElementById('global_mute_btn');
       if (!btn) return;
   
       // 彻底清除行内难看的大色块样式，改为极简透明悬浮
       btn.style.cssText = 'margin-left: auto; margin-right: 12px; border: none; background: transparent; font-size: 20px; cursor: pointer; padding: 4px 8px; transition: opacity 0.2s ease; display: flex; align-items: center; justify-content: center; outline: none;';
   
       const updateMuteUI = () => {
           if (window.qxIsMuted) {
               // 静音：灰色、微小的透明度，提示状态不对
               btn.innerHTML = '🤫';
               btn.style.opacity = '0.4';
               btn.title = '已静音，点击恢复语音';
           } else {
               // 有声：正常深色/绿色
               btn.innerHTML = '🔊';
               btn.style.opacity = '1';
               btn.title = '正在语音播报，点击静音';
           }
       };
   
       updateMuteUI();
       
       btn.onclick = (e) => {
           e.stopPropagation();
           window.qxIsMuted = !window.qxIsMuted;
           updateMuteUI();
           if (window.qxIsMuted && window.speechSynthesis) {
               window.speechSynthesis.cancel();
           }
       };
   
       window.qxUpdateMuteLang = updateMuteUI;
   }
   
   // ... 剩下的基础框架代码保持不变 ...
   
   function clearMqxbAndGoLogin(reason) {
       localStorage.removeItem('mQxb');
       const url = reason ? `qx00_login.html?reason=${encodeURIComponent(reason)}` : 'qx00_login.html';
       window.location.href = url;
   }
   
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
   }
   
   async function loadGlobalVars() {
       const saved = localStorage.getItem('mQxb');
       if (!saved) { clearMqxbAndGoLogin(); return false; }
   
       let data;
       try { data = JSON.parse(saved); } catch (e) { clearMqxbAndGoLogin(); return false; }
   
       if (data._version !== MQXB_VERSION) { clearMqxbAndGoLogin(); return false; }
       if (!data._createdAt || isNaN(Date.parse(data._createdAt))) { clearMqxbAndGoLogin(); return false; }
   
       const required = ['user_id', 'user_id_Type', 'Username', 'UserImage'];
       for (const key of required) {
           if (data[key] === null || data[key] === undefined || data[key] === '') { clearMqxbAndGoLogin(); return false; }
       }
   
       await ensureTypeDictLoaded();
       const ut = parseInt(data.user_id_Type);
       if (!typeHasSafe(ut)) { clearMqxbAndGoLogin(); return false; }
   
       if (!EXPIRY_REGEX.test(data.ExpiryDate)) { clearMqxbAndGoLogin(); return false; }
   
       const today = new Date();
       today.setHours(0, 0, 0, 0);
       const expiry = new Date(data.ExpiryDate + 'T00:00:00');
       if (expiry < today) { clearMqxbAndGoLogin('expired'); return false; }
   
       window.mQxb = Object.assign(window.mQxb || {}, data);
   
       const savedLang = localStorage.getItem('emobao_lang');
       if (savedLang) window.mQxb.Language = parseInt(savedLang);
   
       initSensorPrefs();
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
       if (userEl) userEl.innerText = `${t.userPrefix} ${getUserTypeLabel()} ${window.mQxb.Username || 'User'}`;
   }
   
   function updateMenuBar() {
       const lang = window.mQxb.Language || 1;
       const t = I18N[lang];
       document.querySelectorAll('.qx0-menu-bar .menu-item').forEach(btn => {
           const key = btn.dataset.i18n;
           if (key && t[key]) btn.innerText = t[key];
       });
   }
   
   function applyDataI18n() {
       const lang = window.mQxb.Language || 1;
       const dict = I18N[lang];
       if (!dict) return;
   
       document.querySelectorAll('[data-i18n]').forEach(el => {
           const key = el.dataset.i18n;
           if (!key || dict[key] == null) return;
           const val = dict[key];
   
           if (val === '') {
               el.style.display = 'none';
               return;
           }
           el.style.display = '';
   
           if (el.children.length === 0) {
               el.innerText = val;
               return;
           }
           for (const node of el.childNodes) {
               if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                   node.textContent = val;
                   break;
               }
           }
       });
   
       document.querySelectorAll('[data-i18n-title]').forEach(el => {
           const key = el.dataset.i18nTitle;
           if (!key || dict[key] == null) return;
           el.setAttribute('title', dict[key]);
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

    // 1. 优先：扫码激活带来的品牌底图（云端 URL）
    if (window.mQxb.BrandLogoUrl) {
        bgEl.src = window.mQxb.BrandLogoUrl;
        return;
    }

    // 2. 其次：团队自定义底图
    const teamcode = window.mQxb.TeamCode;
    if (teamcode) {
        const customUrl = await fetchTeamBgUrl(teamcode);
        if (customUrl) { bgEl.src = customUrl; return; }
    }

    // 3. 兜底：身份默认图
    const img = window.mQxb.UserImage || 'qxbaouser1.jpg';
    bgEl.src = `picture/${img}`;
}
   
   async function fetchTeamBgUrl(teamcode) {
       try {
           const res = await fetch(
               `${SUPABASE_URL}/rest/v1/emobao_redemptioncode?code=eq.${encodeURIComponent(teamcode)}&select=custom_bg_url&limit=1`,
               { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
           );
           if (!res.ok) return null;
           const rows = await res.json();
           return (rows && rows[0] && rows[0].custom_bg_url) || null;
       } catch (e) { return null; }
   }
   
   function applyAllI18n() {
       document.body.classList.toggle('lang-en', (window.mQxb.Language || 1) === 2);
       updateStatusBar();
       updateMenuBar();
       updateFunctionTexts();
       applyDataI18n();
       if (window.qxUpdateMuteLang) window.qxUpdateMuteLang();
   }
   
   function initMenuBar() {
       document.querySelectorAll('.qx0-menu-bar .menu-item').forEach(btn => {
           btn.addEventListener('click', () => { enterFunction(btn.dataset.page); });
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
       const ok = await loadGlobalVars();
       if (!ok) return;
   
       applyAllI18n();
       updateBackground();
       initMenuBar();
       initBackButtons();
       initMuteButton(); // 挂载极简按钮
       initRainSleepTrigger(); // 隐藏雨声助眠触发
   });
   
   window.qx0GetTypeMapSafe = getTypeMapSafe;
   window.qx0TypeHasSafe = typeHasSafe;
   window.qx0TypeLabelSafe = typeLabelSafe;
   window.qx0ApplyDataI18n = applyDataI18n;