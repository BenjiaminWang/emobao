/* ================================================================
   情绪宝 - qx5 心理扑克（心象投射卡）
   v5 (2026-10-30) 终极完美版
   - 保证生成海报按钮存在且样式完美
   ================================================================ */
   (function () {
    'use strict';

    const t = (cn, en) => {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    };

    const DECK = [
        { emoji: '🌊', word_cn: '涌动', word_en: 'Surge' }, { emoji: '🌪️', word_cn: '烦躁', word_en: 'Restless' },
        { emoji: '🕳️', word_cn: '空洞', word_en: 'Emptiness' }, { emoji: '🔥', word_cn: '愤怒', word_en: 'Anger' },
        { emoji: '🕯️', word_cn: '平静', word_en: 'Calm' }, { emoji: '🌧️', word_cn: '悲伤', word_en: 'Sorrow' },
        { emoji: '🌸', word_cn: '喜悦', word_en: 'Joy' }, { emoji: '🧊', word_cn: '麻木', word_en: 'Numbness' },
        { emoji: '🌫️', word_cn: '迷茫', word_en: 'Confusion' }, { emoji: '⚡', word_cn: '焦虑', word_en: 'Anxiety' },
        { emoji: '🌅', word_cn: '希望', word_en: 'Hope' }, { emoji: '🥀', word_cn: '失落', word_en: 'Loss' },
        { emoji: '🫧', word_cn: '释然', word_en: 'Relief' }, { emoji: '🚪', word_cn: '界限', word_en: 'Boundary' },
        { emoji: '🪞', word_cn: '投射', word_en: 'Projection' }, { emoji: '👥', word_cn: '拥挤', word_en: 'Crowded' },
        { emoji: '🤝', word_cn: '联结', word_en: 'Connection' }, { emoji: '🧱', word_cn: '隔阂', word_en: 'Barrier' },
        { emoji: '🕸️', word_cn: '纠缠', word_en: 'Entanglement' }, { emoji: '🕊️', word_cn: '自由', word_en: 'Freedom' },
        { emoji: '👨‍👩‍👧', word_cn: '家庭', word_en: 'Family' }, { emoji: '🎭', word_cn: '伪装', word_en: 'Disguise' },
        { emoji: '🫂', word_cn: '拥抱', word_en: 'Embrace' }, { emoji: '🗣️', word_cn: '沟通', word_en: 'Communication' },
        { emoji: '🙈', word_cn: '逃避', word_en: 'Avoidance' }, { emoji: '🤲', word_cn: '接纳', word_en: 'Acceptance' },
        { emoji: '🔒', word_cn: '执念', word_en: 'Obsession' }, { emoji: '🗝️', word_cn: '释怀', word_en: 'Letting Go' },
        { emoji: '⚖️', word_cn: '评判', word_en: 'Judgment' }, { emoji: '💡', word_cn: '觉醒', word_en: 'Awakening' },
        { emoji: '🧭', word_cn: '方向', word_en: 'Direction' }, { emoji: '⏳', word_cn: '执着', word_en: 'Persistence' },
        { emoji: '🔮', word_cn: '未知', word_en: 'Unknown' }, { emoji: '👁️', word_cn: '洞察', word_en: 'Insight' },
        { emoji: '🎲', word_cn: '无常', word_en: 'Impermanence' }, { emoji: '🧩', word_cn: '意义', word_en: 'Meaning' },
        { emoji: '🔇', word_cn: '沉默', word_en: 'Silence' }, { emoji: '📜', word_cn: '规则', word_en: 'Rules' },
        { emoji: '🪶', word_cn: '轻盈', word_en: 'Lightness' }, { emoji: '🏃', word_cn: '奔跑', word_en: 'Running' },
        { emoji: '🛑', word_cn: '停滞', word_en: 'Stagnation' }, { emoji: '🌱', word_cn: '生长', word_en: 'Growth' },
        { emoji: '⚔️', word_cn: '对抗', word_en: 'Confrontation' }, { emoji: '🏗️', word_cn: '重建', word_en: 'Rebuild' },
        { emoji: '🧘', word_cn: '蛰伏', word_en: 'Resting' }, { emoji: '🚀', word_cn: '突破', word_en: 'Breakthrough' },
        { emoji: '🪁', word_cn: '放手', word_en: 'Let Go' }, { emoji: '🔨', word_cn: '打磨', word_en: 'Polishing' },
        { emoji: '🏔️', word_cn: '攀登', word_en: 'Climbing' }, { emoji: '🌊', word_cn: '顺流', word_en: 'Flow' },
        { emoji: '🛡️', word_cn: '防御', word_en: 'Defense' }, { emoji: '🤸', word_cn: '跃迁', word_en: 'Leap' },
        { emoji: '⬛', word_cn: '空白', word_en: 'Blank' }, { emoji: '⬜', word_cn: '未知', word_en: 'Unknown' }
    ];

    let currentCards = [];
    let currentUserInput = '';

    function startPoker(hostEl) {
        const shuffled = [...DECK].sort(() => 0.5 - Math.random());
        currentCards = shuffled.slice(0, 3);
        currentUserInput = '';
        
        if (window.qxSpeak) {
            setTimeout(() => {
                window.qxSpeak(t('请深呼吸。默念一个困扰你的问题，然后看看你抽到的三张牌。', 
                                  'Take a deep breath. Think of a question, then look at your three cards.'));
            }, 500);
        }
        renderDraw(hostEl);
    }

    function renderDraw(hostEl) {
        const labels = [
            { cn: '过去', en: 'Past', color: '#64748B' },
            { cn: '现在', en: 'Present', color: '#2C7BE5' },
            { cn: '未来', en: 'Future', color: '#00C853' }
        ];

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 30px 20px; text-align: center;">
                <div style="font-size: 18px; font-weight: bold; color: #1E293B; margin-bottom: 10px;">
                    ${t('情绪宝 · 心象投射卡', 'Emo Treasure · Projection Cards')}
                </div>
                <div style="font-size: 13px; color: #64748B; margin-bottom: 30px; line-height: 1.6;">
                    ${t('请将这三个词连在一起，用第一直觉编一个关于你自己的故事。', 'Connect these three words and tell a story about yourself.')}
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; margin-bottom: 30px;">
                    ${currentCards.map((c, i) => `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 12px; font-weight: bold; color: ${labels[i].color}; margin-bottom: 8px; letter-spacing: 1px;">
                                ${t(labels[i].cn, labels[i].en)}
                            </div>
                            <div style="width: 100%; background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); padding: 30px 10px; border: 1px solid #E2E8F0; transition: transform 0.3s;" onmouseover="this.style.transform='translateY(-5px)'" onmouseout="this.style.transform='translateY(0)'">
                                <div style="font-size: 48px; margin-bottom: 15px;">${c.emoji}</div>
                                <div style="font-size: 16px; font-weight: bold; color: #1E293B;">${t(c.word_cn, c.word_en)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <textarea id="qx5_poker_input" placeholder="${t('试着写下来：“过去的我...，现在的我...，我期待未来的我...”', 'Write down your story...')}" style="width: 100%; height: 120px; padding: 15px; border-radius: 12px; border: 1px solid #CBD5E1; font-size: 15px; outline: none; resize: none; margin-bottom: 20px; box-sizing: border-box; line-height: 1.5;"></textarea>

                <button id="qx5_poker_submit" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer; font-weight: bold;">
                    ${t('开启心象回声', 'Open Subconscious Echo')}
                </button>
            </div>
        `;

        document.getElementById('qx5_poker_submit').onclick = () => {
            const input = document.getElementById('qx5_poker_input').value.trim();
            if (!input) {
                alert(t('请写下你的故事', 'Please write your story'));
                return;
            }
            currentUserInput = input;
            renderResult(hostEl, input);
        };
    }

    function renderResult(hostEl, userInput) {
        const pastWord = t(currentCards[0].word_cn, currentCards[0].word_en);
        const presentWord = t(currentCards[1].word_cn, currentCards[1].word_en);
        const futureWord = t(currentCards[2].word_cn, currentCards[2].word_en);

        const insight = t(
            `关于【过去】：你抽到了「${pastWord}」。这可能暗示着你曾经经历过的一段真实感受。\n\n` +
            `关于【现在】：你看到了「${presentWord}」。结合你刚刚写下的故事，这也许是你当下需要面对的情绪或信念。\n\n` +
            `关于【未来】：你抽到了「${futureWord}」。这不是预测，而是一个方向——如果你能接纳当下的状态，你可能会走向这里。\n\n` +
            `你刚才写道：“${userInput}”。请抱抱那个过去的自己，也请允许现在的自己，带着这份觉察，勇敢地走向未来。`,
            `Past: "${pastWord}". Present: "${presentWord}". Future: "${futureWord}".\n\n` +
            `You wrote: "${userInput}". Accept yourself and move forward with awareness.`
        );

        hostEl.innerHTML = `
            <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
                
                <!-- 用于生成海报的容器 -->
                <div id="qx5_poster_box" style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-radius: 20px; padding: 30px; color: #fff; text-align: left; box-shadow: 0 10px 30px rgba(0,0,0,0.15); margin-bottom: 30px; position: relative;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <div style="font-size: 14px; color: #94A3B8;">🔮 ${t('情绪宝·潜意识回声', 'Emo Treasure · Echo')}</div>
                        <div style="font-size: 20px;">✨</div>
                    </div>

                    <!-- 迷你三卡展示 -->
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        ${currentCards.map((c, i) => `
                            <div style="flex: 1; background: rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; text-align: center;">
                                <div style="font-size: 24px; margin-bottom: 4px;">${c.emoji}</div>
                                <div style="font-size: 12px; color: #CBD5E1;">${t(c.word_cn, c.word_en)}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="font-size: 15px; line-height: 1.8; white-space: pre-wrap; margin-bottom: 20px;">${insight}</div>

                    <!-- 海报底部品牌标识 -->
                    <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 12px; color: #64748B;">${t('扫码开启你的情绪之旅', 'Scan to start your journey')}</div>
                        <div style="font-size: 14px; font-weight: bold; color: #2C7BE5;">情绪宝</div>
                    </div>
                </div>

                <!-- 海报生成按钮 -->
                <button id="qx5_gen_poster_btn" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #E67E22; color: #fff; border: none; cursor: pointer; font-weight: bold; margin-bottom: 16px; display: flex; justify-content: center; align-items: center; gap: 8px;">
                    📸 ${t('生成专属心象海报', 'Generate Poster')}
                </button>

                <button class="qx5-btn qx5-btn-primary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #2C7BE5; color: #fff; border: none; cursor: pointer; margin-bottom: 16px;" onclick="window._pokerRestart()">
                    ${t('再抽一次', 'Draw Again')}
                </button>
                <button class="qx5-btn qx5-btn-secondary" style="width: 100%; padding: 16px; border-radius: 12px; font-size: 16px; background: #F1F5F9; color: #475569; border: none; cursor: pointer;" onclick="window.qx5_onExit()">
                    ${t('返回列表', 'Back to List')}
                </button>
            </div>
        `;

        if (window.qxSpeak) {
            setTimeout(() => {
                window.qxSpeak(t(`关于过去，你抽到了${pastWord}。关于现在，你看到了${presentWord}。关于未来，你抽到了${futureWord}。请抱抱自己。`, 
                                  `Past: ${pastWord}, Present: ${presentWord}, Future: ${futureWord}. Hug yourself.`));
            }, 500);
        }

        // 绑定生成海报按钮
        document.getElementById('qx5_gen_poster_btn').onclick = () => {
            const posterBox = document.getElementById('qx5_poster_box');
            if (!window.html2canvas) {
                alert(t('海报组件未加载，请刷新页面重试', 'Poster library not loaded, please refresh.'));
                return;
            }
            
            const btn = document.getElementById('qx5_gen_poster_btn');
            btn.innerText = t('海报生成中...', 'Generating...');

            window.html2canvas(posterBox, {
                scale: 2, 
                backgroundColor: null,
                useCORS: true
            }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box; backdrop-filter: blur(4px);';
                
                overlay.innerHTML = `
                    <div style="color: #fff; font-size: 16px; margin-bottom: 15px; font-weight: bold;">${t('长按图片保存到手机', 'Long press to save image')}</div>
                    <img src="${imgData}" style="max-width: 100%; max-height: 75vh; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
                    <button id="qx5_close_poster" style="margin-top: 20px; padding: 12px 30px; border-radius: 20px; background: #fff; color: #1E293B; border: none; font-weight: bold; font-size: 16px; cursor: pointer;">${t('完成', 'Done')}</button>
                `;
                
                document.body.appendChild(overlay);
                
                document.getElementById('qx5_close_poster').onclick = () => {
                    document.body.removeChild(overlay);
                };
                
                btn.innerHTML = `📸 ${t('生成专属心象海报', 'Generate Poster')}`;
            }).catch(err => {
                console.error('海报生成失败', err);
                alert(t('海报生成失败，请重试', 'Poster generation failed.'));
                btn.innerHTML = `📸 ${t('生成专属心象海报', 'Generate Poster')}`;
            });
        };
    }

    window._pokerRestart = function() {
        startPoker(document.getElementById('qx5_play_host'));
    };

    window._pokerStart = function(hostEl) {
        startPoker(hostEl);
    };
})();