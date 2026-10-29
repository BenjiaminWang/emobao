/* ================================================================
   情绪宝 - qx5 MBTI 16型人格极简版测评
   v3 (2026-10-29)
   - 新增：完整的中英文题干、选项、结果文案
   - 优化：语音播报增加防抖与打断逻辑，防止多段语音打架
   ================================================================ */
   (function () {
    'use strict';

    const t = (cn, en) => {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    };

    // 极简 12 题题库（全面补齐中英双语）
    const QUESTIONS = [
        { q_cn: '在聚会上，你更倾向于：', q_en: 'At a party, you tend to:', a_cn: '主动认识新朋友', a_en: 'Actively meet new people', b_cn: '等待别人来找你', b_en: 'Wait for others to approach you', aScore: 'E', bScore: 'I' },
        { q_cn: '当你做决定时，更看重：', q_en: 'When making decisions, you value:', a_cn: '逻辑与事实', a_en: 'Logic and facts', b_cn: '情感与和谐', b_en: 'Emotions and harmony', aScore: 'T', bScore: 'F' },
        { q_cn: '你更喜欢哪种工作方式？', q_en: 'Which work style do you prefer?', a_cn: '按部就班，有计划', a_en: 'Structured and planned', b_cn: '灵活多变，随遇而安', b_en: 'Flexible and spontaneous', aScore: 'J', bScore: 'P' },
        { q_cn: '听到一个新概念，你首先会：', q_en: 'When hearing a new concept, you first:', a_cn: '关注它的实际用途', a_en: 'Focus on its practical use', b_cn: '想象它的未来可能性', b_en: 'Imagine its future possibilities', aScore: 'S', bScore: 'N' },
        { q_cn: '经过一整天社交后，你会：', q_en: 'After a whole day of socializing, you feel:', a_cn: '觉得精力充沛', a_en: 'Energetic', b_cn: '觉得需要独处充电', b_en: 'Need alone time to recharge', aScore: 'E', bScore: 'I' },
        { q_cn: '面对冲突时，你通常：', q_en: 'When facing conflict, you usually:', a_cn: '就事论事，讲道理', a_en: 'Discuss the facts and reason', b_cn: '照顾情绪，求同存异', b_en: 'Focus on emotions and seek common ground', aScore: 'T', bScore: 'F' },
        { q_cn: '你的桌面/房间通常是：', q_en: 'Your desk/room is usually:', a_cn: '整洁有序', a_en: 'Neat and organized', b_cn: '乱中有序', b_en: 'Organized chaos', aScore: 'J', bScore: 'P' },
        { q_cn: '你更容易被哪种人吸引？', q_en: 'Who are you more attracted to?', a_cn: '脚踏实地，注重细节', a_en: 'Down-to-earth, detail-oriented', b_cn: '天马行空，充满创意', b_en: 'Imaginative and creative', aScore: 'S', bScore: 'N' },
        { q_cn: '周末你更想去：', q_en: 'On weekends, you prefer to:', a_cn: '参加热闹的派对', a_en: 'Attend lively parties', b_cn: '在家看书/看电影', b_en: 'Read/watch movies at home', aScore: 'E', bScore: 'I' },
        { q_cn: '朋友向你诉苦，你会：', q_en: 'When a friend vents to you, you:', a_cn: '帮他分析问题，给出建议', a_en: 'Analyze the problem and give advice', b_cn: '先安慰他的情绪', b_en: 'Comfort their emotions first', aScore: 'T', bScore: 'F' },
        { q_cn: '你更倾向于：', q_en: 'You lean towards:', a_cn: '提前做好详细攻略', a_en: 'Making detailed plans in advance', b_cn: '走到哪算哪，随性探索', b_en: 'Going with the flow and exploring', aScore: 'J', bScore: 'P' },
        { q_cn: '你更相信：', q_en: 'You trust more in:', a_cn: '眼见为实，经验主义', a_en: 'Seeing is believing, empiricism', b_cn: '直觉第六感', b_en: 'Intuition and the sixth sense', aScore: 'S', bScore: 'N' },
    ];

    const MBTI_RESULTS = {
        'INTJ': { name_cn: '建筑师', name_en: 'Architect', desc_cn: '富有想象力和战略性的思想家，一切皆在计划之中。', desc_en: 'Imaginative and strategic thinkers, with a plan for everything.', color: '#4A154B' },
        'INTP': { name_cn: '逻辑学家', name_en: 'Logician', desc_cn: '具有创造力的发明家，对知识有着止不住的渴望。', desc_en: 'Innovative inventors with an unquenchable thirst for knowledge.', color: '#2C7BE5' },
        'ENTJ': { name_cn: '指挥官', name_en: 'Commander', desc_cn: '大胆，富有想象力且意志强大的领导者，总能找到或创造解决方法。', desc_en: 'Bold, imaginative and strong-willed leaders, always finding a way or making one.', color: '#E53935' },
        'ENTP': { name_cn: '辩论家', name_en: 'Debater', desc_cn: '聪明好奇的思想者，不会放弃任何智力上的挑战。', desc_en: 'Smart and curious thinkers who cannot resist an intellectual challenge.', color: '#F1C40F' },
        'INFJ': { name_cn: '提倡者', name_en: 'Advocate', desc_cn: '安静而神秘，同时鼓舞人心且不知疲倦的理想主义者。', desc_en: 'Quiet and mystical, yet very inspiring and tireless idealists.', color: '#1B5E20' },
        'INFP': { name_cn: '调停者', name_en: 'Mediator', desc_cn: '诗意，善良的利他主义者，总是热情地为正当理由提供帮助。', desc_en: 'Poetic, kind and altruistic people, always eager to help a good cause.', color: '#2ECC71' },
        'ENFJ': { name_cn: '主人公', name_en: 'Protagonist', desc_cn: '富有魅力鼓舞人心的领导者，有使听众着迷的能力。', desc_en: 'Charismatic and inspiring leaders, able to mesmerize their listeners.', color: '#E67E22' },
        'ENFP': { name_cn: '竞选者', name_en: 'Campaigner', desc_cn: '热情，有创造力爱社交的自由自在的人，总能找到理由微笑。', desc_en: 'Enthusiastic, creative and sociable free spirits, who can always find a reason to smile.', color: '#FF69B4' },
        'ISTJ': { name_cn: '物流师', name_en: 'Logistician', desc_cn: '实际且注重事实的个人，可靠性不容怀疑。', desc_en: 'Practical and fact-minded individuals, whose reliability cannot be doubted.', color: '#34495E' },
        'ISFJ': { name_cn: '守卫者', name_en: 'Defender', desc_cn: '非常专注而温暖的守护者，时刻准备着保护爱着的人们。', desc_en: 'Very dedicated and warm protectors, always ready to defend their loved ones.', color: '#7F8C8D' },
        'ESTJ': { name_cn: '总经理', name_en: 'Executive', desc_cn: '出色的管理者，在管理事情或人的方面无与伦比。', desc_en: 'Excellent administrators, unsurpassed at managing things or people.', color: '#D35400' },
        'ESFJ': { name_cn: '执政官', name_en: 'Consul', desc_cn: '极有同情心，爱交往受欢迎的人们，总是热心提供帮助。', desc_en: 'Extraordinarily caring, social and popular people, always eager to help.', color: '#F39C12' },
        'ISTP': { name_cn: '鉴赏家', name_en: 'Virtuoso', desc_cn: '大胆而实际的实验家，擅长使用任何形式的工具。', desc_en: 'Bold and practical experimenters, masters of all kinds of tools.', color: '#616161' },
        'ISFP': { name_cn: '探险家', name_en: 'Adventurer', desc_cn: '灵活有魅力的艺术家，时刻准备着探索和体验新鲜事物。', desc_en: 'Flexible and charming artists, always ready to explore and experience something new.', color: '#8E44AD' },
        'ESTP': { name_cn: '企业家', name_en: 'Entrepreneur', desc_cn: '聪明，精力充沛善于感知的人，真心享受生活在边缘。', desc_en: 'Smart, energetic and very perceptive people, who truly enjoy living on the edge.', color: '#C0392B' },
        'ESFP': { name_cn: '表演者', name_en: 'Entertainer', desc_cn: '自发的，精力充沛而热情的表演者——生活在他们周围永不无聊。', desc_en: 'Spontaneous, energetic and enthusiastic people – life is never boring around them.', color: '#E74C3C' },
    };

    let currentIdx = 0;
    let scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

    function startMbti(hostEl) {
        currentIdx = 0;
        scores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
        renderQuestion(hostEl);
    }

    function renderQuestion(hostEl) {
        if (currentIdx >= QUESTIONS.length) {
            renderResult(hostEl);
            return;
        }

        const q = QUESTIONS[currentIdx];
        const qText = t(q.q_cn, q.q_en);
        const aText = t(q.a_cn, q.a_en);
        const bText = t(q.b_cn, q.b_en);

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 30px 20px; text-align: center;">
                <div style="font-size: 14px; color: #64748B; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${t('问题', 'Question')} ${currentIdx + 1} / ${QUESTIONS.length}</span>
                    <span id="qx5_mbti_voice" style="cursor:pointer; font-size:20px;" title="听题">🔊</span>
                </div>
                <div style="font-size: 20px; font-weight: bold; color: #1E293B; margin-bottom: 40px; line-height: 1.5;">
                    ${qText}
                </div>
                
                <button class="qx5-btn qx5-btn-primary" style="width: 100%; padding: 16px; margin-bottom: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer;" onclick="window._mbtiAnswer('a')">
                    A. ${aText}
                </button>
                <button class="qx5-btn qx5-btn-secondary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #F1F5F9; color: #475569; border: none; cursor: pointer;" onclick="window._mbtiAnswer('b')">
                    B. ${bText}
                </button>
            </div>
        `;

        // 动态组装语音播报内容
        const speakText = t(`第${currentIdx + 1}题。${q.q_cn} 选项A：${q.a_cn}。选项B：${q.b_cn}。`, 
                            `Question ${currentIdx + 1}. ${q.q_en} Option A: ${q.a_en}. Option B: ${q.b_en}.`);

        // 绑定语音读题按钮
        const voiceBtn = hostEl.querySelector('#qx5_mbti_voice');
        if (voiceBtn) {
            voiceBtn.onclick = () => {
                if (window.qxSpeak) window.qxSpeak(speakText);
            };
        }

        // 自动播报当前题目
        setTimeout(() => {
            if (window.qxSpeak) window.qxSpeak(speakText);
        }, 500);
    }

    window._mbtiAnswer = function(choice) {
        const q = QUESTIONS[currentIdx];
        if (choice === 'a') scores[q.aScore]++;
        else scores[q.bScore]++;
        currentIdx++;
        
        renderQuestion(document.getElementById('qx5_play_host'));
    };

    function renderResult(hostEl) {
        const finalE = scores.E >= scores.I ? 'E' : 'I';
        const finalS = scores.S >= scores.N ? 'S' : 'N';
        const finalT = scores.T >= scores.F ? 'T' : 'F';
        const finalJ = scores.J >= scores.P ? 'J' : 'P';
        const mbtiType = finalE + finalS + finalT + finalJ;
        const res = MBTI_RESULTS[mbtiType];

        const resName = t(res.name_cn, res.name_en);
        const resDesc = t(res.desc_cn, res.desc_en);

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
                <div style="font-size: 16px; color: #64748B; margin-bottom: 10px;">${t('您的专属人格是', 'Your Personality Type is')}</div>
                
                <div style="background: #fff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; margin-bottom: 30px; border: 1px solid #E2E8F0;">
                    <div style="background: ${res.color}; padding: 40px 20px; color: #fff; position: relative;">
                        <span id="qx5_mbti_result_voice" style="position: absolute; top: 15px; right: 15px; cursor: pointer; font-size: 20px; opacity: 0.8;" title="听结果">🔊</span>
                        
                        <div style="font-size: 48px; font-weight: 900; letter-spacing: 4px; margin-bottom: 10px;">${mbtiType}</div>
                        <div style="font-size: 20px; font-weight: bold; opacity: 0.9;">${resName}</div>
                    </div>
                    <div style="padding: 30px 20px; font-size: 15px; color: #334155; line-height: 1.8; text-align: left;">
                        ${resDesc}
                    </div>
                </div>

                <button class="qx5-btn qx5-btn-primary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer; margin-bottom: 16px;" onclick="window._mbtiRestart()">
                    ${t('重新测试', 'Test Again')}
                </button>
                <button class="qx5-btn qx5-btn-secondary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #F1F5F9; color: #475569; border: none; cursor: pointer;" onclick="window.qx5_onExit()">
                    ${t('返回列表', 'Back to List')}
                </button>
            </div>
        `;

        // 动态组装结果播报内容
        const speakText = t(`测试完成。您的专属人格是${mbtiType}，${res.name_cn}。${res.desc_cn}`, 
                            `Assessment complete. Your personality type is ${mbtiType}, ${res.name_en}. ${res.desc_en}`);

        // 自动播报结果语音
        if (window.qxSpeak) {
            window.qxSpeak(speakText);
        }

        // 手动播放按钮
        const voiceBtn = hostEl.querySelector('#qx5_mbti_result_voice');
        if (voiceBtn) {
            voiceBtn.onclick = () => {
                if (window.qxSpeak) window.qxSpeak(speakText);
            };
        }
    }

    window._mbtiRestart = function() {
        startMbti(document.getElementById('qx5_play_host'));
    };

    window.qx5RegisterMbti = function() {
        if (window.qx5Engine) {
            window.qx5Engine.registerGame({
                id: 'mbti_test',
                collectionId: 'emotion',
                isFeatured: true,
                title: { cn: '16型人格测试', en: '16 Personalities' },
                subtitle: { cn: '测测你是哪种稀有物种', en: 'Discover your personality type' },
                generateTrials: () => [],
                renderTrial: () => {},
                computeScore: () => ({}),
                renderResult: () => {},
                customLaunch: function(hostEl) {
                    startMbti(hostEl);
                }
            });
        }
    };
    // 暴露给 qx5_main.js 强制调用
    window._mbtiStart = function(hostEl) {
        startMbti(hostEl);
    };
})();