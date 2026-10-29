/* ================================================================
   情绪宝 - qx5 霍兰德职业兴趣测试（RIASEC）
   ================================================================ */
   (function () {
    'use strict';

    const t = (cn, en) => {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    };

    const QUESTIONS = [
        { q_cn: '我喜欢修理机器或组装零件。', q_en: 'I like to repair machines or assemble parts.', type: 'R' },
        { q_cn: '我喜欢使用工具或体力劳动。', q_en: 'I like using tools or doing physical labor.', type: 'R' },
        { q_cn: '我喜欢在户外或野外工作。', q_en: 'I like working outdoors or in the field.', type: 'R' },
        { q_cn: '我喜欢研究事物背后的科学原理。', q_en: 'I like researching the science behind things.', type: 'I' },
        { q_cn: '我喜欢做数学题或逻辑推理。', q_en: 'I like math problems or logical reasoning.', type: 'I' },
        { q_cn: '我喜欢独立探索未知的领域。', q_en: 'I like exploring unknown fields independently.', type: 'I' },
        { q_cn: '我喜欢画画、写作或设计。', q_en: 'I like drawing, writing, or designing.', type: 'A' },
        { q_cn: '我喜欢用音乐或艺术表达自己。', q_en: 'I like expressing myself through music or art.', type: 'A' },
        { q_cn: '我喜欢自由自在、没有固定规则的工作。', q_en: 'I like free, unstructured work.', type: 'A' },
        { q_cn: '我喜欢倾听别人的烦恼并安慰他们。', q_en: 'I like listening to others problems and comforting them.', type: 'S' },
        { q_cn: '我喜欢教导或培训别人。', q_en: 'I like teaching or training others.', type: 'S' },
        { q_cn: '我喜欢团队合作，大家一起完成任务。', q_en: 'I like teamwork and completing tasks together.', type: 'S' },
        { q_cn: '我喜欢说服别人接受我的观点。', q_en: 'I like persuading others to accept my views.', type: 'E' },
        { q_cn: '我喜欢做决定或领导团队。', q_en: 'I like making decisions or leading a team.', type: 'E' },
        { q_cn: '我喜欢为了达成目标而承担风险。', q_en: 'I like taking risks to achieve goals.', type: 'E' },
        { q_cn: '我喜欢整理数据或做账。', q_en: 'I like organizing data or doing accounting.', type: 'C' },
        { q_cn: '我喜欢按部就班、有清晰规则的工作。', q_en: 'I like structured work with clear rules.', type: 'C' },
        { q_cn: '我喜欢把文件和物品收拾得井井有条。', q_en: 'I like keeping files and items in perfect order.', type: 'C' },
    ];

    const RESULTS = {
        'R': { name_cn: '现实型', name_en: 'Realistic', desc_cn: '喜欢动手实践，擅长操作工具，适合工程师、机械师、运动员等职业。', desc_en: 'Prefers hands-on practice and tools.', color: '#E67E22' },
        'I': { name_cn: '研究型', name_en: 'Investigative', desc_cn: '喜欢观察思考，善于逻辑推理，适合科学家、医生、程序员等职业。', desc_en: 'Enjoys observing and thinking.', color: '#2C7BE5' },
        'A': { name_cn: '艺术型', name_en: 'Artistic', desc_cn: '富有想象力，追求个性和美感，适合设计师、作家、艺术家等职业。', desc_en: 'Imaginative and creative.', color: '#9B59B6' },
        'S': { name_cn: '社会型', name_en: 'Social', desc_cn: '乐于助人，擅长沟通和教导，适合教师、心理咨询师、社会工作者等。', desc_en: 'Helpful and good at communicating.', color: '#2ECC71' },
        'E': { name_cn: '企业型', name_en: 'Enterprising', desc_cn: '喜欢冒险和领导，精力充沛，适合创业者、销售、管理者等职业。', desc_en: 'Loves adventure and leadership.', color: '#E74C3C' },
        'C': { name_cn: '常规型', name_en: 'Conventional', desc_cn: '做事严谨细心，擅长整理和规划，适合会计、行政、数据分析等职业。', desc_en: 'Rigorous and detail-oriented.', color: '#95A5A6' }
    };

    let currentIdx = 0;
    let scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    function startHolland(hostEl) {
        currentIdx = 0;
        scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
        renderQuestion(hostEl);
    }

    function renderQuestion(hostEl) {
        if (currentIdx >= QUESTIONS.length) {
            renderResult(hostEl);
            return;
        }

        const q = QUESTIONS[currentIdx];
        const qText = t(q.q_cn, q.q_en);

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 30px 20px; text-align: center;">
                <div style="font-size: 14px; color: #64748B; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <span>${t('问题', 'Question')} ${currentIdx + 1} / ${QUESTIONS.length}</span>
                    <span id="qx5_holland_voice" style="cursor:pointer; font-size:20px;" title="听题">🔊</span>
                </div>
                <div style="font-size: 20px; font-weight: bold; color: #1E293B; margin-bottom: 40px; line-height: 1.5;">
                    ${qText}
                </div>
                
                <button class="qx5-btn qx5-btn-primary" style="width: 100%; padding: 16px; margin-bottom: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer;" onclick="window._hollandAnswer('yes')">
                    ${t('是的，我喜欢', 'Yes, I like it')}
                </button>
                <button class="qx5-btn qx5-btn-secondary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #F1F5F9; color: #475569; border: none; cursor: pointer;" onclick="window._hollandAnswer('no')">
                    ${t('不，我不喜欢', 'No')}
                </button>
            </div>
        `;

        const speakText = t(`第${currentIdx + 1}题。${q.q_cn} 是，还是否？`, `Question ${currentIdx + 1}. ${q.q_en} Yes or no?`);

        const voiceBtn = hostEl.querySelector('#qx5_holland_voice');
        if (voiceBtn) {
            voiceBtn.onclick = () => {
                if (window.qxSpeak) window.qxSpeak(speakText);
            };
        }

        setTimeout(() => {
            if (window.qxSpeak) window.qxSpeak(speakText);
        }, 500);
    }

    window._hollandAnswer = function(choice) {
        const q = QUESTIONS[currentIdx];
        if (choice === 'yes') scores[q.type]++;
        currentIdx++;
        renderQuestion(document.getElementById('qx5_play_host'));
    };

    function renderResult(hostEl) {
        const sortedTypes = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
        const topThree = sortedTypes.slice(0, 3);
        const mainType = topThree[0];
        const res = RESULTS[mainType];
        const resName = t(res.name_cn, res.name_en);
        const resDesc = t(res.desc_cn, res.desc_en);

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
                <div style="font-size: 16px; color: #64748B; margin-bottom: 10px;">${t('您的职业兴趣代码是', 'Your Career Interest Code is')}</div>
                
                <div style="background: #fff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; margin-bottom: 30px; border: 1px solid #E2E8F0;">
                    <div style="background: ${res.color}; padding: 40px 20px; color: #fff; position: relative;">
                        <span id="qx5_holland_result_voice" style="position: absolute; top: 15px; right: 15px; cursor: pointer; font-size: 20px; opacity: 0.8;" title="听结果">🔊</span>
                        <div style="font-size: 40px; font-weight: 900; letter-spacing: 4px; margin-bottom: 10px;">${topThree.join(' - ')}</div>
                        <div style="font-size: 20px; font-weight: bold; opacity: 0.9;">${resName}</div>
                    </div>
                    <div style="padding: 30px 20px; font-size: 15px; color: #334155; line-height: 1.8; text-align: left;">
                        ${resDesc}
                    </div>
                </div>

                <button class="qx5-btn qx5-btn-primary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer; margin-bottom: 16px;" onclick="window._hollandRestart()">
                    ${t('重新测试', 'Test Again')}
                </button>
                <button class="qx5-btn qx5-btn-secondary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #F1F5F9; color: #475569; border: none; cursor: pointer;" onclick="window.qx5_onExit()">
                    ${t('返回列表', 'Back to List')}
                </button>
            </div>
        `;

        const speakText = t(`测试完成。您的霍兰德职业兴趣代码是${topThree.join('、')}，主要属于${res.name_cn}。${res.desc_cn}`, 
                            `Assessment complete. Your Holland code is ${topThree.join(', ')}.`);
        if (window.qxSpeak) window.qxSpeak(speakText);

        const voiceBtn = hostEl.querySelector('#qx5_holland_result_voice');
        if (voiceBtn) {
            voiceBtn.onclick = () => {
                if (window.qxSpeak) window.qxSpeak(speakText);
            };
        }
    }

    window._hollandRestart = function() {
        startHolland(document.getElementById('qx5_play_host'));
    };

    window._hollandStart = function(hostEl) {
        startHolland(hostEl);
    };
})();