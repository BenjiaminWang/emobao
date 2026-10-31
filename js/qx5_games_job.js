/* ================================================================
   情绪宝 - qx5 应聘挑战（P0：凌晨超售）
   v5：沉浸式场景背景 + 玻璃拟态UI + 智能语音分配 + 降门槛
   ================================================================ */
   (function () {
    'use strict';
    if (!window.qx5Engine) { console.error('[qx5_games_job] 缺少 qx5Engine'); return; }
    
    const SCENARIO = window.QX5_SCENARIOS && window.QX5_SCENARIOS[0];
    if (!SCENARIO) { console.error('[qx5_games_job] 缺少 scenarios 数据'); return; }
  
    const E = window.qx5Engine;
  
    // ================= 图片资源（请确保 picture 文件夹里有这两张图） =================
    const IMG_INTERVIEW = 'picture/hotel_lobby.jpg'; // 第一张：深色前台
    const IMG_RESULT = 'picture/hotel_result.jpg';   // 第二张：白墙冷静
  
    // ================= 核心：角色音色引擎 v2 =================
    const VOICE_CONFIGS = {
      narrator:    { rate: 1.0, pitch: 1.0, preferGender: 'female' },
      lin_manager: { rate: 0.95, pitch: 0.85, preferGender: 'female' },
      xiaozhou:    { rate: 1.3, pitch: 1.5, preferGender: 'male' },
      laok:        { rate: 0.8, pitch: 1.2, preferGender: 'male' },
      wangjie:     { rate: 0.9, pitch: 1.1, preferGender: 'female' },
      competitor:  { rate: 1.0, pitch: 1.0, preferGender: 'male' }
    };
  
    function speakRole(roleId, text) {
      if (!window.speechSynthesis || !text) return;
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        const cfg = VOICE_CONFIGS[roleId] || VOICE_CONFIGS.narrator;
        u.rate = cfg.rate;
        u.pitch = cfg.pitch;
  
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;
        const zhVoices = voices.filter(v => v.lang.includes('zh') || v.lang.includes('CN'));
        
        if (zhVoices.length > 0) {
          if (cfg.preferGender === 'female') {
            selectedVoice = zhVoices.find(v => v.name.includes('女') || v.name.includes('Xiaoxiao') || v.name.includes('Yaoyao')) || zhVoices[0];
          } else if (cfg.preferGender === 'male') {
            selectedVoice = zhVoices.find(v => v.name.includes('男') || v.name.includes('Yunxi') || v.name.includes('Kangkang')) || zhVoices[0];
          }
        }
        if (selectedVoice) u.voice = selectedVoice;
  
        window.speechSynthesis.speak(u);
      } catch (e) { console.warn('语音播报失败', e); }
    }
    
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    
    function normalizeScores(userText, evaluate) {
      const out = {};
      for (const [dim, cfg] of Object.entries(evaluate)) {
        const hits = (cfg.keywords || []).filter(k => userText.includes(k)).length;
        // 只要有命中，直接给 85 分起步，确保玩家能过关
        out[dim] = hits > 0 ? Math.min(85 + hits * 5, 100) : 0; 
      }
      return out;
    }
    function avg(obj) {
      const v = Object.values(obj);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
    }
  
    E.registerGame({
      id: 'job_hotel_front_desk',
      collectionId: 'emotion',
      isFeatured: true,
      title:    { cn: '应聘挑战', en: 'Job Challenge' },
      subtitle: { cn: SCENARIO.intro || '你能稳住局面吗？', en: 'Can you stay in control?' },
  
      generateTrials: function () { return [{ id: 'run_1', condition: 'interview', stimulus: {} }]; },
  
      renderTrial: function (hostEl, trial, onAnswer, meta) {
        hostEl.innerHTML = '';
  
        // ====== 场景背景层 ======
        const stage = document.createElement('div');
        stage.style.cssText = `
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 16px;
          min-height: 100vh;
          box-sizing: border-box;
          background-image: url('${IMG_INTERVIEW}');
          background-size: cover;
          background-position: center;
          font-family: inherit;
        `;
        
        // 暗色遮罩：保证文字清晰，增加沉浸感
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: absolute; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.55); z-index: 1;';
        stage.appendChild(overlay);
  
        // 交互内容层
        const content = document.createElement('div');
        content.style.cssText = 'position: relative; z-index: 2; display: flex; flex-direction: column; gap: 12px; flex: 1;';
        stage.appendChild(content);
        hostEl.appendChild(stage);
  
        // ====== 顶部 HUD ======
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;font-size:14px;color:#fff;font-weight:bold;text-shadow: 0 1px 2px rgba(0,0,0,0.8);';
        top.innerHTML = `<span>🏨 ${SCENARIO.name}</span><span id="qx5_job_progress">第 1 / ${SCENARIO.rounds.length} 轮</span>`;
        content.appendChild(top);
        const progressEl = top.querySelector('#qx5_job_progress');
  
        // 场景介绍气泡
        const intro = document.createElement('div');
        intro.style.cssText = 'font-size:13px;color:#fff;line-height:1.6;background:rgba(255,255,255,0.15);backdrop-filter: blur(8px);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px 12px;';
        intro.textContent = SCENARIO.intro;
        content.appendChild(intro);
  
        // 对话框容器（自适应高度，超出滚动）
        const dialog = document.createElement('div');
        dialog.style.cssText = 'display:flex;flex-direction:column;gap:10px;flex:1;overflow-y:auto;padding-right:4px;';
        content.appendChild(dialog);
  
        // 底部输入区
        const inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:auto;padding-top:10px;';
        content.appendChild(inputWrap);
  
        const ta = document.createElement('textarea');
        ta.placeholder = '听题后点击开始，再输入你的回答……';
        ta.style.cssText = 'width:100%;height:80px;padding:12px;border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.6);color:#fff;border-radius:10px;font-size:14px;box-sizing:border-box;font-family:inherit;resize:none;backdrop-filter: blur(4px);';
        inputWrap.appendChild(ta);
  
        const timerEl = document.createElement('div');
        timerEl.style.cssText = 'font-size:13px;color:#FFD600;font-weight:bold;text-align:center;text-shadow: 0 1px 2px rgba(0,0,0,0.8);';
        inputWrap.appendChild(timerEl);
  
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
        inputWrap.appendChild(btnRow);
  
        // ====== 按钮组 ======
        const startBtn = document.createElement('button');
        startBtn.className = 'qx5-btn qx5-btn-primary';
        startBtn.textContent = '▶ 开始作答（90秒）';
        startBtn.style.cssText = 'flex:1;padding:12px;border:0;border-radius:10px;background:#2ECC71;color:#fff;font-size:15px;cursor:pointer;display:none;box-shadow:0 4px 12px rgba(46,204,113,0.4);';
        
        const submitBtn = document.createElement('button');
        submitBtn.className = 'qx5-btn qx5-btn-primary';
        submitBtn.textContent = '提交回答';
        submitBtn.style.cssText = 'flex:1;padding:12px;border:0;border-radius:10px;background:#2C7BE5;color:#fff;font-size:15px;cursor:pointer;display:none;box-shadow:0 4px 12px rgba(44,123,229,0.4);';
        
        const demoBtn = document.createElement('button');
        demoBtn.className = 'qx5-btn qx5-btn-secondary';
        demoBtn.textContent = '示范';
        demoBtn.style.cssText = 'padding:12px 16px;border:0;border-radius:10px;background:rgba(255,255,255,0.2);color:#fff;font-size:14px;cursor:pointer;backdrop-filter:blur(4px);';
        
        const quitBtn = document.createElement('button');
        quitBtn.className = 'qx5-btn qx5-btn-secondary';
        quitBtn.textContent = '弃权';
        quitBtn.style.cssText = 'padding:12px 16px;border:0;border-radius:10px;background:rgba(231,76,60,0.3);color:#fff;font-size:14px;cursor:pointer;backdrop-filter:blur(4px);';
        
        btnRow.appendChild(startBtn);
        btnRow.appendChild(submitBtn);
        btnRow.appendChild(demoBtn);
        btnRow.appendChild(quitBtn);
  
        // ====== 状态 ======
        let roundIdx = 0;
        const mainScores = [];
        const interruptScores = [];
        let competitorScore = 0;
        let anyAnswer = false;
        let finished = false;
        
        let timerId = null;
        let currentRound = null;
        let competitorDone = false;
        let usedInterruptIds = [];
        let pendingInterruptImpact = null;
  
        // ====== 气泡渲染 ======
        function addBubble(role, speaker, text) {
          const isPlayer = role === 'player';
          const wrap = document.createElement('div');
          wrap.style.cssText = `display:flex; flex-direction:column; gap:4px; align-items: ${isPlayer ? 'flex-end' : 'flex-start'};`;
          
          const name = document.createElement('div');
          name.textContent = speaker;
          name.style.cssText = 'font-size:12px; font-weight:bold; color: rgba(255,255,255,0.8); margin: 0 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);';
          
          const bubble = document.createElement('div');
          bubble.textContent = text;
          
          let bg = 'rgba(255,255,255,0.95)';
          let color = '#333';
          if (role === 'npc') {
             bg = 'rgba(238,243,247,0.95)'; color = '#1A2B4A';
          } else if (role === 'interrupt') {
             bg = 'rgba(255,243,224,0.95)'; color = '#C77A1E';
          } else if (role === 'competitor') {
             bg = 'rgba(240,240,240,0.9)'; color = '#555';
          }
          
          bubble.style.cssText = `
            font-size:15px; line-height:1.6; padding:12px 16px; 
            border-radius: ${isPlayer ? '16px 16px 0 16px' : '16px 16px 16px 0'}; 
            background: ${bg}; color: ${color}; 
            max-width: 88%; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            backdrop-filter: blur(8px);
          `;
          
          wrap.appendChild(name);
          wrap.appendChild(bubble);
          dialog.appendChild(wrap);
          dialog.scrollTop = dialog.scrollHeight;
        }
  
        function decideInterrupter(round) {
          const ir = round.interrupter;
          if (!ir) return null;
          if (ir.trigger === 'fixed') return ir;
          if (ir.trigger === 'random') return pick(ir.options);
          if (ir.trigger === 'if_none_yet') {
            if (usedInterruptIds.length > 0) return null;
            const pool = [
              { id: 'laok', line: '如果是我，我会先调监控确认超售原因，再谈补偿。', tone: '沉稳', impact: '借力' },
              { id: 'wangjie', line: '现在的年轻人啊～遇到点事就慌。', tone: '嘲讽', impact: '自嘲' }
            ].filter(x => !usedInterruptIds.includes(x.id));
            return pool.length ? pick(pool) : null;
          }
          return null;
        }
  
        function triggerCompetitor(round) {
          if (competitorDone || finished) return;
          competitorDone = true;
          const ans = pick(round.competitorAnswers);
          addBubble('competitor', '隔壁候选人（抢答）', ans);
          speakRole('competitor', ans);
          timerEl.textContent = '竞争者已抢答，你仍可回答（答得好可翻盘）';
          
          const rule = SCENARIO.judgeRule || { competitorBase: 55, competitorCap: 65 };
          competitorScore = Math.max(45, Math.min(rule.competitorCap, rule.competitorBase + Math.round((Math.random() * 20 - 10))));
        }
  
        function startTimer(sec) {
          clearInterval(timerId);
          let left = sec;
          timerEl.textContent = `⏱ 剩余 ${left} 秒（超时将触发竞争者抢答）`;
          timerId = setInterval(() => {
            left--;
            timerEl.textContent = `⏱ 剩余 ${left} 秒`;
            if (left <= 0) {
              clearInterval(timerId);
              triggerCompetitor(currentRound);
            }
          }, 1000);
        }
  
        function runRound() {
          if (finished) return;
          if (roundIdx >= SCENARIO.rounds.length) { finishAll(); return; }
  
          currentRound = SCENARIO.rounds[roundIdx];
          competitorDone = false;
          pendingInterruptImpact = null;
          progressEl.textContent = `第 ${roundIdx + 1} / ${SCENARIO.rounds.length} 轮`;
          
          ta.value = '';
          ta.disabled = true;
          submitBtn.style.display = 'none';
          startBtn.style.display = 'block';
          timerEl.textContent = '';
  
          const q = pick(currentRound.npcLineVariants);
          addBubble('npc', '面试官 · 林经理', q);
          speakRole('lin_manager', q);
  
          const ir = decideInterrupter(currentRound);
          if (ir) {
            usedInterruptIds.push(ir.id);
            pendingInterruptImpact = ir.impact;
            setTimeout(() => {
              const speakerName = ir.id === 'xiaozhou' ? '傻助理 小周' : ir.id === 'laok' ? '总部观察员 老K' : '隔壁部门 王姐';
              addBubble('interrupt', speakerName, ir.line);
              speakRole(ir.id, ir.line);
            }, 1500);
          }
        }
  
        startBtn.onclick = function() {
          startBtn.style.display = 'none';
          submitBtn.style.display = 'block';
          ta.disabled = false;
          ta.focus();
          startTimer(90); 
        };
  
        function submitRound() {
          if (finished) return;
          const text = ta.value.trim();
          if (!text) { alert('请先输入你的回答'); return; }
  
          clearInterval(timerId);
          anyAnswer = true;
          
          addBubble('player', '你的回答', text); // 增加玩家回答回显
  
          const dimScores = normalizeScores(text, currentRound.evaluate);
          const mainAvg = avg(dimScores);
          mainScores.push(mainAvg);
  
          if (pendingInterruptImpact) {
            const map = { '化解': 'empathy', '借力': 'action', '自嘲': 'empathy' };
            const key = map[pendingInterruptImpact] || 'empathy';
            interruptScores.push(dimScores[key] != null ? dimScores[key] : 0);
          }
  
          roundIdx++;
          if (roundIdx >= SCENARIO.rounds.length) {
            finishAll();
          } else {
            runRound();
          }
        }
  
        function finishAll() {
          if (finished) return;
          finished = true;
          clearInterval(timerId);
  
          const main = mainScores.length ? Math.round(mainScores.reduce((a, b) => a + b, 0) / mainScores.length) : 0;
          const intr = interruptScores.length ? Math.round(interruptScores.reduce((a, b) => a + b, 0) / interruptScores.length) : 0;
  
          let pass = false;
          let announce = '';
          const rule = SCENARIO.judgeRule;
  
          if (!anyAnswer) {
            pass = false;
            announce = competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll;
          } else {
            pass = main >= 50 && intr >= 40 && main > competitorScore;
            announce = pass ? SCENARIO.judgeAnnounce.pass
              : (competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll);
          }
  
          addBubble('npc', '面试官 · 林经理', announce);
          speakRole('lin_manager', announce);
          submitBtn.disabled = true;
          demoBtn.disabled = true;
  
          setTimeout(() => {
            onAnswer(JSON.stringify({
              main: main, interrupt: intr, competitor: competitorScore,
              pass: pass, announce: announce, rounds: roundIdx
            }), pass);
          }, 2500);
        }
  
        quitBtn.onclick = function () {
          if (!confirm('确定退出吗？中途退出视为弃权。')) return;
          finished = true;
          clearInterval(timerId);
          onAnswer(JSON.stringify({ main: 0, interrupt: 0, competitor: competitorScore, pass: false, announce: '你提前离开了面试。', quit: true }), false);
        };
  
        demoBtn.onclick = function () {
          if (!currentRound) return;
          addBubble('npc', '（示范回答）', currentRound.demoAnswer);
          speakRole('lin_manager', currentRound.demoAnswer);
        };
  
        submitBtn.onclick = submitRound;
        runRound();
      },
  
      computeScore: function (data) {
        const rec = data.records[0];
        let info = {};
        try { info = JSON.parse(rec.response); } catch (e) {}
        return {
          accuracy: 1, correctCount: 1, totalCount: 1,
          mainScore: info.main || 0, interruptScore: info.interrupt || 0,
          competitorScore: info.competitor || 0, pass: !!info.pass,
          announce: info.announce || '', quit: !!info.quit, rounds: info.rounds || 0
        };
      },
  
      renderResult: function (hostEl, data) {
        const s = data.score;
        hostEl.innerHTML = '';
        
        // ====== 结果页也加背景！ ======
        const wrap = document.createElement('div');
        wrap.className = 'qx5-result';
        wrap.style.cssText = `
          min-height: 100vh;
          background-image: url('${IMG_RESULT}');
          background-size: cover;
          background-position: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
          position: relative;
        `;
        
        // 结果页的暗色遮罩，让结果看得清
        const resOverlay = document.createElement('div');
        resOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:0;';
        wrap.appendChild(resOverlay);
  
        const card = document.createElement('div');
        card.style.cssText = 'position:relative; z-index:1; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-radius:20px; padding:30px 20px; width:100%; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.3); text-align:center;';
        
        let noteHtml = '';
        if (s.mainScore === 0 && !s.quit) {
          noteHtml = `<div class="qx5-result-note" style="color:#E74C3C;margin-top:12px;">你一言未发，遗憾离场。</div>`;
        } else if (s.quit) {
          noteHtml = `<div class="qx5-result-note" style="color:#E67E22;margin-top:12px;">中途弃权。</div>`;
        }
  
        card.innerHTML = `
          <div style="font-size:18px;color:#64748B;margin-bottom:10px;">${E.t('应聘挑战 · 结果', 'Result')}</div>
          <div style="font-size:40px;font-weight:900;margin-bottom:10px;color:${s.pass ? '#2ECC71' : '#E74C3C'}">${s.pass ? E.t('通过', 'Pass') : E.t('未通过', 'Fail')}</div>
          <div style="font-size:16px;color:#1E293B;margin-bottom:20px;font-weight:bold;">${s.announce || ''}</div>
          
          <div style="text-align:left;background:#F8FAFC;border-radius:10px;padding:15px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#475569;"><span>主评分</span><b>${s.mainScore}</b></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#475569;"><span>干扰评分</span><b>${s.interruptScore}</b></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;color:#475569;"><span>竞争者评分</span><b>${s.competitorScore}</b></div>
          </div>
          ${noteHtml}
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart" style="flex:1;padding:12px;background:#2C7BE5;color:#fff;border:none;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer;">再刷一局</button>
            <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit" style="flex:1;padding:12px;background:#F1F5F9;color:#475569;border:none;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer;">返回大厅</button>
          </div>
        `;
        
        wrap.appendChild(card);
        hostEl.appendChild(wrap);
        
        hostEl.querySelector('#qx5_result_restart').onclick = () => {
          if (window.speechSynthesis) window.speechSynthesis.cancel();
          E.restart();
        };
        hostEl.querySelector('#qx5_result_exit').onclick = () => {
          if (window.speechSynthesis) window.speechSynthesis.cancel();
          E.exit();
        };
      }
    });
  
  })();