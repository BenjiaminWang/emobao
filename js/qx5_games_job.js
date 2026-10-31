/* ================================================================
   情绪宝 - qx5 应聘挑战（P0：凌晨超售）
   v3：
   - 独立角色语音引擎（通过 rate/pitch 区分男女老少）
   - 背景介绍、NPC对话、考官宣布全部语音化
   ================================================================ */
   (function () {
    'use strict';
    if (!window.qx5Engine) { console.error('[qx5_games_job] 缺少 qx5Engine'); return; }
    
    const SCENARIO = window.QX5_SCENARIOS && window.QX5_SCENARIOS[0];
    if (!SCENARIO) { console.error('[qx5_games_job] 缺少 scenarios 数据'); return; }
  
    const E = window.qx5Engine;
  
    // ================= 核心：角色音色引擎 =================
    const VOICE_CONFIGS = {
      narrator: { rate: 1.0, pitch: 1.0 },  // 旁白/背景介绍
      lin_manager: { rate: 0.95, pitch: 0.9 }, // 林经理：沉稳，稍低
      xiaozhou: { rate: 1.2, pitch: 1.4 },     // 小周：快、尖（像小孩/愣头青）
      laok: { rate: 0.85, pitch: 1.3 },        // 老K：慢、高（假装专业）
      wangjie: { rate: 0.9, pitch: 1.1 },      // 王姐：阴阳怪气
      competitor: { rate: 1.05, pitch: 1.0 }   // 竞争者：正常
    };
  
    function speakRole(roleId, text) {
      if (!window.speechSynthesis || !text) return;
      try {
        window.speechSynthesis.cancel(); // 打断上一句
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        const cfg = VOICE_CONFIGS[roleId] || VOICE_CONFIGS.narrator;
        u.rate = cfg.rate;
        u.pitch = cfg.pitch;
  
        // 尝试选个女声（如果有的话，通常中文语音包里有）
        const voices = window.speechSynthesis.getVoices();
        const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('CN'));
        if (zhVoice) u.voice = zhVoice;
  
        window.speechSynthesis.speak(u);
      } catch (e) { console.warn('语音播报失败', e); }
    }
    // 兼容一下浏览器的 getVoices 异步加载
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
    // =======================================================
  
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    
    function normalizeScores(userText, evaluate) {
      const out = {};
      for (const [dim, cfg] of Object.entries(evaluate)) {
        const hits = (cfg.keywords || []).filter(k => userText.includes(k)).length;
        const raw = Math.min(hits * cfg.weight, 10);
        out[dim] = Math.round((raw / 10) * 100);
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
  
      generateTrials: function () {
        return [{ id: 'run_1', condition: 'interview', stimulus: {} }];
      },
  
      renderTrial: function (hostEl, trial, onAnswer, meta) {
        hostEl.innerHTML = '';
  
        // ====== 1. 构建 UI 骨架 ======
        const stage = document.createElement('div');
        stage.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:16px;max-width:520px;margin:0 auto;box-sizing:border-box;';
        hostEl.appendChild(stage);
  
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;color:#5A6B87;';
        top.innerHTML = `<span>${SCENARIO.emoji} ${SCENARIO.name}</span><span id="qx5_job_progress">第 1 / ${SCENARIO.rounds.length} 轮</span>`;
        stage.appendChild(top);
        const progressEl = top.querySelector('#qx5_job_progress');
  
        // 背景介绍（加入语音）
        const intro = document.createElement('div');
        intro.style.cssText = 'font-size:13px;color:#5A6B87;line-height:1.6;background:#F7FAFD;border-radius:10px;padding:10px 12px;';
        intro.textContent = SCENARIO.intro;
        stage.appendChild(intro);
        speakRole('narrator', SCENARIO.intro); // 读背景
  
        const dialog = document.createElement('div');
        dialog.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-height:140px;';
        stage.appendChild(dialog);
  
        const ta = document.createElement('textarea');
        ta.placeholder = '在这里输入你的回答……';
        ta.style.cssText = 'width:100%;height:90px;padding:10px;border:1px solid #D0D7E0;border-radius:10px;font-size:14px;box-sizing:border-box;font-family:inherit;resize:none;';
        stage.appendChild(ta);
  
        const timerEl = document.createElement('div');
        timerEl.style.cssText = 'font-size:12px;color:#C0392B;';
        stage.appendChild(timerEl);
  
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
        
        const submitBtn = document.createElement('button');
        submitBtn.className = 'qx5-btn qx5-btn-primary';
        submitBtn.textContent = '提交回答';
        submitBtn.style.cssText = 'flex:1;padding:12px;border:0;border-radius:10px;background:#2C7BE5;color:#fff;font-size:15px;cursor:pointer;';
        
        const demoBtn = document.createElement('button');
        demoBtn.className = 'qx5-btn qx5-btn-secondary';
        demoBtn.textContent = '听听示范回答';
        demoBtn.style.cssText = 'padding:12px 16px;border:0;border-radius:10px;background:#F1F5F9;color:#475569;font-size:14px;cursor:pointer;';
        
        const quitBtn = document.createElement('button');
        quitBtn.className = 'qx5-btn qx5-btn-secondary';
        quitBtn.textContent = '退出（弃权）';
        quitBtn.style.cssText = 'padding:12px 16px;border:0;border-radius:10px;background:#FBE9E7;color:#C0392B;font-size:14px;cursor:pointer;';
        
        btnRow.appendChild(submitBtn);
        btnRow.appendChild(demoBtn);
        btnRow.appendChild(quitBtn);
        stage.appendChild(btnRow);
  
        // ====== 2. 状态管理 ======
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
  
        // ====== 3. 内部方法 ======
        function addBubble(role, speaker, text) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
          
          const name = document.createElement('div');
          name.textContent = speaker;
          name.style.cssText = 'font-size:12px;font-weight:bold;color:' + (
            role === 'npc' ? '#4A7C9B' :
            role === 'interrupt' ? '#C77A1E' :
            role === 'competitor' ? '#6B6B6B' : '#333'
          ) + ';';
          
          const bubble = document.createElement('div');
          bubble.textContent = text;
          bubble.style.cssText = 'font-size:14px;line-height:1.6;padding:8px 10px;border-radius:8px;background:' + (
            role === 'npc' ? '#EEF3F7' :
            role === 'interrupt' ? '#FFF3E0' :
            role === 'competitor' ? '#F0F0F0' : '#fff'
          ) + ';';
          
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
          competitorScore = Math.max(45, Math.min(
            rule.competitorCap,
            rule.competitorBase + Math.round((Math.random() * 20 - 10))
          ));
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
  
          const q = pick(currentRound.npcLineVariants);
          addBubble('npc', '面试官 · 林经理', q);
          speakRole('lin_manager', q); // 考官发声
  
          const ir = decideInterrupter(currentRound);
          if (ir) {
            usedInterruptIds.push(ir.id);
            pendingInterruptImpact = ir.impact;
            setTimeout(() => {
              const speakerName = ir.id === 'xiaozhou' ? '傻助理 小周'
                : ir.id === 'laok' ? '总部观察员 老K'
                : ir.id === 'wangjie' ? '隔壁部门 王姐' : '干扰者';
              addBubble('interrupt', speakerName, ir.line);
              speakRole(ir.id, ir.line); // 干扰者发声
            }, 1000); // 稍微延迟 1 秒插话，让考官先说完
          }
  
          startTimer(currentRound.timeLimit || 60);
        }
  
        function submitRound() {
          if (finished) return;
          const text = ta.value.trim();
          if (!text) { alert('先写点什么，或者等着看竞争者抢答'); return; }
  
          clearInterval(timerId);
          anyAnswer = true;
  
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
  
          if (!anyAnswer) {
            pass = false;
            announce = competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll;
          } else {
            const rule = SCENARIO.judgeRule;
            pass = main >= rule.mainThreshold && intr >= rule.interruptThreshold && main > competitorScore;
            announce = pass ? SCENARIO.judgeAnnounce.pass
              : (competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll);
          }
  
          addBubble('npc', '面试官 · 林经理', announce);
          speakRole('lin_manager', announce); // 考官宣布结果语音
          submitBtn.disabled = true;
          demoBtn.disabled = true;
  
          setTimeout(() => {
            onAnswer(JSON.stringify({
              main: main,
              interrupt: intr,
              competitor: competitorScore,
              pass: pass,
              announce: announce,
              rounds: roundIdx
            }), pass);
          }, 2000);
        }
  
        // ====== 4. 按钮绑定 ======
        quitBtn.onclick = function () {
          if (!confirm('确定退出吗？中途退出视为弃权，本局不通过。')) return;
          finished = true;
          clearInterval(timerId);
          const announce = '你提前离开了面试。';
          addBubble('npc', '面试官 · 林经理', announce);
          speakRole('lin_manager', announce);
          onAnswer(JSON.stringify({
            main: 0, interrupt: 0, competitor: competitorScore,
            pass: false, announce: announce, quit: true
          }), false);
        };
  
        demoBtn.onclick = function () {
          if (!currentRound) return;
          addBubble('npc', '（示范回答）', currentRound.demoAnswer);
          speakRole('lin_manager', currentRound.demoAnswer); // 示范用考官声音
        };
  
        submitBtn.onclick = submitRound;
        ta.focus();
  
        // ====== 5. 启动 ======
        runRound();
      },
  
      computeScore: function (data) {
        const rec = data.records[0];
        let info = {};
        try { info = JSON.parse(rec.response); } catch (e) {}
        return {
          accuracy: 1, correctCount: 1, totalCount: 1,
          mainScore: info.main || 0,
          interruptScore: info.interrupt || 0,
          competitorScore: info.competitor || 0,
          pass: !!info.pass,
          announce: info.announce || '',
          quit: !!info.quit,
          rounds: info.rounds || 0
        };
      },
  
      renderResult: function (hostEl, data) {
        const s = data.score;
        hostEl.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'qx5-result';
        
        // 处理空作答带来的奇怪显示
        let noteHtml = '';
        if (s.mainScore === 0 && !s.quit) {
          noteHtml = `<div class="qx5-result-note" style="color:#E74C3C;margin-top:12px;">你一言未发，遗憾离场。下一局试试接住考官的问题？</div>`;
        } else if (s.quit) {
          noteHtml = `<div class="qx5-result-note" style="color:#E67E22;margin-top:12px;">中途弃权，视为未通过。</div>`;
        }
  
        wrap.innerHTML = `
          <div class="qx5-result-title">${E.t('应聘挑战 · 结果', 'Job Challenge · Result')}</div>
          <div class="qx5-result-hero" style="color:${s.pass ? '#2ECC71' : '#E74C3C'}">${s.pass ? E.t('通过', 'Pass') : E.t('未通过', 'Fail')}</div>
          <div class="qx5-result-sub">${s.announce || ''}</div>
          <div class="qx5-result-row"><span>${E.t('主评分（专业发挥）', 'Main Score')}</span><b>${s.mainScore}</b></div>
          <div class="qx5-result-row"><span>${E.t('干扰评分（稳住程度）', 'Interrupt Score')}</span><b>${s.interruptScore}</b></div>
          <div class="qx5-result-row"><span>${E.t('竞争者评分', 'Competitor')}</span><b>${s.competitorScore}</b></div>
          <div class="qx5-result-row"><span>${E.t('通关条件', 'Rule')}</span><b>${E.t('主≥65 且 干扰≥55 且 主>竞争者', 'Main≥65 & Interrupt≥55 & Main>Competitor')}</b></div>
          ${noteHtml}
          <div class="qx5-result-actions">
            <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart">${E.t('再刷一局', 'Play Again')}</button>
            <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit">${E.t('返回大厅', 'Back')}</button>
          </div>
        `;
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