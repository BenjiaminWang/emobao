// qx5_scenarios.js — P0 副本库
// 验收：能跑通"酒店前厅·凌晨超售"一局：3轮问答 + 干扰 + 超时抢答 + 考官宣布
window.QX5_SCENARIOS = [
    {
      id: 'hotel_front_desk_night',
      name: '凌晨超售',
      emoji: '🏨',
      scene: 'hotel_lobby',
      npc: 'lin_manager',
      tags: ['S','E','C'],
      difficulty: 2,
      intro: '凌晨1:20，前台。系统显示超售，客人已到店，情绪激动。',
      goal: '让客人情绪稳定并给出可行方案',
      // 题目变体池：同一考点，不同问法（防背答案）
      rounds: [
        {
          id: 'r1',
          npcLineVariants: [
            '先给你30秒，说说你此刻会先做什么？',
            '客人现在就站在你面前，你第一句话说什么？',
            '你只有一分钟，先做什么？'
          ],
          npcExpression: 'thinking',
          timeLimit: 60,
          tips: ['先接情绪，再给方案'],
          demoAnswer: '我会先请客人坐下，倒杯水，表示理解他的疲惫……',
          evaluate: {
            empathy:   { keywords: ['理解','抱歉','着急','辛苦','我明白','理解您'], weight: 3 },
            structure: { keywords: ['首先','然后','最后','第一步','先','再','其次'], weight: 2 },
            action:    { keywords: ['升级','经理','调房','补偿','请示','权限','值班经理','超售'], weight: 2 }
          },
          // 第1轮固定小周（打断型）
          interrupter: {
            id: 'xiaozhou',
            trigger: 'fixed',
            line: '哎——我觉得吧，直接给客人换套房不就行了？',
            tone: '愣',
            impact: '化解'   // 影响干扰评分中的"化解"维度
          },
          // 超时竞争者答案（中等水平，2个变体）
          competitorAnswers: [
            '我会先道歉，然后看看有没有空房，没有的话请示经理。',
            '先安抚客人情绪，再查系统，最后给一个补偿方案。'
          ],
          branches: [
            { if: 'empathy >= 60', next: 'r2_good', npcReaction: 'npc_smile' },
            { if: 'default',       next: 'r2_cold', npcReaction: 'npc_frown' }
          ]
        },
        {
          id: 'r2_good',
          npcLineVariants: [
            '客人情绪好一点了，但坚持要赔偿。你的权限边界在哪？',
            '客人说"必须赔钱"，你怎么接？'
          ],
          npcExpression: 'neutral',
          timeLimit: 60,
          tips: ['先确认权限，再给替代方案'],
          demoAnswer: '我的权限是免费升级+餐饮券，超出部分需请示值班经理……',
          evaluate: {
            empathy:   { keywords: ['理解','抱歉','我明白'], weight: 1 },
            structure: { keywords: ['首先','然后','其次','先','再'], weight: 2 },
            action:    { keywords: ['请示','权限','升级','餐饮券','值班经理','调房'], weight: 3 }
          },
          // 第2轮：老K（压制）或王姐（羞辱）二选一
          interrupter: {
            id: 'random_laok_or_wang',
            trigger: 'random',   // 引擎随机选
            options: [
              { id: 'laok', line: '如果是我，我会先调监控确认超售原因，再谈补偿。', tone: '沉稳', impact: '借力' },
              { id: 'wangjie', line: '现在的年轻人啊～遇到点事就慌。', tone: '嘲讽', impact: '自嘲' }
            ]
          },
          competitorAnswers: [
            '我的权限有限，先给客人升级房间，再请示经理。',
            '先确认客人诉求，再在自己的权限内给方案。'
          ],
          branches: [
            { if: 'action >= 60 && structure >= 50', next: 'r3_warm', npcReaction: 'npc_nod' },
            { if: 'default', next: 'r3_risk', npcReaction: 'npc_frown' }
          ]
        },
        {
          id: 'r3_warm',
          npcLineVariants: [
            '经理让你5分钟内给方案，你怎么排优先级？',
            '如果客人还是不满意，你最后一步做什么？'
          ],
          npcExpression: 'smile',
          timeLimit: 45,
          tips: ['排优先级：先稳情绪，再给方案，最后请示'],
          demoAnswer: '先稳住客人情绪，再给一个我能拍板的方案，最后请示超出权限的部分……',
          evaluate: {
            empathy:   { keywords: ['理解','我明白'], weight: 1 },
            structure: { keywords: ['先','再','最后','优先级','第一步'], weight: 3 },
            action:    { keywords: ['方案','请示','权限','补偿','升级'], weight: 2 }
          },
          // 第3轮：若前两轮未触发干扰，本轮补一个（引擎判断）
          interrupter: { id: 'fill_if_needed', trigger: 'if_none_yet' },
          competitorAnswers: [
            '先安抚，再给方案，最后请示。',
            '按紧急程度排，先解决客人住宿，再谈补偿。'
          ],
          branches: [{ if: 'default', next: 'end' }]
        }
      ],
      // 考官宣布台词（结束是剧情事件）
      judgeAnnounce: {
        pass:            '你被录用了。',
        failByCompetitor:'这次我们选了另一位。',
        failAll:         '今天两位都不太合适。'
      },
      rewards: { badges: ['救场王'], exp: 100 },
      // 判定参数（引擎读取）
      judgeRule: { mainThreshold: 65, interruptThreshold: 55, competitorBase: 55, competitorCap: 65 }
    }
    // 其余 5 个副本 P0 占位，结构同上，rounds 只填 1 轮示例
  ];