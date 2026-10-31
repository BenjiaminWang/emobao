/* ================================================================
   情绪宝 - qx5 应聘挑战（P0：凌晨超售）
   v9：评级系统 + 成就徽章 + 反抄袭检测 + 极简清爽 UI
   ================================================================ */
   (function () {
    'use strict';
    if (!window.qx5Engine) { console.error('[qx5_games_job] 缺少 qx5Engine'); return; }
    
    const SCENARIO = window.QX5_SCENARIOS && window.QX5_SCENARIOS[0];
    if (!SCENARIO) { console.error('[qx5_games_job] 缺少 scenarios 数据'); return; }
  
    const E = window.qx5Engine;
  
    // ================= 核心：角色音色引擎 =================
    const VOICE_CONFIGS = {
      narrator:    { rate: 1.0, pitch: 1.0, preferGender: 'female' },
      lin_manager: { rate: 0.95, pitch: 0.85, preferGender: 'female' },
      xiaozhou:    { rate: 1.2, pitch: 1.5, preferGender: 'male' },
      laok:        { rate: 0.85, pitch: 1.2, preferGender: 'male' },
      wangjie:     { rate: 0.9, pitch: 1.1, preferGender: 'female' },
      competitor:  { rate: 1.0, pitch: 1.0, preferGender: 'male' }
    };
  
    function speakRole(roleId, text, onEndCallback) {
      if (!window.speechSynthesis || !text) {
        if (onEndCallback) onEndCallback();
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        const cfg = VOICE_CONFIGS[roleId] || VOICE_CONFIGS.narrator;
        u.rate = cfg.rate;
        u.pitch = cfg.pitch;
  
        const voices = window.speechSynthesis.getVoices();
        const zhVoices = voices.filter(v => v.lang.includes('zh') || v.lang.includes('CN'));
        if (zhVoices.length > 0) {
          if (cfg.preferGender === 'female') {
            u.voice = zhVoices.find(v => v.name.includes('女') || v.name.includes('Xiaoxiao') || v.name.includes('Yaoyao')) || zhVoices[0];
          } else if (cfg.preferGender === 'male') {
            u.voice = zhVoices.find(v => v.name.includes('男') || v.name.includes('Yunxi') || v.name.includes('Kangkang')) || zhVoices[0];
          }
        }
  
        u.onend = () => { if (onEndCallback) onEndCallback(); };
        u.onerror = () => { if (onEndCallback) onEndCallback(); };
  
        window.speechSynthesis.speak(u);
      } catch (e) { 
        console.warn('语音播报失败', e); 
        if (onEndCallback) onEndCallback();
      }
    }
  
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    
    function normalizeScores(userText, evaluate) {
      const out = {};
      for (const [dim, cfg] of Object.entries(evaluate)) {
        const hits = (cfg.keywords || []).filter(k => userText.includes(k)).length;
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
  
        // ====== 全屏容器 ======
        const stage = document.createElement('div');
        stage.style.cssText = `
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100vh;
          box-sizing: border-box;
          background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%);
          font-family: inherit;
          overflow: hidden;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = 'position: relative; z-index: 2; display: flex; flex-direction: column; height: 100%; padding: 16px; box-sizing: border-box;';
        stage.appendChild(content);
        hostEl.appendChild(stage);
  
        // ====== 顶部状态栏 ======
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;font-size:14px;color:#1E293B;font-weight:bold;margin-bottom:12px;flex-shrink:0;';
        top.innerHTML = `<span>🏨 ${SCENARIO.name}</span><span id="qx5_job_progress" style="color:#2C7BE5;">第 1 / ${SCENARIO.rounds.length} 轮</span>`;
        content.appendChild(top);
        const progressEl = top.querySelector('#qx5_job_progress');
  
        // ====== 场景介绍 ======
        const intro = document.createElement('div');
        intro.style.cssText = 'font-size:13px;color:#475569;line-height:1.6;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;margin-bottom:12px;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.02);';
        intro.textContent = SCENARIO.intro;
        content.appendChild(intro);
  
        // ====== 对话框 ======
        const dialog = document.createElement('div');
        dialog.style.cssText = 'display:flex;flex-direction:column;gap:12px;flex:1;overflow-y:auto;padding-right:4px;margin-bottom:12px;';
        content.appendChild(dialog);
  
        // ====== 底部操作区 ======
        const inputWrap = document.createElement('div');
        inputWrap.style.cssText = 'flex-shrink:0; display:flex; flex-direction:column; gap:8px; background: #FFFFFF; padding: 12px; border-radius: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.05); border: 1px solid #E2E8F0;';
        content.appendChild(inputWrap);
  
        const ta = document.createElement('textarea');
        ta.placeholder = '听题后点击开始，再输入你的回答……';
        ta.style.cssText = 'width:100%;height:70px;padding:10px;border:1px solid #CBD5E1;background:#F8FAFC;color:#1E293B;border-radius:8px;font-size:14px;box-sizing:border-box;font-family:inherit;resize:none;outline:none;transition:border 0.2s;';
        inputWrap.appendChild(ta);
  
        const timerEl = document.createElement('div');
        timerEl.style.cssText = 'font-size:13px;color:#E74C3C;font-weight:bold;text-align:center;display:none;'; 
        inputWrap.appendChild(timerEl);
  
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;';
        inputWrap.appendChild(btnRow);
  
        const startBtn = document.createElement('button');
        startBtn.className = 'qx5-btn qx5-btn-primary';
        startBtn.textContent = '▶ 开始作答（90秒）';
        startBtn.style.cssText = 'flex:1;padding:12px;border:0;border-radius:8px;background:#2ECC71;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;';
        
        const submitBtn = document.createElement('button');
        submitBtn.className = 'qx5-btn qx5-btn-primary';
        submitBtn.textContent = '提交回答';
        submitBtn.style.cssText = 'flex:1;padding:12px;border:0;border-radius:8px;background:#2C7BE5;color:#fff;font-size:15px;font-weight:bold;cursor:pointer;display:none;';
        
        const demoBtn = document.createElement('button');
        demoBtn.className = 'qx5-btn qx5-btn-secondary';
        demoBtn.textContent = '提示';
        demoBtn.style.cssText = 'padding:12px 16px;border:1px solid #CBD5E1;border-radius:8px;background:#F1F5F9;color:#475569;font-size:14px;font-weight:bold;cursor:pointer;';
        
        const quitBtn = document.createElement('button');
        quitBtn.className = 'qx5-btn qx5-btn-secondary';
        quitBtn.textContent = '弃权';
        quitBtn.style.cssText = 'padding:12px 16px;border:1px solid #FECACA;border-radius:8px;background:#FEF2F2;color:#DC2626;font-size:14px;font-weight:bold;cursor:pointer;';
        
        btnRow.appendChild(startBtn);
        btnRow.appendChild(submitBtn);
        btnRow.appendChild(demoBtn);
        btnRow.appendChild(quitBtn);
  
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
  
        function addBubble(role, speaker, text) {
          const isPlayer = role === 'player';
          const wrap = document.createElement('div');
          wrap.style.cssText = `display:flex; flex-direction:column; gap:4px; align-items: ${isPlayer ? 'flex-end' : 'flex-start'};`;
          
          const name = document.createElement('div');
          name.textContent = speaker;
          name.style.cssText = 'font-size:12px; font-weight:bold; color:#64748B; margin: 0 4px;';
          
          const bubble = document.createElement('div');
          bubble.textContent = text;
          
          let bg = '#FFFFFF'; let color = '#1E293B'; let border = '1px solid #E2E8F0';
          if (role === 'npc') { bg = '#FFFFFF'; color = '#1E293B'; border = '1px solid #E2E8F0'; } 
          else if (role === 'interrupt') { bg = '#FFF7ED'; color = '#C2410C'; border = '1px solid #FFEDD5'; } 
          else if (role === 'competitor') { bg = '#F8FAFC'; color = '#475569'; border = '1px solid #E2E8F0'; }
          else if (role === 'player') { bg = '#2C7BE5'; color = '#FFFFFF'; border = 'none'; }
          
          bubble.style.cssText = `font-size:15px; line-height:1.6; padding:12px 16px; border-radius: ${isPlayer ? '16px 16px 0 16px' : '16px 16px 16px 0'}; background: ${bg}; color: ${color}; border: ${border}; max-width: 90%; box-shadow: 0 2px 8px rgba(0,0,0,0.04);`;
          
          wrap.appendChild(name); wrap.appendChild(bubble);
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
          timerEl.textContent = '竞争者已抢答，你仍可回答';
          
          const rule = SCENARIO.judgeRule || { competitorBase: 55, competitorCap: 65 };
          competitorScore = Math.max(45, Math.min(rule.competitorCap, rule.competitorBase + Math.round((Math.random() * 20 - 10))));
        }
  
        function startTimer(sec) {
          clearInterval(timerId);
          let left = sec;
          timerEl.style.display = 'block';
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
          timerEl.style.display = 'none';
          timerEl.textContent = '';
  
          const q = pick(currentRound.npcLineVariants);
          addBubble('npc', '面试官 · 林经理', q);
  
          let hasInterrupted = false;
          const doInterrupt = () => {
            if (hasInterrupted || finished) return;
            hasInterrupted = true;
            const ir = decideInterrupter(currentRound);
            if (ir) {
              usedInterruptIds.push(ir.id);
              pendingInterruptImpact = ir.impact;
              setTimeout(() => {
                const speakerName = ir.id === 'xiaozhou' ? '傻助理 小周' : ir.id === 'laok' ? '总部观察员 老K' : '隔壁部门 王姐';
                addBubble('interrupt', speakerName, ir.line);
                speakRole(ir.id, ir.line);
              }, 800); 
            }
          };
  
          speakRole('lin_manager', q, () => { setTimeout(doInterrupt, 500); });
          setTimeout(doInterrupt, 2500);
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
  
          // === 新增：防作弊/防抄袭检测 ===
          const demo = currentRound.demoAnswer || '';
          let isCheating = false;
          
          if (text.length > 8 && demo.includes(text)) {
            isCheating = true;
          } else if (text.length > 10 && demo.length > 10) {
            let matchChars = 0;
            for (let char of text) {
              if (demo.includes(char)) matchChars++;
            }
            if (matchChars / text.length > 0.8) {
              isCheating = true;
            }
          }
  
          clearInterval(timerId);
          anyAnswer = true;
          addBubble('player', '你的回答', text);
  
          let dimScores = normalizeScores(text, currentRound.evaluate);
          let mainAvg = avg(dimScores);
  
          if (isCheating) {
            setTimeout(() => {
              addBubble('npc', '面试官 · 林经理', "（皱眉）你是在背网上的面经吗？我想听听你真实的处理思路。");
              speakRole('lin_manager', "你是在背网上的面经吗？我想听听你真实的处理思路。");
            }, 500);
            mainAvg = Math.floor(mainAvg * 0.5); 
          }
  
          mainScores.push(mainAvg);
  
          if (pendingInterruptImpact) {
            const map = { '化解': 'empathy', '借力': 'action', '自嘲': 'empathy' };
            const key = map[pendingInterruptImpact] || 'empathy';
            interruptScores.push(dimScores[key] != null ? dimScores[key] : 0);
          }
  
          roundIdx++;
          if (roundIdx >= SCENARIO.rounds.length) { finishAll(); } else { runRound(); }
        }
  
        function finishAll() {
          if (finished) return;
          finished = true;
          clearInterval(timerId);
  
          const main = mainScores.length ? Math.round(mainScores.reduce((a, b) => a + b, 0) / mainScores.length) : 0;
          const intr = interruptScores.length ? Math.round(interruptScores.reduce((a, b) => a + b, 0) / interruptScores.length) : 0;
  
          let pass = false; let announce = '';
          const rule = SCENARIO.judgeRule;
  
          if (!anyAnswer) {
            pass = false;
            announce = competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll;
          } else {
            pass = main >= 50 && intr >= 40 && main > competitorScore;
            announce = pass ? SCENARIO.judgeAnnounce.pass : (competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll);
          }
  
          addBubble('npc', '面试官 · 林经理', announce);
          submitBtn.disabled = true; demoBtn.disabled = true;
  
          speakRole('lin_manager', announce, () => {
            setTimeout(() => {
              onAnswer(JSON.stringify({ main, interrupt: intr, competitor: competitorScore, pass, announce, rounds: roundIdx }), pass);
            }, 1000); 
          });
        }
  
        quitBtn.onclick = function () {
          if (!confirm('确定退出吗？中途退出视为弃权。')) return;
          finished = true; clearInterval(timerId);
          onAnswer(JSON.stringify({ main: 0, interrupt: 0, competitor: competitorScore, pass: false, announce: '你提前离开了面试。', quit: true }), false);
        };
  
        // 【替换：提示小纸条】
        demoBtn.onclick = function () {
          if (!currentRound) return;
          addBubble('npc', '（HR 提示纸条）', "你可以试着先说一句共情的话，然后给出两步以上的解决方案。");
          speakRole('narrator', "你可以试着先说一句共情的话，然后给出两步以上的解决方案。");
        };
  
        submitBtn.onclick = submitRound;
        runRound();
      },
  
      computeScore: function (data) {
        const rec = data.records[0]; let info = {};
        try { info = JSON.parse(rec.response); } catch (e) {}
        return { accuracy: 1, correctCount: 1, totalCount: 1, mainScore: info.main || 0, interruptScore: info.interrupt || 0, competitorScore: info.competitor || 0, pass: !!info.pass, announce: info.announce || '', quit: !!info.quit, rounds: info.rounds || 0 };
      },
  
      // 【替换：带 S/A/B/C 评级的结果页】
      renderResult: function (hostEl, data) {
        const s = data.score; hostEl.innerHTML = '';
        
        // === 计算评级 ===
        let rating = 'C';
        let ratingColor = '#E74C3C';
        let ratingTitle = '被辞退';
        
        if (s.pass) {
          if (s.mainScore >= 85 && s.interruptScore >= 60) {
            rating = 'S'; ratingColor = '#F1C40F'; ratingTitle = '皇家管家';
          } else if (s.mainScore >= 70) {
            rating = 'A'; ratingColor = '#E67E22'; ratingTitle = '大堂经理';
          } else {
            rating = 'B'; ratingColor = '#2ECC71'; ratingTitle = '实习前台';
          }
        }
  
        const wrap = document.createElement('div');
        wrap.className = 'qx5-result';
        wrap.style.cssText = `min-height: 100vh; background: linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; position: relative;`;
        
        const card = document.createElement('div');
        card.style.cssText = 'position:relative; z-index:1; background:#FFFFFF; border-radius:20px; padding:30px 20px; width:100%; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.08); border:1px solid #E2E8F0; text-align:center; overflow: hidden;';
        
        const ratingHtml = `
          <div style="position:absolute; top:-10px; right:-10px; font-size:120px; font-weight:900; color:${ratingColor}; opacity:0.1; transform:rotate(15deg); pointer-events:none;">${rating}</div>
          <div style="font-size:18px;color:#64748B;margin-bottom:10px;">应聘挑战 · 结果</div>
          <div style="font-size:24px;font-weight:900;margin-bottom:4px;color:${ratingColor}">${ratingTitle}</div>
          <div style="display:inline-block; padding:4px 12px; border-radius:20px; background:${ratingColor}20; color:${ratingColor}; font-weight:bold; font-size:14px; margin-bottom:20px;">
            评级：${rating}
          </div>
          <div style="font-size:16px;color:#1E293B;margin-bottom:20px;font-weight:bold;background:#F8FAFC;padding:10px;border-radius:10px;">🗣️ 考官：“${s.announce}”</div>
        `;
  
        let badgesHtml = '';
        if (s.pass && s.interruptScore >= 60) {
          badgesHtml += `<span style="display:inline-block;background:#FEF3C7;color:#D97706;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin:0 4px 4px 0;">🏅 救场王</span>`;
        }
        if (s.mainScore >= 80) {
          badgesHtml += `<span style="display:inline-block;background:#DBEAFE;color:#2563EB;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin:0 4px 4px 0;">🏅 话术大师</span>`;
        }
        if (!s.pass && s.competitorScore > s.mainScore) {
          badgesHtml += `<span style="display:inline-block;background:#FEE2E2;color:#DC2626;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:bold;margin:0 4px 4px 0;">💔 惜败</span>`;
        }
  
        let noteHtml = (s.mainScore === 0 && !s.quit) ? `<div style="color:#E74C3C;margin-bottom:12px;font-size:13px;">你一言未发，遗憾离场。</div>` : (s.quit ? `<div style="color:#E67E22;margin-bottom:12px;font-size:13px;">中途弃权。</div>` : '');
  
        card.innerHTML += `
          ${ratingHtml}
          ${noteHtml}
          
          <div style="text-align:left;background:#F8FAFC;border-radius:10px;padding:15px;margin-bottom:20px;border:1px solid #E2E8F0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#475569;"><span>主评分（专业发挥）</span><b>${s.mainScore}</b></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;color:#475569;"><span>干扰评分（稳住程度）</span><b>${s.interruptScore}</b></div>
            <div style="display:flex;justify-content:space-between;font-size:14px;color:#475569;"><span>竞争者评分</span><b>${s.competitorScore}</b></div>
          </div>
  
          <div style="margin-bottom:20px; text-align:left;">
            <div style="font-size:13px;color:#64748B;margin-bottom:8px;">解锁成就</div>
            <div>${badgesHtml || '<span style="font-size:12px;color:#94A3B8;">本局未解锁徽章</span>'}</div>
          </div>
  
          <div style="display:flex;gap:10px;">
            <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart" style="flex:1;padding:12px;background:#2C7BE5;color:#fff;border:none;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer;">再刷一局</button>
            <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit" style="flex:1;padding:12px;background:#F1F5F9;color:#475569;border:1px solid #E2E8F0;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer;">返回大厅</button>
          </div>
        `;
        
        wrap.appendChild(card); hostEl.appendChild(wrap);
        
        hostEl.querySelector('#qx5_result_restart').onclick = () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); E.restart(); };
        hostEl.querySelector('#qx5_result_exit').onclick = () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); E.exit(); };
      }
    });
  
  })();