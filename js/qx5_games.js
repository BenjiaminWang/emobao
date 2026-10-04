/* ================================================================
   情绪宝 - qx5 趣味测评 游戏库（第 1 批：闪电点击 + 色词打架）
   v2：
   - 闪电点击 onAnswer('hit', true)，让 correcttrials 正确统计
   - 其余同 v1
   ================================================================ */

   (function () {
    'use strict';

    if (!window.qx5Engine) {
        console.error('[qx5_games] 缺少 qx5Engine');
        return;
    }
    const E = window.qx5Engine;

    /* ================================================================
       游戏 1：闪电点击
       ================================================================ */
    E.registerGame({
        id: 'flash_click',
        collectionId: 'speed',
        title: { cn: '闪电点击', en: 'Flash Click' },
        subtitle: {
            cn: '你的反应，比闪电快吗？',
            en: 'Is your reaction faster than lightning?',
        },

        generateTrials: function () {
            const N = 20;
            const trials = [];
            for (let i = 0; i < N; i++) {
                trials.push({
                    id: 'fc_' + i,
                    condition: 'simple',
                    stimulus: { type: 'dot', delayMs: 800 + Math.random() * 1500 },
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题', 'Trial ' + meta.index + ' / ' + meta.total);
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const hint = document.createElement('div');
            hint.className = 'qx5-flash-hint';
            hint.innerText = E.t('准备好，圆点一出现就点它', 'Get ready — click the dot as soon as it appears');
            stage.appendChild(hint);

            const delay = (trial.stimulus && trial.stimulus.delayMs) || 1200;
            setTimeout(function () {
                hint.remove();
                const dot = document.createElement('div');
                dot.className = 'qx5-flash-dot';
                dot.innerText = E.t('点', 'GO');
                stage.appendChild(dot);

                let answered = false;
                dot.addEventListener('click', function () {
                    if (answered) return;
                    answered = true;
                    onAnswer('hit', true);
                }, { once: true });
            }, delay);
        },

        computeScore: function (data) {
            const rts = data.records
                .filter(r => r.response === 'hit' && r.reactiontimems > 0)
                .map(r => r.reactiontimems);
            if (!rts.length) {
                return { accuracy: 0, totalCount: data.records.length, correctCount: 0 };
            }
            const mean = E.mean(rts);
            const min = Math.min.apply(null, rts);
            const max = Math.max.apply(null, rts);
            const variance = rts.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rts.length;
            const sd = Math.sqrt(variance);

            return {
                accuracy: 1,
                correctCount: rts.length,
                totalCount: data.records.length,
                meanRT: Math.round(mean),
                minRT: Math.round(min),
                maxRT: Math.round(max),
                sdRT: Math.round(sd),
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';

            const speedText = (function () {
                if (s.meanRT < 250) return E.t('极快，接近世界级反应', 'Extremely fast');
                if (s.meanRT < 350) return E.t('很快，优于多数人', 'Very fast');
                if (s.meanRT < 450) return E.t('正常范围', 'Within normal range');
                if (s.meanRT < 600) return E.t('偏慢，多休息', 'A bit slow — take a rest');
                return E.t('较慢，累了？', 'Quite slow — tired?');
            })();

            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('闪电点击 · 结果', 'Flash Click · Result')}</div>
                <div class="qx5-result-hero">${s.meanRT} <span class="qx5-result-hero-unit">ms</span></div>
                <div class="qx5-result-sub">${E.t('平均反应时', 'Mean Reaction Time')}</div>
                <div class="qx5-result-row"><span>${E.t('最快', 'Fastest')}</span><b>${s.minRT} ms</b></div>
                <div class="qx5-result-row"><span>${E.t('最慢', 'Slowest')}</span><b>${s.maxRT} ms</b></div>
                <div class="qx5-result-row"><span>${E.t('稳定度（标准差）', 'Stability (SD)')}</span><b>${s.sdRT} ms</b></div>
                <div class="qx5-result-note">${speedText}</div>
                <div class="qx5-result-actions">
                    <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart">${E.t('再玩一次', 'Play Again')}</button>
                    <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit">${E.t('返回', 'Back')}</button>
                </div>
            `;
            hostEl.appendChild(wrap);
            document.getElementById('qx5_result_restart').onclick = () => E.restart();
            document.getElementById('qx5_result_exit').onclick = () => E.exit();
        },
    });


    /* ================================================================
       游戏 2：色词打架（Stroop）
       ================================================================ */
    const STROOP_COLORS = [
        { key: 'red',    cn: '红', en: 'Red',    hex: '#E53935' },
        { key: 'green',  cn: '绿', en: 'Green',  hex: '#2ECC71' },
        { key: 'blue',   cn: '蓝', en: 'Blue',   hex: '#2C7BE5' },
        { key: 'yellow', cn: '黄', en: 'Yellow', hex: '#F1C40F' },
    ];

    E.registerGame({
        id: 'stroop',
        collectionId: 'attention',
        title: { cn: '色词打架', en: 'Stroop' },
        subtitle: {
            cn: '字说红，颜色说蓝，你听谁？',
            en: 'The word says red, the ink says blue — which do you trust?',
        },

        generateTrials: function () {
            const N = 24;
            const trials = [];
            for (let i = 0; i < N; i++) {
                const wordColor = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
                let inkColor;
                let condition;
                if (i < N / 2) {
                    inkColor = wordColor;
                    condition = 'congruent';
                } else {
                    do {
                        inkColor = STROOP_COLORS[Math.floor(Math.random() * STROOP_COLORS.length)];
                    } while (inkColor.key === wordColor.key);
                    condition = 'incongruent';
                }
                trials.push({
                    id: 'st_' + i,
                    condition: condition,
                    stimulus: {
                        wordKey: wordColor.key,
                        wordCn: wordColor.cn,
                        wordEn: wordColor.en,
                        inkKey: inkColor.key,
                        inkHex: inkColor.hex,
                    },
                    correct: inkColor.key,
                });
            }
            return E.shuffle(trials);
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-stroop-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 按「颜色」作答', 'Trial ' + meta.index + ' / ' + meta.total + ' · Answer by COLOR');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-stroop-stage';
            hostEl.appendChild(stage);

            const word = document.createElement('div');
            word.className = 'qx5-stroop-word';
            word.style.color = trial.stimulus.inkHex;
            word.innerText = E.t(trial.stimulus.wordCn, trial.stimulus.wordEn).toUpperCase();
            stage.appendChild(word);

            const opts = document.createElement('div');
            opts.className = 'qx5-stroop-options';
            STROOP_COLORS.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'qx5-stroop-btn';
                btn.style.color = c.hex;
                btn.style.borderColor = c.hex;
                btn.innerText = E.t(c.cn, c.en);
                btn.onclick = () => onAnswer(c.key);
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            const recs = data.records;
            const okRecs = recs.filter(r => r.correct === true);
            const conRTs = okRecs.filter(r => r.condition === 'congruent').map(r => r.reactiontimems);
            const incRTs = okRecs.filter(r => r.condition === 'incongruent').map(r => r.reactiontimems);

            const meanCon = conRTs.length ? E.mean(conRTs) : 0;
            const meanInc = incRTs.length ? E.mean(incRTs) : 0;
            const cost = (conRTs.length && incRTs.length) ? Math.round(meanInc - meanCon) : 0;
            const total = recs.length;
            const correct = okRecs.length;

            return {
                accuracy: total ? correct / total : 0,
                correctCount: correct,
                totalCount: total,
                meanRT: Math.round(E.mean(okRecs.map(r => r.reactiontimems))),
                congruentRT: Math.round(meanCon),
                incongruentRT: Math.round(meanInc),
                conflictCost: cost,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';

            const costText = (function () {
                const c = s.conflictCost;
                if (c <= 30) return E.t('几乎不受干扰，抑制能力极强', 'Barely affected — strong inhibition');
                if (c <= 80) return E.t('轻微受干扰，属正常范围', 'Slightly affected — normal');
                if (c <= 150) return E.t('明显受干扰，注意易被打断', 'Clearly affected — attention easily disrupted');
                return E.t('干扰很大，可能有点累', 'Strongly affected — maybe tired');
            })();

            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('色词打架 · 结果', 'Stroop · Result')}</div>
                <div class="qx5-result-hero">${s.conflictCost} <span class="qx5-result-hero-unit">ms</span></div>
                <div class="qx5-result-sub">${E.t('冲突成本（不一致 - 一致）', 'Conflict Cost (Incongruent − Congruent)')}</div>
                <div class="qx5-result-row"><span>${E.t('正确率', 'Accuracy')}</span><b>${(s.accuracy * 100).toFixed(1)}%</b></div>
                <div class="qx5-result-row"><span>${E.t('一致 RT', 'Congruent RT')}</span><b>${s.congruentRT} ms</b></div>
                <div class="qx5-result-row"><span>${E.t('不一致 RT', 'Incongruent RT')}</span><b>${s.incongruentRT} ms</b></div>
                <div class="qx5-result-row"><span>${E.t('平均 RT', 'Mean RT')}</span><b>${s.meanRT} ms</b></div>
                <div class="qx5-result-note">${costText}</div>
                <div class="qx5-result-actions">
                    <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart">${E.t('再玩一次', 'Play Again')}</button>
                    <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit">${E.t('返回', 'Back')}</button>
                </div>
            `;
            hostEl.appendChild(wrap);
            document.getElementById('qx5_result_restart').onclick = () => E.restart();
            document.getElementById('qx5_result_exit').onclick = () => E.exit();
        },
    });

})();