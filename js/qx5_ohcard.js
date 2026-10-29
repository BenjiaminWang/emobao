/* ================================================================
   情绪宝 - qx5 心理扑克（OH卡）潜意识投射
   v2 (2026-10-29)
   - 新增：全套语音引导（引导放松、读词、读结果）
   ================================================================ */
   (function () {
    'use strict';

    const t = (cn, en) => {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    };

    const CARDS = [
        { emoji: '👤', word_cn: '孤独', word_en: 'Solitude' },
        { emoji: '🚪', word_cn: '界限', word_en: 'Boundaries' },
        { emoji: '🪞', word_cn: '反思', word_en: 'Reflection' },
        { emoji: '🌊', word_cn: '情绪', word_en: 'Emotion' },
        { emoji: '🔒', word_cn: '压抑', word_en: 'Repression' },
        { emoji: '🌱', word_cn: '成长', word_en: 'Growth' },
        { emoji: '⏳', word_cn: '时间', word_en: 'Time' },
        { emoji: '👨‍👩‍👧', word_cn: '家庭', word_en: 'Family' },
        { emoji: '🗺️', word_cn: '探索', word_en: 'Exploration' },
        { emoji: '🕸️', word_cn: '纠结', word_en: 'Entanglement' },
        { emoji: '🎭', word_cn: '伪装', word_en: 'Disguise' },
        { emoji: '💡', word_cn: '觉醒', word_en: 'Awakening' },
        { emoji: '🔮', word_cn: '未知', word_en: 'Unknown' },
        { emoji: '🧱', word_cn: '阻碍', word_en: 'Obstacle' },
        { emoji: '🕊️', word_cn: '自由', word_en: 'Freedom' }
    ];

    let currentCards = [];

    function startOhCard(hostEl) {
        const shuffled = [...CARDS].sort(() => 0.5 - Math.random());
        currentCards = shuffled.slice(0, 3);
        
        // 【语音引导】进入时的放松引导
        if (window.qxSpeak) {
            setTimeout(() => {
                window.qxSpeak(t('请深呼吸，放松下来。看看你抽到的三张卡，凭直觉，写下一句话。', 
                                  'Take a deep breath and relax. Look at your three cards and write down what comes to mind.'));
            }, 500);
        }
        
        renderDraw(hostEl);
    }

    function renderDraw(hostEl) {
        // 提取抽到的词汇，用于语音播报
        const wordsTextCn = currentCards.map(c => c.word_cn).join('、');
        const wordsTextEn = currentCards.map(c => c.word_en).join(', ');

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 30px 20px; text-align: center;">
                <div style="font-size: 18px; font-weight: bold; color: #1E293B; margin-bottom: 10px;">
                    ${t('潜意识投射 · 心理扑克', 'Subconscious Projection · OH Cards')}
                </div>
                <div style="font-size: 13px; color: #64748B; margin-bottom: 20px; line-height: 1.6; position: relative;">
                    ${t('深呼吸，放松。看看下面三张卡，凭第一直觉，将图与词结合，写下一句话或一个词。', 'Take a deep breath. Look at the three cards below and follow your intuition.')}
                    <!-- 加个语音重播按钮 -->
                    <span id="qx5_oh_voice_draw" style="display:inline-block; margin-left: 8px; cursor: pointer; font-size: 18px;" title="听词">🔊</span>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 30px;">
                    ${currentCards.map(c => `
                        <div style="flex: 1; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 20px 10px; border: 1px solid #E2E8F0;">
                            <div style="font-size: 40px; margin-bottom: 10px;">${c.emoji}</div>
                            <div style="font-size: 16px; font-weight: bold; color: #2C7BE5;">${t(c.word_cn, c.word_en)}</div>
                        </div>
                    `).join('')}
                </div>

                <textarea id="qx5_oh_input" placeholder="${t('此刻，你想到了什么？写下来...', 'What comes to mind right now? Write it down...')}" style="width: 100%; height: 100px; padding: 15px; border-radius: 12px; border: 1px solid #CBD5E1; font-size: 15px; outline: none; resize: none; margin-bottom: 20px; box-sizing: border-box;"></textarea>

                <button id="qx5_oh_submit" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer; font-weight: bold;">
                    ${t('生成潜意识解读', 'Generate Reading')}
                </button>
            </div>
        `;

        // 绑定读词按钮
        const voiceDrawBtn = hostEl.querySelector('#qx5_oh_voice_draw');
        if (voiceDrawBtn) {
            voiceDrawBtn.onclick = () => {
                if (window.qxSpeak) {
                    window.qxSpeak(t(`你抽到的词是：${wordsTextCn}。请凭直觉写下你的感受。`, 
                                     `The words you drew are: ${wordsTextEn}. Write down your feelings.`));
                }
            };
        }

        document.getElementById('qx5_oh_submit').onclick = () => {
            const input = document.getElementById('qx5_oh_input').value.trim();
            if (!input) {
                alert(t('请写下你此刻的想法', 'Please write down your thoughts'));
                return;
            }
            renderResult(hostEl, input);
        };
    }

    function renderResult(hostEl, userInput) {
        const insight = t(
            `你看到了「${currentCards[0].word_cn}」，写下了“${userInput}”。\n\n这或许暗示着你内心深处正在经历某种拉扯。图片投射出的不仅是眼前的画面，更是你潜意识中被忽视的情绪。试着接纳这种感受，它可能是你自我成长的契机。`,
            `You saw "${currentCards[0].word_en}" and wrote "${userInput}".\n\nThis might suggest a tug-of-war in your subconscious. The images project your inner emotions. Try to accept these feelings; they may be an opportunity for growth.`
        );

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
                <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-radius: 20px; padding: 30px; color: #fff; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.15); margin-bottom: 30px; position: relative;">
                    <div style="font-size: 14px; color: #94A3B8; margin-bottom: 15px;">🔮 ${t('潜意识回声', 'Subconscious Echo')}</div>
                    
                    <!-- 结果页语音重播按钮 -->
                    <span id="qx5_oh_voice_result" style="position: absolute; top: 15px; right: 15px; cursor: pointer; font-size: 20px; opacity: 0.8;" title="听结果">🔊</span>

                    <div style="font-size: 16px; line-height: 1.8; white-space: pre-wrap;">${insight}</div>
                </div>

                <button class="qx5-btn qx5-btn-primary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer; margin-bottom: 16px;" onclick="window._ohRestart()">
                    ${t('再抽一次', 'Draw Again')}
                </button>
                <button class="qx5-btn qx5-btn-secondary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #F1F5F9; color: #475569; border: none; cursor: pointer;" onclick="window.qx5_onExit()">
                    ${t('返回列表', 'Back to List')}
                </button>
            </div>
        `;

        // 自动播报结果
        if (window.qxSpeak) {
            setTimeout(() => {
                window.qxSpeak(t(`潜意识回声：${insight}`, `Subconscious echo: ${insight}`));
            }, 500);
        }

        // 绑定结果重播按钮
        const voiceResultBtn = hostEl.querySelector('#qx5_oh_voice_result');
        if (voiceResultBtn) {
            voiceResultBtn.onclick = () => {
                if (window.qxSpeak) {
                    window.qxSpeak(t(`潜意识回声：${insight}`, `Subconscious echo: ${insight}`));
                }
            };
        }
    }

    window._ohRestart = function() {
        startOhCard(document.getElementById('qx5_play_host'));
    };

    window._ohStart = function(hostEl) {
        startOhCard(hostEl);
    };
})();