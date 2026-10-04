/* ================================================================
   情绪宝 - qx5 趣味测评 游戏库（第 4 批：10 个游戏）
   v1：
   - 数字划消 / 找不同图 / 开关大师 / 情绪强度
   - 句子补全 / 摸黑记忆 / 类别切换 / 惊鸿一瞥
   - 秒表挑战 / 悖论选择
   - 依赖 qx5_engine.js
   ================================================================ */

   (function () {
    'use strict';

    if (!window.qx5Engine) {
        console.error('[qx5_games_extra3] 缺少 qx5Engine');
        return;
    }
    const E = window.qx5Engine;

    /* ================================================================
       1. 数字划消（注意 - 持续性注意）
       ================================================================ */
    E.registerGame({
        id: 'cancel_digit',
        collectionId: 'attention',
        title: { cn: '数字划消', en: 'Cancel Digits' },
        subtitle: {
            cn: '看到 3 就点它，其他别管',
            en: 'Tap 3 when you see it. Ignore the rest.',
        },

        generateTrials: function () {
            const trials = [];
            /* 每轮 40 个数字，混 8 个 3 */
            for (let r = 0; r < 4; r++) {
                const nums = [];
                for (let i = 0; i < 40; i++) nums.push(Math.floor(Math.random() * 9) + 1);
                /* 强行插入 8 个 3 */
                for (let i = 0; i < 8; i++) {
                    const idx = Math.floor(Math.random() * nums.length);
                    nums[idx] = 3;
                }
                trials.push({
                    id: 'cd_' + r,
                    condition: 'digit3',
                    stimulus: { nums: nums },
                    correct: 'all3',
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 轮 · 点掉所有 3', 'Round ' + meta.index + ' / ' + meta.total + ' · Cancel all 3s');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.padding = '12px';
            hostEl.appendChild(stage);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
            grid.style.gap = '4px';
            grid.style.width = '100%';
            grid.style.maxWidth = '360px';
            stage.appendChild(grid);

            let hits = 0, misses = 0, wrongClicks = 0;
            const startMs = E.nowMs();

            trial.stimulus.nums.forEach((n, i) => {
                const cell = document.createElement('div');
                cell.style.aspectRatio = '1';
                cell.style.background = '#fff';
                cell.style.border = '1px solid #E1E8F0';
                cell.style.borderRadius = '4px';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                cell.style.fontSize = '16px';
                cell.style.fontWeight = 'bold';
                cell.style.color = '#1A2B4A';
                cell.style.cursor = 'pointer';
                cell.style.userSelect = 'none';
                cell.innerText = n;

                cell.onclick = () => {
                    if (cell.classList.contains('done')) return;
                    cell.classList.add('done');
                    if (n === 3) {
                        hits++;
                        cell.style.background = '#E8F8F0';
                        cell.style.color = '#2ECC71';
                    } else {
                        wrongClicks++;
                        cell.style.background = '#FDEDEC';
                        cell.style.color = '#C0392B';
                    }
                    /* 8 个 3 全点完 + 用户点一次任意已点过的位置，来提交 */
                    if (hits >= 8) {
                        const elapsed = Math.round(E.nowMs() - startMs);
                        /* 等待用户下一步操作，防止误触 */
                        setTimeout(() => {
                            if (cell.__reported) return;
                            cell.__reported = true;
                        }, 0);
                    }
                };
                grid.appendChild(cell);
            });

            /* 底部提交按钮 */
            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-primary';
            btn.style.marginTop = '12px';
            btn.style.maxWidth = '200px';
            btn.innerText = E.t('完成', 'Done');
            btn.onclick = () => {
                const elapsed = Math.round(E.nowMs() - startMs);
                const correct = (hits >= 8 && wrongClicks === 0);
                onAnswer(JSON.stringify({ hits: hits, wrongClicks: wrongClicks, elapsed: elapsed }), correct);
            };
            hostEl.appendChild(btn);
        },

        computeScore: function (data) {
            let totalHits = 0, totalWrong = 0, totalElapsed = 0;
            data.records.forEach(r => {
                try {
                    const info = JSON.parse(r.response);
                    totalHits += info.hits || 0;
                    totalWrong += info.wrongClicks || 0;
                    totalElapsed += info.elapsed || 0;
                } catch (e) {}
            });
            return {
                accuracy: 1,
                correctCount: totalHits,
                totalCount: totalHits + totalWrong,
                hits: totalHits,
                wrongClicks: totalWrong,
                elapsed: totalElapsed,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('数字划消 · 结果', 'Cancel Digits · Result')}</div>
                <div class="qx5-result-hero">${s.hits} <span class="qx5-result-hero-unit">${E.t('次命中', 'hits')}</span></div>
                <div class="qx5-result-sub">${E.t('正确点掉的 3', 'Correct 3s tapped')}</div>
                <div class="qx5-result-row"><span>${E.t('误点数', 'Wrong clicks')}</span><b>${s.wrongClicks}</b></div>
                <div class="qx5-result-row"><span>${E.t('总用时', 'Total time')}</span><b>${(s.elapsed/1000).toFixed(1)} s</b></div>
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
       2. 找不同图（注意 - 视觉对比）
       ================================================================ */
    E.registerGame({
        id: 'spot_diff_color',
        collectionId: 'attention',
        title: { cn: '找不同图', en: 'Spot the Difference' },
        subtitle: {
            cn: '两幅图，找出颜色不同的那一格',
            en: 'Two grids — find the different cell',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 10; i++) {
                const cols = 6;
                const rows = 6;
                const baseColor = ['#4CAF50', '#2C7BE5', '#E53935', '#FFB300', '#9C27B0'][i % 5];
                const pool = ['#4CAF50', '#2C7BE5', '#E53935', '#FFB300', '#9C27B0'];
                const oddColor = pool[(pool.indexOf(baseColor) + 1 + (i % 3)) % pool.length];
                const oddIdx = Math.floor(Math.random() * cols * rows);
                trials.push({
                    id: 'sdc_' + i,
                    condition: 'grid',
                    stimulus: { baseColor, oddColor, oddIdx, cols, rows },
                    correct: String(oddIdx),
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 找出颜色不同的那一格', 'Trial ' + meta.index + ' / ' + meta.total + ' · Find the different cell');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(' + trial.stimulus.cols + ', 1fr)';
            grid.style.gap = '4px';
            grid.style.width = '90%';
            grid.style.maxWidth = '360px';
            grid.style.aspectRatio = '1';
            stage.appendChild(grid);

            const total = trial.stimulus.cols * trial.stimulus.rows;
            for (let i = 0; i < total; i++) {
                const cell = document.createElement('div');
                cell.style.background = (i === trial.stimulus.oddIdx) ? trial.stimulus.oddColor : trial.stimulus.baseColor;
                cell.style.borderRadius = '4px';
                cell.style.cursor = 'pointer';
                cell.onclick = () => onAnswer(String(i));
                grid.appendChild(cell);
            }
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            const rts = ok.map(r => r.reactiontimems);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                meanRT: Math.round(E.mean(rts)),
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('找不同图 · 结果', 'Spot the Difference · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
                <div class="qx5-result-row"><span>${E.t('平均 RT', 'Mean RT')}</span><b>${s.meanRT} ms</b></div>
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
       3. 开关大师（逻辑 - 规划）
       ================================================================ */
    E.registerGame({
        id: 'switch_master',
        collectionId: 'logic',
        title: { cn: '开关大师', en: 'Switch Master' },
        subtitle: {
            cn: '用最少步数，把所有灯点亮',
            en: 'Light all bulbs in as few moves as possible',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 6; i++) {
                const size = 3;
                const bulbs = new Array(size * size).fill(false);
                for (let j = 0; j < bulbs.length; j++) bulbs[j] = Math.random() < 0.5;
                trials.push({
                    id: 'sm_' + i,
                    condition: 'grid3',
                    stimulus: { size, bulbs },
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'sm_top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 关 · 点一次翻转自己和上下左右', 'Level ' + meta.index + ' / ' + meta.total + ' · Toggle self and neighbors');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const size = trial.stimulus.size;
            const state = trial.stimulus.bulbs.slice();
            let moves = 0;
            const startMs = E.nowMs();

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
            grid.style.gap = '8px';
            grid.style.width = '240px';
            stage.appendChild(grid);

            const cells = [];
            const render = () => {
                cells.forEach((c, i) => {
                    c.style.background = state[i] ? '#FFD600' : '#E1E8F0';
                });
            };

            const toggle = (r, c) => {
                const dirs = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];
                dirs.forEach(([dr, dc]) => {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                        state[nr * size + nc] = !state[nr * size + nc];
                    }
                });
            };

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const cell = document.createElement('div');
                    cell.style.aspectRatio = '1';
                    cell.style.borderRadius = '8px';
                    cell.style.cursor = 'pointer';
                    cell.style.transition = 'background 0.15s';
                    cell.style.userSelect = 'none';
                    cell.onclick = () => {
                        toggle(r, c);
                        moves++;
                        render();
                        if (state.every(v => v)) {
                            const elapsed = Math.round(E.nowMs() - startMs);
                            onAnswer(JSON.stringify({ moves: moves, elapsed: elapsed }), true);
                        }
                    };
                    grid.appendChild(cell);
                    cells.push(cell);
                }
            }
            render();

            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-secondary';
            btn.style.marginTop = '16px';
            btn.style.maxWidth = '200px';
            btn.innerText = E.t('放弃', 'Give Up');
            btn.onclick = () => {
                onAnswer(JSON.stringify({ moves: moves, elapsed: Math.round(E.nowMs() - startMs) }), false);
            };
            hostEl.appendChild(btn);
        },

        computeScore: function (data) {
            const recs = data.records;
            const solved = recs.filter(r => r.correct === true).length;
            let totalMoves = 0;
            recs.forEach(r => {
                try {
                    const info = JSON.parse(r.response);
                    totalMoves += info.moves || 0;
                } catch (e) {}
            });
            return {
                accuracy: recs.length ? solved / recs.length : 0,
                correctCount: solved,
                totalCount: recs.length,
                totalMoves: totalMoves,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('开关大师 · 结果', 'Switch Master · Result')}</div>
                <div class="qx5-result-hero">${s.correctCount} / ${s.totalCount}</div>
                <div class="qx5-result-sub">${E.t('点亮的关卡', 'Levels solved')}</div>
                <div class="qx5-result-row"><span>${E.t('总步数', 'Total moves')}</span><b>${s.totalMoves}</b></div>
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
       4. 情绪强度（情绪 - 强度评分）
       ================================================================ */
    E.registerGame({
        id: 'emotion_intensity',
        collectionId: 'emotion',
        title: { cn: '情绪强度', en: 'Emotion Intensity' },
        subtitle: {
            cn: '这张脸，情绪有多强烈？',
            en: 'How intense is this face?',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const key = 1 + Math.floor(Math.random() * 9);
                const intensity = 1 + Math.floor(Math.random() * 4);   /* 1-4 */
                trials.push({
                    id: 'ei_' + i,
                    condition: 'emo_' + key,
                    stimulus: { key: key, intensity: intensity },
                    correct: String(intensity),
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 情绪有多强烈', 'Trial ' + meta.index + ' / ' + meta.total + ' · How intense');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const face = document.createElement('div');
            face.style.width = '120px';
            face.style.height = '120px';
            face.style.borderRadius = '50%';
            const color = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[trial.stimulus.key]) || '#2C7BE5';
            face.style.background = color;
            face.style.display = 'flex';
            face.style.alignItems = 'center';
            face.style.justifyContent = 'center';
            face.style.fontSize = '48px';
            face.style.color = '#fff';
            face.style.opacity = 0.4 + trial.stimulus.intensity * 0.15;
            face.innerText = ['😐','🙂','😊','😄'][trial.stimulus.intensity - 1];
            stage.appendChild(face);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = 'repeat(4, 1fr)';
            const labels = [E.t('轻', 'Mild'), E.t('中', 'Medium'), E.t('重', 'Strong'), E.t('极重', 'Extreme')];
            labels.forEach((label, i) => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.borderColor = color;
                btn.style.color = color;
                btn.innerText = label;
                btn.onclick = () => onAnswer(String(i + 1));
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('情绪强度 · 结果', 'Emotion Intensity · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
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
       5. 句子补全（语言 - 语言理解）
       ================================================================ */
    const SENTENCES = [
        { q: '雨下得很大，____ 都湿透了。', opts: ['衣服', '心情', '太阳'], a: '衣服' },
        { q: '他饿了一天，最想做的事是 ____。', opts: ['吃饭', '跑步', '睡觉'], a: '吃饭' },
        { q: '考试快到了，她每天都在 ____。', opts: ['复习', '逛街', '游泳'], a: '复习' },
        { q: '外面下雪了，路上都是 ____。', opts: ['白色', '红色', '绿色'], a: '白色' },
        { q: '太阳下山了，天慢慢 ____。', opts: ['黑了', '亮了', '红了'], a: '黑了' },
        { q: '他跑得太快，一出门就 ____。', opts: ['摔倒了', '睡着了', '看书了'], a: '摔倒了' },
        { q: '她做了个蛋糕，闻起来很 ____。', opts: ['香', '苦', '酸'], a: '香' },
        { q: '开门之前，先要找到 ____。', opts: ['钥匙', '手机', '钱包'], a: '钥匙' },
    ];

    E.registerGame({
        id: 'sentence_fill',
        collectionId: 'language',
        title: { cn: '句子补全', en: 'Sentence Fill' },
        subtitle: {
            cn: '缺的那半句，是什么？',
            en: 'Which word fits best?',
        },

        generateTrials: function () {
            return E.shuffle(SENTENCES.map((s, i) => ({
                id: 'sf_' + i,
                condition: 'fill',
                stimulus: { q: s.q, opts: s.opts },
                correct: s.a,
            })));
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 选一个最合适的词', 'Trial ' + meta.index + ' / ' + meta.total + ' · Pick the best word');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const q = document.createElement('div');
            q.style.fontSize = '20px';
            q.style.padding = '20px';
            q.style.textAlign = 'center';
            q.style.color = '#1A2B4A';
            q.style.lineHeight = '1.6';
            q.innerText = trial.stimulus.q;
            stage.appendChild(q);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = 'repeat(3, 1fr)';
            trial.stimulus.opts.forEach(o => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.borderColor = '#2C7BE5';
                btn.style.color = '#2C7BE5';
                btn.innerText = o;
                btn.onclick = () => onAnswer(o);
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            const rts = ok.map(r => r.reactiontimems);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                meanRT: Math.round(E.mean(rts)),
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('句子补全 · 结果', 'Sentence Fill · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
                <div class="qx5-result-row"><span>${E.t('平均 RT', 'Mean RT')}</span><b>${s.meanRT} ms</b></div>
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
       6. 摸黑记忆（记忆 - 空间短时记忆）
       ================================================================ */
    E.registerGame({
        id: 'blind_memory',
        collectionId: 'memory',
        title: { cn: '摸黑记忆', en: 'Blind Memory' },
        subtitle: {
            cn: '看一眼亮点，记住它在哪',
            en: 'Glance at the dot — remember where it is',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 10; i++) {
                const N = 5;
                const count = 3 + Math.floor(i / 4);   /* 3, 3, 3, 3, 4, 4, 4, 4, 5, 5 */
                const positions = [];
                while (positions.length < count) {
                    const p = Math.floor(Math.random() * N * N);
                    if (positions.indexOf(p) < 0) positions.push(p);
                }
                trials.push({
                    id: 'bm2_' + i,
                    condition: 'count' + count,
                    stimulus: { N: N, positions: positions },
                    correct: JSON.stringify(positions.sort((a,b)=>a-b)),
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'bm2_top';
            top.innerText = E.t('看仔细：记住亮点位置', 'Watch: remember the dots');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const N = trial.stimulus.N;
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(' + N + ', 1fr)';
            grid.style.gap = '6px';
            grid.style.width = '280px';
            grid.style.height = '280px';
            stage.appendChild(grid);

            const cells = [];
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const cell = document.createElement('div');
                    cell.style.background = '#fff';
                    cell.style.border = '1px solid #E1E8F0';
                    cell.style.borderRadius = '4px';
                    cell.dataset.idx = r * N + c;
                    grid.appendChild(cell);
                    cells.push(cell);
                }
            }

            /* 显示亮点 */
            trial.stimulus.positions.forEach(p => { cells[p].style.background = '#2C7BE5'; });
            setTimeout(() => {
                cells.forEach(c => c.style.background = '#fff');
                document.getElementById('bm2_top').innerText = E.t('点出刚才亮点位置（顺序不限）', 'Tap the positions you saw');
            }, 1500);

            let userPicked = [];
            const reveal = setTimeout(() => {}, 0);
            cells.forEach(cell => {
                cell.onclick = () => {
                    if (document.getElementById('bm2_top').innerText.indexOf('点出') < 0) return;
                    const idx = parseInt(cell.dataset.idx);
                    if (userPicked.indexOf(idx) >= 0) return;
                    userPicked.push(idx);
                    cell.style.background = '#2ECC71';
                    if (userPicked.length === trial.stimulus.positions.length) {
                        const sorted = userPicked.slice().sort((a,b)=>a-b);
                        const expected = trial.stimulus.positions.slice().sort((a,b)=>a-b);
                        const match = JSON.stringify(sorted) === JSON.stringify(expected);
                        onAnswer(JSON.stringify({ picked: userPicked }), match);
                    }
                };
            });
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('摸黑记忆 · 结果', 'Blind Memory · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
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
       7. 类别切换（执行功能 - 认知灵活性）
       ================================================================ */
    E.registerGame({
        id: 'category_switch',
        collectionId: 'attention',
        title: { cn: '类别切换', en: 'Category Switch' },
        subtitle: {
            cn: '这次按颜色，下次按形状',
            en: 'Now by color, next by shape',
        },

        generateTrials: function () {
            const trials = [];
            const colors = [
                { name: '红', color: '#E53935' },
                { name: '蓝', color: '#2C7BE5' },
                { name: '绿', color: '#2ECC71' },
            ];
            const shapes = ['●', '■', '▲'];
            for (let i = 0; i < 16; i++) {
                const c = colors[Math.floor(Math.random() * colors.length)];
                const s = shapes[Math.floor(Math.random() * shapes.length)];
                const rule = (i % 2 === 0) ? 'color' : 'shape';
                trials.push({
                    id: 'cs_' + i,
                    condition: rule,
                    stimulus: { color: c, shape: s, rule: rule },
                    correct: rule === 'color' ? c.name : s,
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            const rule = trial.stimulus.rule === 'color' ? E.t('按颜色', 'By COLOR') : E.t('按形状', 'By SHAPE');
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · ' + rule, 'Trial ' + meta.index + ' / ' + meta.total + ' · ' + rule);
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const sym = document.createElement('div');
            sym.style.fontSize = '90px';
            sym.style.color = trial.stimulus.color.color;
            sym.style.fontWeight = '900';
            sym.innerText = trial.stimulus.shape;
            stage.appendChild(sym);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = 'repeat(3, 1fr)';

            const choices = trial.stimulus.rule === 'color'
                ? ['红', '蓝', '绿']
                : ['●', '■', '▲'];
            choices.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.borderColor = '#2C7BE5';
                btn.style.color = '#2C7BE5';
                btn.style.fontSize = trial.stimulus.rule === 'shape' ? '20px' : '14px';
                btn.innerText = c;
                btn.onclick = () => onAnswer(c);
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            const colorRT = recs.filter(r => r.condition === 'color' && r.correct).map(r => r.reactiontimems);
            const shapeRT = recs.filter(r => r.condition === 'shape' && r.correct).map(r => r.reactiontimems);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                colorMeanRT: Math.round(E.mean(colorRT)),
                shapeMeanRT: Math.round(E.mean(shapeRT)),
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('类别切换 · 结果', 'Category Switch · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('按颜色 RT', 'Color RT')}</span><b>${s.colorMeanRT} ms</b></div>
                <div class="qx5-result-row"><span>${E.t('按形状 RT', 'Shape RT')}</span><b>${s.shapeMeanRT} ms</b></div>
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
       8. 惊鸿一瞥（记忆 - 快速呈现）
       ================================================================ */
    E.registerGame({
        id: 'flash_glimpse',
        collectionId: 'memory',
        title: { cn: '惊鸿一瞥', en: 'Flash Glimpse' },
        subtitle: {
            cn: '只看一眼，你记住了什么？',
            en: 'A single glimpse — what do you remember?',
        },

        generateTrials: function () {
            const trials = [];
            const emojis = ['🍎','🍌','🍇','🚗','🏠','☀️','🌙','⭐','🐱','🐶','🌈','🎵'];
            for (let i = 0; i < 10; i++) {
                const count = 3 + Math.floor(i / 4);
                const pool = E.shuffle(emojis);
                const shown = pool.slice(0, count);
                const notShown = pool.slice(count, count + 2);
                const choices = E.shuffle(shown.concat(notShown));
                const target = shown[Math.floor(Math.random() * shown.length)];
                trials.push({
                    id: 'fg_' + i,
                    condition: 'count' + count,
                    stimulus: { shown: shown, choices: choices, target: target },
                    correct: target,
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'fg_top';
            top.innerText = E.t('看仔细', 'Watch carefully');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const view = document.createElement('div');
            view.style.fontSize = '48px';
            view.style.display = 'flex';
            view.style.gap = '12px';
            view.style.flexWrap = 'wrap';
            view.style.justifyContent = 'center';
            view.innerText = trial.stimulus.shown.join(' ');
            stage.appendChild(view);

            setTimeout(() => {
                stage.innerHTML = '';
                document.getElementById('fg_top').innerText = E.t('刚才看到过哪个？', 'Which one did you see?');
                const opts = document.createElement('div');
                opts.className = 'qx5-face-options';
                opts.style.gridTemplateColumns = 'repeat(3, 1fr)';
                trial.stimulus.choices.forEach(c => {
                    const btn = document.createElement('button');
                    btn.className = 'qx5-face-btn';
                    btn.style.borderColor = '#2C7BE5';
                    btn.style.color = '#2C7BE5';
                    btn.style.fontSize = '28px';
                    btn.innerText = c;
                    btn.onclick = () => onAnswer(c);
                    opts.appendChild(btn);
                });
                stage.appendChild(opts);
            }, 1200);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('惊鸿一瞥 · 结果', 'Flash Glimpse · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
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
       9. 秒表挑战（时间 - 时间知觉）
       ================================================================ */
    E.registerGame({
        id: 'stopwatch',
        collectionId: 'time',
        title: { cn: '秒表挑战', en: 'Stopwatch Challenge' },
        subtitle: {
            cn: '不看表，估出 10 秒',
            en: 'No watch — estimate 10 seconds',
        },

        generateTrials: function () {
            return [{ id: 'sw_one', condition: 'estimate', stimulus: { targetSec: 10, rounds: 3 } }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'sw_top';
            top.innerText = E.t('第 1 / 3 轮 · 点「开始」后默数 10 秒', 'Round 1 / 3 · Tap Start, then count to 10 seconds');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.flexDirection = 'column';
            stage.style.gap = '16px';
            hostEl.appendChild(stage);

            const circle = document.createElement('div');
            circle.style.width = '120px';
            circle.style.height = '120px';
            circle.style.borderRadius = '50%';
            circle.style.background = '#E1E8F0';
            circle.style.transition = 'background 0.15s';
            stage.appendChild(circle);

            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-primary';
            btn.style.padding = '12px 32px';
            btn.style.height = 'auto';
            btn.style.maxWidth = '240px';
            btn.innerText = E.t('开始', 'Start');
            stage.appendChild(btn);

            let round = 0;
            let running = false;
            let startMs = 0;
            const durations = [];
            const targetMs = trial.stimulus.targetSec * 1000;
            const rounds = trial.stimulus.rounds;

            btn.onclick = () => {
                if (!running) {
                    running = true;
                    startMs = E.nowMs();
                    circle.style.background = '#2C7BE5';
                    btn.innerText = E.t('到了，点我', 'Stop!');
                } else {
                    const elapsed = E.nowMs() - startMs;
                    durations.push(elapsed);
                    circle.style.background = '#E1E8F0';
                    round++;
                    running = false;
                    if (round >= rounds) {
                        /* 计算误差 */
                        const errs = durations.map(d => Math.abs(d - targetMs));
                        const avgErr = Math.round(E.mean(errs) / 1000 * 10) / 10;
                        onAnswer(JSON.stringify({
                            durations: durations,
                            targetMs: targetMs,
                            avgErrSec: avgErr,
                        }), avgErr <= 1.5);
                        return;
                    }
                    document.getElementById('sw_top').innerText = E.t('第 ' + (round + 1) + ' / ' + rounds + ' 轮 · 点「开始」后默数 10 秒', 'Round ' + (round + 1) + ' / ' + rounds + ' · Estimate 10 seconds');
                    btn.innerText = E.t('开始', 'Start');
                }
            };
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { durations: [], avgErrSec: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: 1,
                totalCount: 1,
                durations: info.durations,
                avgErrSec: info.avgErrSec,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                const e = s.avgErrSec;
                if (e <= 0.5) return E.t('时间知觉极准', 'Superb time sense');
                if (e <= 1) return E.t('很准', 'Very accurate');
                if (e <= 2) return E.t('正常范围', 'Normal');
                return E.t('可以再多练练', 'Practice helps');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('秒表挑战 · 结果', 'Stopwatch Challenge · Result')}</div>
                <div class="qx5-result-hero">${s.avgErrSec} <span class="qx5-result-hero-unit">s</span></div>
                <div class="qx5-result-sub">${E.t('平均偏差（10 秒）', 'Average error (vs 10s)')}</div>
                <div class="qx5-result-note">${txt}</div>
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
       10. 悖论选择（决策 - 道德/偏好）
       ================================================================ */
    const PARADOX_QUESTIONS = [
        { q: '一辆电车即将撞向 5 个人，你可以拉杆让它转向另 1 个人。你拉吗？',
          opts: ['拉，救 5 人', '不拉，不主动'] },
        { q: '你会为了一辈子的富有，放弃所有朋友吗？',
          opts: ['会', '不会'] },
        { q: '如果知道一段感情最终会分开，你还愿意开始吗？',
          opts: ['愿意', '不愿意'] },
        { q: '有个按钮，按下去你能得到 100 万，但地球上随机有 1 个人会死。按吗？',
          opts: ['按', '不按'] },
        { q: '你可以选择：现在得到 10 万，或一年后有 50% 概率得到 100 万。选哪个？',
          opts: ['现在 10 万', '赌一年后'] },
        { q: '如果删除一段不愉快的记忆，你就会失去和它相关的所有情感体验，还删吗？',
          opts: ['删', '不删'] },
    ];

    E.registerGame({
        id: 'paradox_choice',
        collectionId: 'decision',
        title: { cn: '悖论选择', en: 'Paradox Choice' },
        subtitle: {
            cn: '两个都对，你选哪个？',
            en: 'Both seem right — which would you pick?',
        },

        generateTrials: function () {
            return PARADOX_QUESTIONS.map((p, i) => ({
                id: 'pc_' + i,
                condition: 'dilemma',
                stimulus: { q: p.q, opts: p.opts },
            }));
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

            const q = document.createElement('div');
            q.style.fontSize = '18px';
            q.style.padding = '20px';
            q.style.textAlign = 'center';
            q.style.color = '#1A2B4A';
            q.style.lineHeight = '1.7';
            q.style.maxWidth = '90%';
            q.innerText = trial.stimulus.q;
            stage.appendChild(q);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = '1fr 1fr';
            trial.stimulus.opts.forEach(o => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.borderColor = '#2C7BE5';
                btn.style.color = '#2C7BE5';
                btn.style.padding = '14px';
                btn.style.fontSize = '14px';
                btn.innerText = o;
                btn.onclick = () => onAnswer(o);
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            return {
                accuracy: 1,
                correctCount: data.records.length,
                totalCount: data.records.length,
            };
        },

        renderResult: function (hostEl, data) {
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            const records = data.records;
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('悖论选择 · 你的选择', 'Paradox Choice · Your Choices')}</div>
                <div class="qx5-result-sub">${E.t('没有标准答案，只有你的偏好', 'No right answer — only your preference')}</div>
                ${records.map((r, i) => `
                    <div class="qx5-result-row">
                        <span>${E.t('第', 'Q')} ${i+1} ${E.t('题', '')}</span>
                        <b>${r.response}</b>
                    </div>
                `).join('')}
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