/* ================================================================
   情绪宝 - qx5 应聘挑战（P0：凌晨超售）
   v1：
   - 注册到 qx5Engine，复用 session / trial / 结果页 / 再刷
   - 1 局 = 1 个 trial，内部跑 3 轮（考官问 → 干扰 → 超时竞争者抢答）
   - 双轨评分：主评分（共情/结构/动作）+ 干扰评分（化解/借力/自嘲）
   - 通关判定：主≥65 && 干扰≥55 && 主 > 竞争者（竞争者 55±10，封顶65）
   - 考官宣布结果；中途退出 = 弃权 = 不通过
   - 语音复用 window.qxSpeak，无则静默
   ================================================================ */
   (function () {
    'use strict';
    if (!window.qx5Engine) { console.error('[qx5_games_job] 缺少 qx5Engine'); return; }
    const E = window.qx5Engine;
  
    /* ---------------- 副本数据（P0 内联，跑通后再抽 qx5_scenarios.js） ---------------- */
    const SCENARIO = {
      id: 'hotel_front_desk_night',
      name: '凌晨超售',
      intro: '凌晨1:20，前台。系统显示超售，客人已到店，情绪激动。',
      rounds: [
        {
          id: 'r1',
          npcLineVariants: [
            '先给你30秒，说说你此刻会先做什么？',
            '客人现在就站在你面前，你第一句话说什么？',
            '你只有一分钟，先做什么？'
          ],
          timeLimit: 60,
          tips: '先接情绪，再给方案',
          demoAnswer: '我会先请客人坐下，倒杯水，表示理解他的疲惫……',
          evaluate: {
            empathy:   { keywords: ['理解','抱歉','着急','辛苦','我明白','理解您'], weight: 3 },
            structure: { keywords: ['首先','然后','最后','第一步','先','再','其次'], weight: 2 },
            action:    { keywords: ['升级','经理','调房','补偿','请示','权限','值班经理','超售'], weight: 2 }
          },
          interrupter: {
            id: 'xiaozhou', trigger: 'fixed',
            line: '哎——我觉得吧，直接给客人换套房不就行了？',
            tone: '愣', impact: '化解',
            speak: '哎，我觉得吧，直接给客人换套房不就行了？'
          },
          competitorAnswers: [
            '我会先道歉，然后看看有没有空房，没有的话请示经理。',
            '先安抚客人情绪，再查系统，最后给一个补偿方案。'
          ]
        },
        {
          id: 'r2',
          npcLineVariants: [
            '客人情绪好一点了，但坚持要赔偿。你的权限边界在哪？',
            '客人说“必须赔钱”，你怎么接？'
          ],
          timeLimit: 60,
          tips: '先确认权限，再给替代方案',
          demoAnswer: '我的权限是免费升级+餐饮券，超出部分需请示值班经理……',
          evaluate: {
            empathy:   { keywords: ['理解','抱歉','我明白'], weight: 1 },
            structure: { keywords: ['首先','然后','其次','先','再'], weight: 2 },
            action:    { keywords: ['请示','权限','升级','餐饮券','值班经理','调房'], weight: 3 }
          },
          interrupter: {
            id: 'random_laok_or_wang', trigger: 'random',
            options: [
              { id: 'laok',    line: '如果是我，我会先调监控确认超售原因，再谈补偿。', tone: '沉稳', impact: '借力', speak: '如果是我，我会先调监控，确认超售原因，再谈补偿。' },
              { id: 'wangjie', line: '现在的年轻人啊～遇到点事就慌。', tone: '嘲讽', impact: '自嘲', speak: '现在的年轻人啊，遇到点事就慌。' }
            ]
          },
          competitorAnswers: [
            '我的权限有限，先给客人升级房间，再请示经理。',
            '先确认客人诉求，再在自己的权限内给方案。'
          ]
        },
        {
          id: 'r3',
          npcLineVariants: [
            '经理让你5分钟内给方案，你怎么排优先级？',
            '如果客人还是不满意，你最后一步做什么？'
          ],
          timeLimit: 45,
          tips: '排优先级：先稳情绪，再给方案，最后请示',
          demoAnswer: '先稳住客人情绪，再给一个我能拍板的方案，最后请示超出权限的部分……',
          evaluate: {
            empathy:   { keywords: ['理解','我明白'], weight: 1 },
            structure: { keywords: ['先','再','最后','优先级','第一步'], weight: 3 },
            action:    { keywords: ['方案','请示','权限','补偿','升级'], weight: 2 }
          },
          interrupter: { id: 'fill_if_needed', trigger: 'if_none_yet' },
          competitorAnswers: [
            '先安抚，再给方案，最后请示。',
            '按紧急程度排，先解决客人住宿，再谈补偿。'
          ]
        }
      ],
      judgeAnnounce: {
        pass: '你被录用了。',
        failByCompetitor: '这次我们选了另一位。',
        failAll: '今天两位都不太合适。'
      },
      judgeRule: { mainThreshold: 65, interruptThreshold: 55, competitorBase: 55, competitorCap: 65 }
    };
  
    /* ---------------- 工具 ---------------- */
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function speak(text, speaker) {
      // 复用现有 qxSpeak；P0 不区分角色音色（P1 再加语音包）
      if (typeof window.qxSpeak === 'function' && text) {
        try { window.qxSpeak(text); } catch (e) {}
      }
    }
    function normalizeScores(userText, evaluate) {
      // 关键词命中 → 维度原始分 → 归一化 0-100
      const out = {};
      let totalW = 0;
      for (const [dim, cfg] of Object.entries(evaluate)) {
        const hits = (cfg.keywords || []).filter(k => userText.includes(k)).length;
        const raw = Math.min(hits * cfg.weight, 10);
        out[dim] = Math.round((raw / 10) * 100);
        totalW += cfg.weight;
      }
      return out;
    }
    function avg(obj) {
      const v = Object.values(obj);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
    }
  
    /* ---------------- 注册游戏 ---------------- */
    E.registerGame({
      id: 'job_hotel_front_desk',
      collectionId: 'emotion',
      isFeatured: true,
      title:    { cn: '应聘挑战', en: 'Job Challenge' },
      subtitle: { cn: '凌晨超售，你能稳住局面吗？', en: 'Midnight overbooking — can you stay in control?' },
  
      generateTrials: function () {
        return [{ id: 'run_1', condition: 'interview', stimulus: {} }];
      },
  
      renderTrial: function (hostEl, trial, onAnswer, meta) {
        hostEl.innerHTML = '';
  
        const stage = document.createElement('div');
        stage.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:16px;max-width:520px;margin:0 auto;box-sizing:border-box;';
        hostEl.appendChild(stage);
  
        /* 顶部进度 */
        const top = document.createElement('div');
        top.style.cssText = 'display:flex;justify-content:space-between;font-size:13px;color:#5A6B87;';
        top.innerHTML = `<span>🏨 ${SCENARIO.name}</span><span id="qx5_job_progress">第 1 / 3 轮</span>`;
        stage.appendChild(top);
        const progressEl = top.querySelector('#qx5_job_progress');
  
        /* 场景介绍 */
        const intro = document.createElement('div');
        intro.style.cssText = 'font-size:13px;color:#5A6B87;line-height:1.6;background:#F7FAFD;border-radius:10px;padding:10px 12px;';
        intro.textContent = SCENARIO.intro;
        stage.appendChild(intro);
  
        /* 对话区（考官 / 干扰 / 竞争者都追加到这里） */
        const dialog = document.createElement('div');
        dialog.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-height:140px;';
        stage.appendChild(dialog);
  
        /* 输入区 */
        const ta = document.createElement('textarea');
        ta.placeholder = '在这里输入你的回答……';
        ta.style.cssText = 'width:100%;height:90px;padding:10px;border:1px solid #D0D7E0;border-radius:10px;font-size:14px;box-sizing:border-box;font-family:inherit;resize:none;';
        stage.appendChild(ta);
  
        /* 计时器 */
        const timerEl = document.createElement('div');
        timerEl.style.cssText = 'font-size:12px;color:#C0392B;';
        stage.appendChild(timerEl);
  
        /* 按钮区 */
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
  
        /* -------- 状态 -------- */
        let roundIdx = 0;
        const mainScores = [];        // 每轮主评分均值
        const interruptScores = [];   // 每轮干扰评分
        let competitorScore = 0;
        let anyAnswer = false;
        let finished = false;
        let timerId = null;
        let currentRound = null;
        let roundAnswered = false;
        let competitorDone = false;
        let usedInterruptIds = [];    // 记录已触发的干扰角色（用于 r3 if_none_yet）
        let pendingInterruptImpact = null; // 本轮触发的干扰影响哪个维度
        let userAnsweredThisRound = false;
  
        /* -------- 工具：追加气泡 -------- */
        function addBubble(role, speaker, text, cls) {
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
  
        /* -------- 干扰角色选择 -------- */
        function decideInterrupter(round) {
          const ir = round.interrupter;
          if (!ir) return null;
          if (ir.trigger === 'fixed') return ir;
          if (ir.trigger === 'random') return pick(ir.options);
          if (ir.trigger === 'if_none_yet') {
            if (usedInterruptIds.length > 0) return null;
            // 补一个未用过的：随机在老K / 王姐里选
            const pool = [
              { id: 'laok',    line: '如果是我，我会先调监控确认超售原因，再谈补偿。', tone: '沉稳', impact: '借力', speak: '如果是我，我会先调监控，确认超售原因，再谈补偿。' },
              { id: 'wangjie', line: '现在的年轻人啊～遇到点事就慌。', tone: '嘲讽', impact: '自嘲', speak: '现在的年轻人啊，遇到点事就慌。' }
            ].filter(x => !usedInterruptIds.includes(x.id));
            return pool.length ? pick(pool) : null;
          }
          return null;
        }
  
        /* -------- 竞争者：超时抢答 -------- */
        function triggerCompetitor(round) {
          if (competitorDone || finished) return;
          competitorDone = true;
          const ans = pick(round.competitorAnswers);
          addBubble('competitor', '隔壁候选人（抢答）', ans);
          speak(ans);
          timerEl.textContent = '竞争者已抢答，你仍可回答（答得好可翻盘）';
          // 竞争者水平：55 ± 10，封顶 65
          competitorScore = Math.max(45, Math.min(
            SCENARIO.judgeRule.competitorCap,
            SCENARIO.judgeRule.competitorBase + Math.round((Math.random() * 20 - 10))
          ));
          // 超时后没作答，允许继续答；但若一直不答，本轮结束由用户点提交或退出
        }
  
        /* -------- 计时器 -------- */
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
  
        /* -------- 运行一轮 -------- */
        function runRound() {
          if (finished) return;
          if (roundIdx >= SCENARIO.rounds.length) { finishAll(); return; }
  
          currentRound = SCENARIO.rounds[roundIdx];
          roundAnswered = false;
          competitorDone = false;
          userAnsweredThisRound = false;
          pendingInterruptImpact = null;
  
          progressEl.textContent = `第 ${roundIdx + 1} / ${SCENARIO.rounds.length} 轮`;
          ta.value = '';
  
          const q = pick(currentRound.npcLineVariants);
          addBubble('npc', '面试官 · 林经理', q);
          speak(q);
  
          // 干扰角色：本轮是否触发
          const ir = decideInterrupter(currentRound);
          if (ir) {
            usedInterruptIds.push(ir.id);
            pendingInterruptImpact = ir.impact;
            // 延迟 800ms 插入，制造"突然插话"感
            setTimeout(() => {
              const speakerName = ir.id === 'xiaozhou' ? '傻助理 小周'
                : ir.id === 'laok' ? '总部观察员 老K'
                : ir.id === 'wangjie' ? '隔壁部门 王姐' : '干扰者';
              addBubble('interrupt', speakerName, ir.line);
              speak(ir.speak || ir.line);
            }, 800);
          }
  
          startTimer(currentRound.timeLimit || 60);
        }
  
        /* -------- 提交本轮回答 -------- */
        function submitRound() {
          if (finished) return;
          const text = ta.value.trim();
          if (!text) { alert('先写点什么，或者等着看竞争者抢答'); return; }
  
          clearInterval(timerId);
          userAnsweredThisRound = true;
          anyAnswer = true;
  
          const dimScores = normalizeScores(text, currentRound.evaluate);
          const mainAvg = avg(dimScores);
          mainScores.push(mainAvg);
  
          // 干扰评分：只在本轮有干扰时计入
          if (pendingInterruptImpact) {
            // 用主评分里的对应维度作为干扰应对分的近似（P0 简化）
            // 例如 impact='化解' → 看 empathy；impact='借力' → 看 action；impact='自嘲' → 看 empathy
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
  
        /* -------- 结算 -------- */
        function finishAll() {
          if (finished) return;
          finished = true;
          clearInterval(timerId);
  
          const main = mainScores.length ? Math.round(mainScores.reduce((a, b) => a + b, 0) / mainScores.length) : 0;
          const intr = interruptScores.length ? Math.round(interruptScores.reduce((a, b) => a + b, 0) / interruptScores.length) : 0;
  
          let pass = false;
          let announce = '';
          if (!anyAnswer) {
            // 全程未作答
            pass = false;
            announce = competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll;
          } else {
            const rule = SCENARIO.judgeRule;
            pass = main >= rule.mainThreshold
                && intr >= rule.interruptThreshold
                && main > competitorScore;
            announce = pass ? SCENARIO.judgeAnnounce.pass
              : (competitorScore >= 50 ? SCENARIO.judgeAnnounce.failByCompetitor : SCENARIO.judgeAnnounce.failAll);
          }
  
          addBubble('npc', '面试官 · 林经理', announce);
          speak(announce);
  
          // 交回引擎
          onAnswer(JSON.stringify({
            main: main,
            interrupt: intr,
            competitor: competitorScore,
            pass: pass,
            announce: announce,
            rounds: roundIdx
          }), pass);
        }
  
        /* -------- 退出（弃权） -------- */
        quitBtn.onclick = function () {
          if (!confirm('确定退出吗？中途退出视为弃权，本局不通过。')) return;
          finished = true;
          clearInterval(timerId);
          const announce = '你提前离开了面试。';
          addBubble('npc', '面试官 · 林经理', announce);
          onAnswer(JSON.stringify({
            main: 0, interrupt: 0, competitor: competitorScore,
            pass: false, announce: announce, quit: true
          }), false);
        };
  
        /* -------- 听示范 -------- */
        demoBtn.onclick = function () {
          if (!currentRound) return;
          addBubble('npc', '（示范回答）', currentRound.demoAnswer);
          speak(currentRound.demoAnswer);
        };
  
        submitBtn.onclick = submitRound;
        ta.focus();
  
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
        wrap.innerHTML = `
          <div class="qx5-result-title">${E.t('应聘挑战 · 结果', 'Job Challenge · Result')}</div>
          <div class="qx5-result-hero" style="color:${s.pass ? '#2ECC71' : '#E74C3C'}">${s.pass ? E.t('通过', 'Pass') : E.t('未通过', 'Fail')}</div>
          <div class="qx5-result-sub">${s.announce || ''}</div>
          <div class="qx5-result-row"><span>${E.t('主评分（专业发挥）', 'Main Score')}</span><b>${s.mainScore}</b></div>
          <div class="qx5-result-row"><span>${E.t('干扰评分（稳住程度）', 'Interrupt Score')}</span><b>${s.interruptScore}</b></div>
          <div class="qx5-result-row"><span>${E.t('竞争者评分', 'Competitor')}</span><b>${s.competitorScore}</b></div>
          <div class="qx5-result-row"><span>${E.t('通关条件', 'Rule')}</span><b>${E.t('主≥65 且 干扰≥55 且 主>竞争者', 'Main≥65 & Interrupt≥55 & Main>Competitor')}</b></div>
          <div class="qx5-result-note">${s.quit ? E.t('本局为中途退出，视为弃权。', 'You quit early — treated as forfeit.') : ''}</div>
          <div class="qx5-result-actions">
            <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart">${E.t('再刷一局', 'Play Again')}</button>
            <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit">${E.t('返回大厅', 'Back')}</button>
          </div>
        `;
        hostEl.appendChild(wrap);
        hostEl.querySelector('#qx5_result_restart').onclick = () => E.restart();
        hostEl.querySelector('#qx5_result_exit').onclick = () => E.exit();
      }
    });
  
  })();