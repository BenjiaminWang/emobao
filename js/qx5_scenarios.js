window.QX5_SCENARIOS = [
    {
      id: 'space_hotel_666',
      name: '太空舱危机',
      emoji: '🚀',
      scene: 'space_lobby',
      npc: 'lin_manager',
      tags: ['S','E','C'],
      difficulty: 3,
      intro: '2031 年，云顶太空酒店。重力系统刚刚发生严重故障，一位身价百亿的 VIP 客人现在正贴在舱顶上，而 AI 前台还在不断重复“对不起”。林经理要求你在 3 轮内稳住这位客人。',
      goal: '安抚 VIP，并给出人类特有的解决方案',
      rounds: [
        {
          id: 'r1',
          npcLineVariants: [
            '客人现在连人带床贴在舱顶上，AI 正在念废话。你第一句话说什么？',
            '这位大老板平时脾气就大，现在被重力失误挂在半空，你先怎么做？',
            '全息投影里客人的脸都绿了，你打算怎么救场？'
          ],
          npcExpression: 'thinking',
          timeLimit: 90,
          tips: ['先用共情安抚，明确表示人类会接管'],
          demoAnswer: '我会立刻直视客人说：我非常**理解**您的愤怒，这绝对是我们的失职。现在我作为人类主管，立刻**接管**系统，马上帮您恢复重力。',
          evaluate: {
            empathy:   { keywords: ['理解','抱歉','失职','愤怒','明白'], weight: 3 },
            structure: { keywords: ['首先','马上','立刻','其次','方案'], weight: 2 },
            action:    { keywords: ['接管','重启','人工','拔电','维修','控制台'], weight: 2 }
          },
          interrupter: {
            id: 'xiaozhou',
            trigger: 'fixed',
            line: '（机器人卡顿音）宿主请不要惊慌，根据《太空安全守则》第13条，请保持倒立呼吸……',
            tone: '机械',
            impact: '化解'
          },
          competitorAnswers: [
            '我会说：客人对不起，我马上重启重力系统，您别着急。',
            '先道歉，然后联系技术部去修重力机。'
          ],
          branches: [
            { if: 'empathy >= 60', next: 'r2_good', npcReaction: 'npc_smile' },
            { if: 'default',       next: 'r2_cold', npcReaction: 'npc_frown' }
          ]
        },
        {
          id: 'r2_good',
          npcLineVariants: [
            '客人破口大骂：“我出三倍价钱，你立刻让人来修，否则我把这破酒店买下来炸了！”你怎么办？',
            '老板要求立刻安排逃生舱返回地球，但他的系统卡死了，你如何处理？',
            '客人说他的宠物狗飘出窗外了，要你马上找回来。但公司规定不能进入外部辐射区。你怎么接？'
          ],
          npcExpression: 'neutral',
          timeLimit: 90,
          tips: ['先通过“人工”手段解决问题，哪怕违规'],
          demoAnswer: '我的权限不够动用逃生舱，但我可以立刻**请示值班经理**，给您**升级**到最高级的 VIP 套房，并且亲自去**人工**把您的狗救回来。',
          evaluate: {
            empathy:   { keywords: ['理解','抱歉','明白'], weight: 1 },
            structure: { keywords: ['首先','然后','其次','先','再'], weight: 2 },
            action:    { keywords: ['请示','权限','升级','人工','亲自','特权','赔付'], weight: 3 }
          },
          interrupter: {
            id: 'random_laok_or_wang',
            trigger: 'random',
            options: [
              { id: 'laok', line: '（地球老专家）年轻人，太空酒店有规定，不能为了客人破例吧？', tone: '沉稳', impact: '借力' },
              { id: 'wangjie', line: '（舱内抱怨）我都快缺氧了，你们还在那边废话！', tone: '焦躁', impact: '自嘲' }
            ]
          },
          competitorAnswers: [
            '抱歉，我帮不了您，这是规定。',
            '请稍等，我马上联系技术人员。'
          ],
          branches: [
            { if: 'action >= 60 && structure >= 50', next: 'r3_warm', npcReaction: 'npc_nod' },
            { if: 'default', next: 'r3_risk', npcReaction: 'npc_frown' }
          ]
        },
        {
          id: 'r3_warm',
          npcLineVariants: [
            '林经理把你拉到一边：“AI 系统全面死机了，现在所有客人都在敲墙。你只有 5 分钟，排个优先级。”',
            '现在酒店断电了，所有人被困在黑暗里，你手头只有一把应急扳手，怎么办？'
          ],
          npcExpression: 'smile',
          timeLimit: 90,
          tips: ['按照危急程度，优先保住客人的生命和核心需求'],
          demoAnswer: '我会**首先**确保客人安全，让他们待在原地。**然后**用扳手强行打开应急门。**最后**用手动广播安抚所有人，让 AI 闭嘴。',
          evaluate: {
            empathy:   { keywords: ['理解','我明白'], weight: 1 },
            structure: { keywords: ['先','再','最后','优先级','首先'], weight: 3 },
            action:    { keywords: ['安全','扳手','强行','广播','应急门','AI'], weight: 2 }
          },
          interrupter: { id: 'fill_if_needed', trigger: 'if_none_yet' },
          competitorAnswers: [
            '我会先修电，再去安抚客人。',
            '先救人，再汇报。'
          ],
          branches: [{ if: 'default', next: 'end' }]
        }
      ],
      judgeAnnounce: {
        pass:            '很好，人类确实比 AI 更有用。欢迎入职。',
        failByCompetitor:'这次我们选了另一位更有破局思维的人。',
        failAll:         '今天两位的回答都太像 AI 了。'
      },
      rewards: { badges: ['人类之光'], exp: 100 },
      judgeRule: { mainThreshold: 45, interruptThreshold: 35, competitorBase: 55, competitorCap: 65 }
    }
  ];