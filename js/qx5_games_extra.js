/* ================================================================
   情绪宝 - qx5 趣味测评 游戏库（第 2 批：8 个新游戏）
   v2：
   - 开关大师修正为"从全亮随机点"保证可解
   - 开关大师放弃按钮缩小居中
   - 综合闯关升级为 5 关随机（9 类池）
   - 其余同 v1
   ================================================================ */

   (function () {
    'use strict';

    if (!window.qx5Engine) {
        console.error('[qx5_games_extra] 缺少 qx5Engine');
        return;
    }
    const E = window.qx5Engine;

    /* ================================================================
       1. 数字天梯（记忆 - 数字广度）
       ================================================================ */
    E.registerGame({
        id: 'digit_ladder',
        collectionId: 'memory',
        title: { cn: '数字天梯', en: 'Digit Ladder' },
        subtitle: {
            cn: '数字越长，你能爬到几层？',
            en: 'How high can you climb the ladder?',
        },

        generateTrials: function () {
            const trials = [];
            let len = 3;
            let tries = 0;
            for (let i = 0; i < 20; i++) {
                let s = '';
                for (let j = 0; j < len; j++) {
                    s += Math.floor(Math.random() * 10);
                }
                trials.push({
                    id: 'dl_' + i,
                    condition: 'len_' + len,
                    stimulus: { digits: s, len: len },
                    correct: s,
                });
                tries++;
                if (tries >= 2) {
                    len++;
                    tries = 0;
                }
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · ' + trial.stimulus.len + ' 位数字', 'Trial ' + meta.index + ' / ' + meta.total + ' · ' + trial.stimulus.len + ' digits');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const show = document.createElement('div');
            show.style.fontSize = '56px';
            show.style.fontWeight = '900';
            show.style.letterSpacing = '12px';
            show.style.color = '#2C7BE5';
            show.innerText = trial.stimulus.digits;
            stage.appendChild(show);

            setTimeout(function () {
                stage.innerHTML = '';
                const input = document.createElement('input');
                input.type = 'text';
                input.inputMode = 'numeric';
                input.autocomplete = 'off';
                input.style.fontSize = '32px';
                input.style.padding = '12px 20px';
                input.style.borderRadius = '10px';
                input.style.border = '2px solid #2C7BE5';
                input.style.textAlign = 'center';
                input.style.letterSpacing = '8px';
                input.style.width = '70%';
                input.style.maxWidth = '400px';
                input.style.fontFamily = 'inherit';
                input.placeholder = E.t('输入刚才的数字', 'Type the digits');
                stage.appendChild(input);
                input.focus();

                const btn = document.createElement('button');
                btn.className = 'qx5-btn qx5-btn-primary';
                btn.style.marginTop = '16px';
                btn.style.maxWidth = '200px';
                btn.innerText = E.t('确定', 'Submit');
                stage.appendChild(btn);

                const submit = () => {
                    onAnswer(input.value.trim());
                };
                btn.onclick = submit;
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') submit();
                });
            }, 2000);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            let maxLen = 0;
            ok.forEach(r => {
                const m = String(r.condition || '').match(/len_(\d+)/);
                if (m) {
                    const n = parseInt(m[1]);
                    if (n > maxLen) maxLen = n;
                }
            });
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                maxSpan: maxLen,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const levelText = (function () {
                if (s.maxSpan >= 9) return E.t('工作记忆容量非常出色', 'Excellent working memory');
                if (s.maxSpan >= 7) return E.t('高于平均水平（平均 7 位左右）', 'Above average (~7)');
                if (s.maxSpan >= 5) return E.t('正常范围', 'Within normal range');
                return E.t('偏低，可能有点累', 'Below average — maybe tired');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('数字天梯 · 结果', 'Digit Ladder · Result')}</div>
                <div class="qx5-result-hero">${s.maxSpan} <span class="qx5-result-hero-unit">${E.t('位', 'digits')}</span></div>
                <div class="qx5-result-sub">${E.t('最长正确位数', 'Longest correct span')}</div>
                <div class="qx5-result-row"><span>${E.t('正确率', 'Accuracy')}</span><b>${(s.accuracy * 100).toFixed(1)}%</b></div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
                <div class="qx5-result-note">${levelText}</div>
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
       2. 翻牌配对（记忆 - 视觉情景记忆）
       ================================================================ */
    const CARD_SYMBOLS = ['🌞','🌙','⭐','🔥','💧','🌿','🍀','🎵'];

    E.registerGame({
        id: 'memory_match',
        collectionId: 'memory',
        title: { cn: '翻牌配对', en: 'Memory Match' },
        subtitle: {
            cn: '翻开的每一张，都是线索',
            en: 'Every card is a clue',
        },

        generateTrials: function () {
            const deck = [];
            CARD_SYMBOLS.forEach((sym, i) => {
                deck.push({ id: 'c_' + i + '_a', sym: sym });
                deck.push({ id: 'c_' + i + '_b', sym: sym });
            });
            const shuffled = E.shuffle(deck);
            return [{ id: 'match_all', condition: 'grid', stimulus: { deck: shuffled } }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('翻开两张相同的牌配对，共 8 对', 'Flip two matching cards. 8 pairs total.');
            hostEl.appendChild(top);

            const grid = document.createElement('div');
            grid.className = 'qx5-match-grid';
            hostEl.appendChild(grid);

            const deck = trial.stimulus.deck;
            let firstCard = null;
            let matched = 0;
            let moves = 0;
            let locked = false;
            const startMs = E.nowMs();

            deck.forEach((card, i) => {
                const el = document.createElement('div');
                el.className = 'qx5-match-card';
                el.dataset.sym = card.sym;
                el.dataset.idx = i;
                el.innerText = '?';
                el.onclick = function () {
                    if (locked) return;
                    if (el.classList.contains('matched')) return;
                    if (el.classList.contains('flipped')) return;
                    el.classList.add('flipped');
                    el.innerText = card.sym;

                    if (!firstCard) {
                        firstCard = el;
                        return;
                    }
                    moves++;
                    if (firstCard.dataset.sym === el.dataset.sym) {
                        firstCard.classList.add('matched');
                        el.classList.add('matched');
                        matched++;
                        firstCard = null;
                        if (matched === CARD_SYMBOLS.length) {
                            const elapsed = Math.round(E.nowMs() - startMs);
                            onAnswer(JSON.stringify({ moves: moves, elapsed: elapsed, matched: matched }), true);
                        }
                    } else {
                        locked = true;
                        const f = firstCard;
                        setTimeout(function () {
                            f.classList.remove('flipped');
                            f.innerText = '?';
                            el.classList.remove('flipped');
                            el.innerText = '?';
                            firstCard = null;
                            locked = false;
                        }, 700);
                    }
                };
                grid.appendChild(el);
            });
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { moves: 0, elapsed: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: 1,
                totalCount: 1,
                moves: info.moves,
                elapsed: info.elapsed,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                if (s.moves <= 10) return E.t('几乎完美，记忆超群', 'Nearly perfect — excellent memory');
                if (s.moves <= 14) return E.t('表现很好', 'Very good');
                if (s.moves <= 20) return E.t('正常范围', 'Normal range');
                return E.t('多用了一点时间', 'A bit slow');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('翻牌配对 · 结果', 'Memory Match · Result')}</div>
                <div class="qx5-result-hero">${s.moves} <span class="qx5-result-hero-unit">${E.t('步', 'moves')}</span></div>
                <div class="qx5-result-sub">${E.t('翻牌次数', 'Total Moves')}</div>
                <div class="qx5-result-row"><span>${E.t('用时', 'Time')}</span><b>${(s.elapsed/1000).toFixed(1)} s</b></div>
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
       3. 舒尔特风暴（注意 - 视觉搜索）
       ================================================================ */
    E.registerGame({
        id: 'schulte',
        collectionId: 'attention',
        title: { cn: '舒尔特风暴', en: 'Schulte Grid' },
        subtitle: {
            cn: '1 到 25，你能多快找完？',
            en: 'Find 1 to 25 as fast as you can',
        },

        generateTrials: function () {
            return [{ id: 'schulte_one', condition: 'grid5', stimulus: {} }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'schulte_next_label';
            top.innerText = E.t('下一个：1', 'Next: 1');
            hostEl.appendChild(top);

            const grid = document.createElement('div');
            grid.className = 'qx5-schulte-grid';
            hostEl.appendChild(grid);

            const N = 5;
            const nums = [];
            for (let i = 1; i <= N * N; i++) nums.push(i);
            const shuffled = E.shuffle(nums);

            let next = 1;
            let errors = 0;
            const startMs = E.nowMs();

            shuffled.forEach(n => {
                const el = document.createElement('div');
                el.className = 'qx5-schulte-cell';
                el.innerText = n;
                el.onclick = function () {
                    if (n !== next) {
                        errors++;
                        el.classList.add('wrong');
                        setTimeout(() => el.classList.remove('wrong'), 300);
                        return;
                    }
                    el.classList.add('done');
                    next++;
                    if (next > N * N) {
                        const elapsed = Math.round(E.nowMs() - startMs);
                        onAnswer(JSON.stringify({ elapsed: elapsed, errors: errors }), true);
                        return;
                    }
                    document.getElementById('schulte_next_label').innerText = E.t('下一个：' + next, 'Next: ' + next);
                };
                grid.appendChild(el);
            });
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { elapsed: 0, errors: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: 1,
                totalCount: 1,
                elapsed: info.elapsed,
                errors: info.errors,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                const sec = s.elapsed / 1000;
                if (sec <= 20) return E.t('注意力极佳', 'Excellent attention');
                if (sec <= 30) return E.t('优于多数人', 'Above average');
                if (sec <= 45) return E.t('正常范围', 'Normal range');
                return E.t('再练练会更快', 'Practice will help');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('舒尔特风暴 · 结果', 'Schulte Grid · Result')}</div>
                <div class="qx5-result-hero">${(s.elapsed/1000).toFixed(1)} <span class="qx5-result-hero-unit">s</span></div>
                <div class="qx5-result-sub">${E.t('完成时间', 'Time')}</div>
                <div class="qx5-result-row"><span>${E.t('错误次数', 'Errors')}</span><b>${s.errors}</b></div>
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
       4. 面孔读心（情绪识别）
       ================================================================ */
    const FACE_EMOTIONS = [
        { key: 1, name: '焦躁', nameEn: 'Irritable' },
        { key: 2, name: '热烈', nameEn: 'Passionate' },
        { key: 3, name: '欢快', nameEn: 'Cheerful' },
        { key: 4, name: '轻快', nameEn: 'Lively' },
        { key: 5, name: '明朗', nameEn: 'Bright' },
        { key: 6, name: '平静', nameEn: 'Calm' },
        { key: 7, name: '压抑', nameEn: 'Depressed' },
        { key: 8, name: '忧伤', nameEn: 'Melancholy' },
        { key: 9, name: '悲伤', nameEn: 'Sad' },
    ];

    E.registerGame({
        id: 'face_read',
        collectionId: 'emotion',
        title: { cn: '面孔读心', en: 'Face Reading' },
        subtitle: {
            cn: '这张脸，在说什么情绪？',
            en: 'What is this face feeling?',
        },

        generateTrials: function () {
            const trials = [];
            for (let r = 0; r < 2; r++) {
                FACE_EMOTIONS.forEach(f => {
                    trials.push({
                        id: 'fr_' + r + '_' + f.key,
                        condition: 'emo_' + f.key,
                        stimulus: {
                            img: 'picture/' + f.key + '_' + f.name + '.png',
                            emoKey: f.key,
                        },
                        correct: String(f.key),
                    });
                });
            }
            return E.shuffle(trials);
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 选一个最接近的情绪', 'Trial ' + meta.index + ' / ' + meta.total + ' · Pick the closest emotion');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-face-stage';
            hostEl.appendChild(stage);

            const img = document.createElement('img');
            img.className = 'qx5-face-img';
            img.src = trial.stimulus.img;
            img.alt = '';
            img.onerror = function () {
                img.style.display = 'none';
                const ph = document.createElement('div');
                ph.style.fontSize = '14px';
                ph.style.color = '#96A3B8';
                ph.innerText = E.t('（图片缺失）', '(image missing)');
                stage.appendChild(ph);
            };
            stage.appendChild(img);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            FACE_EMOTIONS.forEach(f => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                const color = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[f.key]) || '#2C7BE5';
                btn.style.borderColor = color;
                btn.style.color = color;
                btn.innerText = E.t(f.name, f.nameEn);
                btn.onclick = () => onAnswer(String(f.key));
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            const byEmo = {};
            recs.forEach(r => {
                const k = (r.condition || '').replace('emo_', '');
                if (!byEmo[k]) byEmo[k] = { total: 0, ok: 0 };
                byEmo[k].total++;
                if (r.correct) byEmo[k].ok++;
            });
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                byEmotion: byEmo,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                const a = s.accuracy;
                if (a >= 0.9) return E.t('情绪识别敏锐，共情力强', 'Highly perceptive');
                if (a >= 0.75) return E.t('识别较好', 'Good recognition');
                if (a >= 0.6) return E.t('正常范围', 'Normal');
                return E.t('可以多观察他人的表情', 'Try to observe others more');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('面孔读心 · 结果', 'Face Reading · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('总体正确率', 'Overall Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
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
       5. 风险转盘（决策 - 风险偏好）
       ================================================================ */
    E.registerGame({
        id: 'risk_wheel',
        collectionId: 'decision',
        title: { cn: '风险转盘', en: 'Risk Wheel' },
        subtitle: {
            cn: '稳赚，还是赌一把？',
            en: 'Play safe, or take a gamble?',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const sure = 5 + Math.floor(Math.random() * 6);
                const gamble = sure * 2;
                trials.push({
                    id: 'rw_' + i,
                    condition: 'gamble_pair',
                    stimulus: { sure: sure, gamble: gamble },
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

            const box = document.createElement('div');
            box.style.display = 'flex';
            box.style.flexDirection = 'column';
            box.style.gap = '12px';
            box.style.width = '80%';
            box.style.maxWidth = '400px';

            const mkBtn = (label, sub, val) => {
                const btn = document.createElement('button');
                btn.className = 'qx5-btn qx5-btn-secondary';
                btn.style.padding = '16px';
                btn.style.height = 'auto';
                btn.style.display = 'flex';
                btn.style.flexDirection = 'column';
                btn.style.alignItems = 'center';
                btn.style.gap = '4px';
                btn.innerHTML = `<div style="font-size:16px;font-weight:bold;">${label}</div><div style="font-size:12px;color:#5A6B87;">${sub}</div>`;
                btn.onclick = () => onAnswer(val);
                return btn;
            };

            box.appendChild(mkBtn(
                E.t('稳拿 ' + trial.stimulus.sure + ' 元', 'Safe +' + trial.stimulus.sure),
                E.t('100% 概率', '100% certain'),
                'safe'
            ));
            box.appendChild(mkBtn(
                E.t('一半概率拿 ' + trial.stimulus.gamble + ' 元', '50% chance +' + trial.stimulus.gamble),
                E.t('另一半概率拿 0 元', 'Other half: 0'),
                'gamble'
            ));
            stage.appendChild(box);
        },

        computeScore: function (data) {
            const recs = data.records;
            const gambles = recs.filter(r => r.response === 'gamble').length;
            const total = recs.length;
            return {
                accuracy: 1,
                correctCount: total,
                totalCount: total,
                gambleRate: total ? gambles / total : 0,
                gambleCount: gambles,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                const r = s.gambleRate;
                if (r >= 0.8) return E.t('强烈偏好风险，喜欢刺激', 'Strongly risk-seeking');
                if (r >= 0.5) return E.t('偏冒险', 'Risk-seeking');
                if (r >= 0.2) return E.t('偏保守', 'Risk-averse');
                return E.t('高度规避风险，稳妥第一', 'Strongly risk-averse');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('风险转盘 · 结果', 'Risk Wheel · Result')}</div>
                <div class="qx5-result-hero">${(s.gambleRate * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('选择赌一把的比例', 'Chose to gamble')}</div>
                <div class="qx5-result-row"><span>${E.t('冒险次数', 'Gambles')}</span><b>${s.gambleCount} / ${s.totalCount}</b></div>
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
       6. 顺序密码（记忆 - 序列记忆）
       ================================================================ */
    E.registerGame({
        id: 'sequence_pwd',
        collectionId: 'memory',
        title: { cn: '顺序密码', en: 'Sequence Password' },
        subtitle: {
            cn: '顺序错一步，全盘皆输',
            en: 'One wrong step, game over',
        },

        generateTrials: function () {
            return [{ id: 'seq_one', condition: 'seq', stimulus: {} }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'seq_top';
            top.innerText = E.t('看仔细：即将闪过一个顺序', 'Watch carefully: a sequence is coming');
            hostEl.appendChild(top);

            const grid = document.createElement('div');
            grid.className = 'qx5-seq-grid';
            hostEl.appendChild(grid);

            const cells = [];
            for (let i = 0; i < 9; i++) {
                const c = document.createElement('div');
                c.className = 'qx5-seq-cell';
                c.dataset.idx = i;
                grid.appendChild(c);
                cells.push(c);
            }

            let level = 1;
            let best = 0;
            let userInput = [];
            let sequence = [];
            let showing = false;

            function startLevel() {
                userInput = [];
                const len = 2 + level;
                sequence = [];
                for (let i = 0; i < len; i++) {
                    sequence.push(Math.floor(Math.random() * 9));
                }
                document.getElementById('seq_top').innerText = E.t('看仔细：' + len + ' 步', 'Watch: ' + len + ' steps');
                showing = true;
                let i = 0;
                const showNext = () => {
                    if (i >= sequence.length) {
                        showing = false;
                        document.getElementById('seq_top').innerText = E.t('轮到你了：按顺序点 ' + len + ' 下', 'Your turn: tap ' + len + ' times');
                        return;
                    }
                    const cell = cells[sequence[i]];
                    cell.classList.add('flash');
                    setTimeout(() => {
                        cell.classList.remove('flash');
                        i++;
                        setTimeout(showNext, 250);
                    }, 400);
                };
                setTimeout(showNext, 400);
            }

            cells.forEach((cell, idx) => {
                cell.onclick = function () {
                    if (showing) return;
                    userInput.push(idx);
                    cell.classList.add('flash-user');
                    setTimeout(() => cell.classList.remove('flash-user'), 200);

                    const pos = userInput.length - 1;
                    if (userInput[pos] !== sequence[pos]) {
                        onAnswer(JSON.stringify({
                            level: level,
                            best: best,
                            failedAt: pos + 1,
                        }), false);
                        return;
                    }
                    if (userInput.length === sequence.length) {
                        best = level;
                        level++;
                        setTimeout(startLevel, 500);
                    }
                };
            });

            startLevel();
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { level: 1, best: 0, failedAt: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: 1,
                totalCount: 1,
                maxLevel: info.best,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                if (s.maxLevel >= 5) return E.t('顺序记忆很强', 'Strong sequence memory');
                if (s.maxLevel >= 3) return E.t('正常水平', 'Normal');
                return E.t('多加练习会更好', 'Practice will help');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('顺序密码 · 结果', 'Sequence Password · Result')}</div>
                <div class="qx5-result-hero">${s.maxLevel} <span class="qx5-result-hero-unit">${E.t('关', 'levels')}</span></div>
                <div class="qx5-result-sub">${E.t('通过关卡数', 'Levels Cleared')}</div>
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
       7. 别漏掉（注意 - 持续注意）
       ================================================================ */
    E.registerGame({
        id: 'spot_diff',
        collectionId: 'attention',
        title: { cn: '别漏掉', en: 'Spot the Odd One' },
        subtitle: {
            cn: '一直点，但别点错',
            en: 'Keep going, but do not slip',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 20; i++) {
                const cols = 5;
                const baseColor = ['#4CAF50', '#2C7BE5', '#E53935', '#FFB300'][i % 4];
                const oddColor = (function () {
                    const pool = ['#4CAF50', '#2C7BE5', '#E53935', '#FFB300', '#9C27B0'];
                    return pool[(pool.indexOf(baseColor) + 1 + (i % 3)) % pool.length];
                })();
                const oddIdx = Math.floor(Math.random() * cols * cols);
                trials.push({
                    id: 'sd_' + i,
                    condition: 'grid',
                    stimulus: { baseColor: baseColor, oddColor: oddColor, oddIdx: oddIdx, cols: cols },
                    correct: String(oddIdx),
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 找出颜色不同的那个', 'Trial ' + meta.index + ' / ' + meta.total + ' · Find the odd color');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const grid = document.createElement('div');
            grid.className = 'qx5-spot-grid';
            grid.style.gridTemplateColumns = 'repeat(' + trial.stimulus.cols + ', 1fr)';
            stage.appendChild(grid);

            const total = trial.stimulus.cols * trial.stimulus.cols;
            for (let i = 0; i < total; i++) {
                const cell = document.createElement('div');
                cell.className = 'qx5-spot-cell';
                cell.style.background = (i === trial.stimulus.oddIdx) ? trial.stimulus.oddColor : trial.stimulus.baseColor;
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
                <div class="qx5-result-title">${E.t('别漏掉 · 结果', 'Spot the Odd One · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
                <div class="qx5-result-row"><span>${E.t('平均反应时', 'Mean RT')}</span><b>${s.meanRT} ms</b></div>
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
       8. 开关大师（逻辑 - 规划 / Lights Out）
       v2：
       - 从全亮开始随机点 N 下 → 局面一定可解
       - 难度递增
       - 放弃按钮缩小居中
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
            const size = 3;
            const dirs = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];

            for (let i = 0; i < 6; i++) {
                const state = new Array(size * size).fill(true);
                const nClicks = 2 + i;
                const clicked = new Set();
                let safety = 0;
                while (clicked.size < nClicks && safety < 50) {
                    safety++;
                    const idx = Math.floor(Math.random() * size * size);
                    if (clicked.has(idx)) continue;
                    clicked.add(idx);
                    const r = Math.floor(idx / size);
                    const c = idx % size;
                    dirs.forEach(([dr, dc]) => {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                            state[nr * size + nc] = !state[nr * size + nc];
                        }
                    });
                }

                /* 若某关开局恰好全亮，强制再点一次 */
                if (state.every(v => v)) {
                    const idx = Math.floor(Math.random() * size * size);
                    const r = Math.floor(idx / size);
                    const c = idx % size;
                    dirs.forEach(([dr, dc]) => {
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                            state[nr * size + nc] = !state[nr * size + nc];
                        }
                    });
                }

                trials.push({
                    id: 'sm_' + i,
                    condition: 'grid3',
                    stimulus: { size, bulbs: state },
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';

            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'sm_top';
            top.innerText = E.t(
                '第 ' + meta.index + ' / ' + meta.total + ' 关 · 点一次翻转自己和上下左右',
                'Level ' + meta.index + ' / ' + meta.total + ' · Toggle self and neighbors'
            );
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
                    c.style.boxShadow = state[i] ? '0 0 10px rgba(255,214,0,0.6)' : 'none';
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
                    cell.style.transition = 'background 0.15s, box-shadow 0.15s';
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

            /* 放弃按钮：小、居中 */
            const btnWrap = document.createElement('div');
            btnWrap.style.display = 'flex';
            btnWrap.style.justifyContent = 'center';
            btnWrap.style.marginTop = '12px';
            btnWrap.style.flexShrink = '0';

            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-secondary';
            btn.style.padding = '8px 24px';
            btn.style.height = 'auto';
            btn.style.maxWidth = '140px';
            btn.style.fontSize = '13px';
            btn.innerText = E.t('放弃', 'Give Up');
            btn.onclick = () => {
                onAnswer(JSON.stringify({
                    moves: moves,
                    elapsed: Math.round(E.nowMs() - startMs)
                }), false);
            };
            btnWrap.appendChild(btn);
            hostEl.appendChild(btnWrap);
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
                <div class="qx5-result-row"><span>${E.t('正确率', 'Accuracy')}</span><b>${(s.accuracy * 100).toFixed(0)}%</b></div>
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
       9. 综合闯关（综合 - 5 关随机，命数 3）
       ================================================================ */

    /* 9 类池 */
    const COMBO_POOL = [
        /* 1. 反应 */
        {
            key: 'flash',
            cn: '闪电点击',
            en: 'Flash Click',
            run: function (hostEl, onDone) {
                hostEl.innerHTML = '';
                const top = document.createElement('div');
                top.className = 'qx5-flash-top';
                top.innerText = E.t('反应时 < 600ms 算过', 'React under 600ms');
                hostEl.appendChild(top);

                const stage = document.createElement('div');
                stage.className = 'qx5-flash-stage';
                hostEl.appendChild(stage);

                let done = 0;
                const total = 5;
                let anyFail = false;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    stage.innerHTML = '';
                    const hint = document.createElement('div');
                    hint.className = 'qx5-flash-hint';
                    hint.innerText = E.t('第 ' + (done + 1) + ' / ' + total + ' 次', 'Try ' + (done + 1) + ' / ' + total);
                    stage.appendChild(hint);

                    setTimeout(() => {
                        hint.remove();
                        const dot = document.createElement('div');
                        dot.className = 'qx5-flash-dot';
                        dot.innerText = E.t('点', 'GO');
                        stage.appendChild(dot);
                        const t0 = E.nowMs();
                        let answered = false;
                        dot.onclick = () => {
                            if (answered) return;
                            answered = true;
                            const rt = E.nowMs() - t0;
                            if (rt >= 600) anyFail = true;
                            dot.style.background = rt < 600 ? '#2ECC71' : '#E74C3C';
                            setTimeout(() => { done++; next(); }, 400);
                        };
                    }, 800 + Math.random() * 1200);
                };
                next();
            },
        },
        /* 2. 注意（色词） */
        {
            key: 'stroop',
            cn: '色词打架',
            en: 'Stroop',
            run: function (hostEl, onDone) {
                const colors = [
                    { key: 'red', cn: '红', hex: '#E53935' },
                    { key: 'green', cn: '绿', hex: '#2ECC71' },
                    { key: 'blue', cn: '蓝', hex: '#2C7BE5' },
                    { key: 'yellow', cn: '黄', hex: '#F1C40F' },
                ];
                let done = 0;
                const total = 6;
                let anyFail = false;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('按颜色作答 ' + (done + 1) + ' / ' + total, 'By color ' + (done + 1) + ' / ' + total);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    const wordColor = colors[Math.floor(Math.random() * 4)];
                    let inkColor;
                    do { inkColor = colors[Math.floor(Math.random() * 4)]; } while (inkColor.key === wordColor.key);
                    if (Math.random() < 0.5) inkColor = wordColor;

                    const w = document.createElement('div');
                    w.style.fontSize = '72px';
                    w.style.fontWeight = '900';
                    w.style.color = inkColor.hex;
                    w.innerText = wordColor.cn;
                    stage.appendChild(w);

                    const opts = document.createElement('div');
                    opts.className = 'qx5-face-options';
                    opts.style.gridTemplateColumns = 'repeat(4, 1fr)';
                    colors.forEach(c => {
                        const btn = document.createElement('button');
                        btn.className = 'qx5-face-btn';
                        btn.style.borderColor = c.hex;
                        btn.style.color = c.hex;
                        btn.innerText = c.cn;
                        btn.onclick = () => {
                            if (c.key !== inkColor.key) anyFail = true;
                            done++;
                            next();
                        };
                        opts.appendChild(btn);
                    });
                    hostEl.appendChild(opts);
                };
                next();
            },
        },
        /* 3. 记忆（数字广度） */
        {
            key: 'digit',
            cn: '数字广度',
            en: 'Digit Span',
            run: function (hostEl, onDone) {
                let len = 4;
                let done = 0;
                const total = 3;
                let anyFail = false;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('记住 ' + len + ' 位数字', 'Remember ' + len + ' digits');
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    let s = '';
                    for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
                    const show = document.createElement('div');
                    show.style.fontSize = '48px';
                    show.style.fontWeight = '900';
                    show.style.letterSpacing = '10px';
                    show.style.color = '#2C7BE5';
                    show.innerText = s;
                    stage.appendChild(show);

                    setTimeout(() => {
                        stage.innerHTML = '';
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.inputMode = 'numeric';
                        input.autocomplete = 'off';
                        input.style.fontSize = '28px';
                        input.style.padding = '12px 20px';
                        input.style.borderRadius = '10px';
                        input.style.border = '2px solid #2C7BE5';
                        input.style.textAlign = 'center';
                        input.style.letterSpacing = '6px';
                        input.style.width = '70%';
                        input.style.maxWidth = '400px';
                        input.style.fontFamily = 'inherit';
                        stage.appendChild(input);
                        input.focus();

                        const btn = document.createElement('button');
                        btn.className = 'qx5-btn qx5-btn-primary';
                        btn.style.marginTop = '16px';
                        btn.style.maxWidth = '200px';
                        btn.innerText = E.t('确定', 'Submit');
                        stage.appendChild(btn);

                        const submit = () => {
                            if (input.value.trim() !== s) anyFail = true;
                            done++;
                            if (input.value.trim() === s) len++;
                            next();
                        };
                        btn.onclick = submit;
                        input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
                    }, 1200 + len * 200);
                };
                next();
            },
        },
        /* 4. 情绪（表情识别） */
        {
            key: 'face',
            cn: '表情识别',
            en: 'Face Reading',
            run: function (hostEl, onDone) {
                const emotions = [
                    { key: 1, cn: '焦躁' }, { key: 2, cn: '热烈' }, { key: 3, cn: '欢快' },
                    { key: 4, cn: '轻快' }, { key: 5, cn: '明朗' }, { key: 6, cn: '平静' },
                    { key: 7, cn: '压抑' }, { key: 8, cn: '忧伤' }, { key: 9, cn: '悲伤' },
                ];
                const picked = E.shuffle(emotions).slice(0, 6);
                let done = 0;
                let anyFail = false;

                const next = () => {
                    if (done >= picked.length) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('选最接近的情绪 ' + (done + 1) + ' / ' + picked.length, 'Pick emotion ' + (done + 1) + ' / ' + picked.length);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    const cur = picked[done];
                    const face = document.createElement('div');
                    const color = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[cur.key]) || '#2C7BE5';
                    face.style.width = '120px';
                    face.style.height = '120px';
                    face.style.borderRadius = '50%';
                    face.style.background = color;
                    face.style.display = 'flex';
                    face.style.alignItems = 'center';
                    face.style.justifyContent = 'center';
                    face.style.fontSize = '48px';
                    face.style.color = '#fff';
                    face.innerText = ['😠','🤩','😄','😊','🙂','😌','😔','😞','😢'][cur.key - 1];
                    stage.appendChild(face);

                    const opts = document.createElement('div');
                    opts.className = 'qx5-face-options';
                    opts.style.gridTemplateColumns = 'repeat(3, 1fr)';
                    const choices = E.shuffle(emotions).slice(0, 6);
                    if (!choices.some(x => x.key === cur.key)) choices[0] = cur;
                    E.shuffle(choices).forEach(c => {
                        const btn = document.createElement('button');
                        btn.className = 'qx5-face-btn';
                        btn.style.borderColor = '#2C7BE5';
                        btn.style.color = '#2C7BE5';
                        btn.style.fontSize = '12px';
                        btn.innerText = c.cn;
                        btn.onclick = () => {
                            if (c.key !== cur.key) anyFail = true;
                            done++;
                            next();
                        };
                        opts.appendChild(btn);
                    });
                    hostEl.appendChild(opts);
                };
                next();
            },
        },
        /* 5. 空间（找不同色） */
        {
            key: 'spot',
            cn: '找不同色',
            en: 'Spot Different',
            run: function (hostEl, onDone) {
                let done = 0;
                const total = 5;
                let anyFail = false;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('找出颜色不同的 ' + (done + 1) + ' / ' + total, 'Find odd ' + (done + 1) + ' / ' + total);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    const cols = 5;
                    const pool = ['#4CAF50', '#2C7BE5', '#E53935', '#FFB300', '#9C27B0'];
                    const baseColor = pool[Math.floor(Math.random() * pool.length)];
                    let oddColor;
                    do { oddColor = pool[Math.floor(Math.random() * pool.length)]; } while (oddColor === baseColor);
                    const oddIdx = Math.floor(Math.random() * cols * cols);

                    const grid = document.createElement('div');
                    grid.style.display = 'grid';
                    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
                    grid.style.gap = '4px';
                    grid.style.width = '90%';
                    grid.style.maxWidth = '340px';
                    grid.style.aspectRatio = '1';
                    stage.appendChild(grid);

                    for (let i = 0; i < cols * cols; i++) {
                        const cell = document.createElement('div');
                        cell.style.background = (i === oddIdx) ? oddColor : baseColor;
                        cell.style.borderRadius = '4px';
                        cell.style.cursor = 'pointer';
                        cell.onclick = () => {
                            if (i !== oddIdx) anyFail = true;
                            done++;
                            next();
                        };
                        grid.appendChild(cell);
                    }
                };
                next();
            },
        },
        /* 6. 逻辑（心算） */
        {
            key: 'math',
            cn: '心算',
            en: 'Mental Math',
            run: function (hostEl, onDone) {
                let done = 0;
                const total = 5;
                let anyFail = false;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('心算 ' + (done + 1) + ' / ' + total, 'Math ' + (done + 1) + ' / ' + total);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    const a = Math.floor(Math.random() * 20) + 1;
                    const b = Math.floor(Math.random() * 20) + 1;
                    const op = Math.random() < 0.5 ? '+' : '-';
                    const answer = op === '+' ? a + b : a - b;

                    const q = document.createElement('div');
                    q.style.fontSize = '48px';
                    q.style.fontWeight = '900';
                    q.style.color = '#2C7BE5';
                    q.innerText = a + ' ' + op + ' ' + b + ' = ?';
                    stage.appendChild(q);

                    const others = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3];
                    const wrongs = E.shuffle(others.filter(x => x !== answer)).slice(0, 3);

                    const opts = document.createElement('div');
                    opts.className = 'qx5-face-options';
                    opts.style.gridTemplateColumns = 'repeat(4, 1fr)';
                    E.shuffle([answer].concat(wrongs)).forEach(n => {
                        const btn = document.createElement('button');
                        btn.className = 'qx5-face-btn';
                        btn.style.borderColor = '#2C7BE5';
                        btn.style.color = '#2C7BE5';
                        btn.innerText = String(n);
                        btn.onclick = () => {
                            if (n !== answer) anyFail = true;
                            done++;
                            next();
                        };
                        opts.appendChild(btn);
                    });
                    hostEl.appendChild(opts);
                };
                next();
            },
        },
        /* 7. 语言（反义词） */
        {
            key: 'antonym',
            cn: '反义词',
            en: 'Antonym',
            run: function (hostEl, onDone) {
                const pairs = [
                    { w: '大', a: '小' }, { w: '高', a: '低' }, { w: '快', a: '慢' },
                    { w: '冷', a: '热' }, { w: '明', a: '暗' }, { w: '重', a: '轻' },
                ];
                const list = E.shuffle(pairs);
                let done = 0;
                let anyFail = false;

                const next = () => {
                    if (done >= list.length) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('选反义词 ' + (done + 1) + ' / ' + list.length, 'Antonym ' + (done + 1) + ' / ' + list.length);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    const cur = list[done];
                    const q = document.createElement('div');
                    q.style.fontSize = '48px';
                    q.style.fontWeight = '900';
                    q.style.color = '#2C7BE5';
                    q.innerText = cur.w;
                    stage.appendChild(q);

                    const wrongs = E.shuffle(pairs.filter(x => x.a !== cur.a)).slice(0, 2).map(x => x.a);
                    const opts = document.createElement('div');
                    opts.className = 'qx5-face-options';
                    opts.style.gridTemplateColumns = 'repeat(3, 1fr)';
                    E.shuffle([cur.a].concat(wrongs)).forEach(w => {
                        const btn = document.createElement('button');
                        btn.className = 'qx5-face-btn';
                        btn.style.borderColor = '#2C7BE5';
                        btn.style.color = '#2C7BE5';
                        btn.innerText = w;
                        btn.onclick = () => {
                            if (w !== cur.a) anyFail = true;
                            done++;
                            next();
                        };
                        opts.appendChild(btn);
                    });
                    hostEl.appendChild(opts);
                };
                next();
            },
        },
        /* 8. 时间（秒表估计） */
        {
            key: 'stopwatch',
            cn: '秒表估计',
            en: 'Stopwatch',
            run: function (hostEl, onDone) {
                let done = 0;
                const total = 2;
                let anyFail = false;
                const targetMs = 10000;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('估出 10 秒 ± 1.5 秒 ' + (done + 1) + ' / ' + total, 'Estimate 10s ±1.5s ' + (done + 1) + ' / ' + total);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    stage.style.flexDirection = 'column';
                    stage.style.gap = '16px';
                    hostEl.appendChild(stage);

                    const circle = document.createElement('div');
                    circle.style.width = '100px';
                    circle.style.height = '100px';
                    circle.style.borderRadius = '50%';
                    circle.style.background = '#E1E8F0';
                    stage.appendChild(circle);

                    const btn = document.createElement('button');
                    btn.className = 'qx5-btn qx5-btn-primary';
                    btn.style.padding = '12px 32px';
                    btn.style.height = 'auto';
                    btn.style.maxWidth = '200px';
                    btn.innerText = E.t('开始', 'Start');
                    stage.appendChild(btn);

                    let running = false;
                    let t0 = 0;
                    btn.onclick = () => {
                        if (!running) {
                            running = true;
                            t0 = E.nowMs();
                            circle.style.background = '#2C7BE5';
                            btn.innerText = E.t('停', 'Stop');
                        } else {
                            const elapsed = E.nowMs() - t0;
                            if (Math.abs(elapsed - targetMs) > 1500) anyFail = true;
                            done++;
                            next();
                        }
                    };
                };
                next();
            },
        },
        /* 9. 决策（奇偶判断） */
        {
            key: 'parity',
            cn: '奇偶判断',
            en: 'Odd/Even',
            run: function (hostEl, onDone) {
                let done = 0;
                const total = 5;
                let anyFail = false;

                const next = () => {
                    if (done >= total) { onDone(!anyFail); return; }
                    hostEl.innerHTML = '';
                    const top = document.createElement('div');
                    top.className = 'qx5-flash-top';
                    top.innerText = E.t('奇偶 ' + (done + 1) + ' / ' + total, 'Parity ' + (done + 1) + ' / ' + total);
                    hostEl.appendChild(top);

                    const stage = document.createElement('div');
                    stage.className = 'qx5-flash-stage';
                    hostEl.appendChild(stage);

                    const n = Math.floor(Math.random() * 100) + 1;
                    const q = document.createElement('div');
                    q.style.fontSize = '64px';
                    q.style.fontWeight = '900';
                    q.style.color = '#2C7BE5';
                    q.innerText = String(n);
                    stage.appendChild(q);

                    const opts = document.createElement('div');
                    opts.className = 'qx5-face-options';
                    opts.style.gridTemplateColumns = '1fr 1fr';
                    ['奇数', '偶数'].forEach(label => {
                        const btn = document.createElement('button');
                        btn.className = 'qx5-face-btn';
                        btn.style.borderColor = '#2C7BE5';
                        btn.style.color = '#2C7BE5';
                        btn.innerText = label;
                        btn.onclick = () => {
                            const isEven = (n % 2 === 0);
                            const isRight = (label === '偶数') === isEven;
                            if (!isRight) anyFail = true;
                            done++;
                            next();
                        };
                        opts.appendChild(btn);
                    });
                    hostEl.appendChild(opts);
                };
                next();
            },
        },
    ];

    E.registerGame({
        id: 'combo_challenge',
        collectionId: 'misc',
        title: { cn: '综合闯关', en: 'Combo Challenge' },
        subtitle: {
            cn: '5 关随机，命数 3，你能通到第几关？',
            en: '5 random stages, 3 lives — how far can you go?',
        },

        generateTrials: function () {
            const shuffled = E.shuffle(COMBO_POOL);
            const picked = shuffled.slice(0, 5);
            return [{
                id: 'combo_one',
                condition: 'combo',
                stimulus: { stages: picked.map(s => s.key) },
            }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            const stageObjects = trial.stimulus.stages.map(k => COMBO_POOL.find(s => s.key === k));

            let lives = 3;
            let currentStage = 0;
            const results = [];

            const renderHeader = () => {
                hostEl.innerHTML = '';
                const top = document.createElement('div');
                top.className = 'qx5-flash-top';
                top.id = 'combo_header';
                top.innerText = E.t(
                    '第 ' + (currentStage + 1) + ' / ' + stageObjects.length + ' 关 · ' + '❤'.repeat(lives),
                    'Stage ' + (currentStage + 1) + ' / ' + stageObjects.length + ' · ' + '❤'.repeat(lives)
                );
                hostEl.appendChild(top);

                const host = document.createElement('div');
                host.id = 'combo_host';
                host.style.flex = '1';
                host.style.minHeight = '0';
                host.style.display = 'flex';
                host.style.flexDirection = 'column';
                hostEl.appendChild(host);
                return host;
            };

            const updateHeader = () => {
                const el = document.getElementById('combo_header');
                if (el) {
                    el.innerText = E.t(
                        '第 ' + (currentStage + 1) + ' / ' + stageObjects.length + ' 关 · ' + (lives > 0 ? '❤'.repeat(lives) : '💔'),
                        'Stage ' + (currentStage + 1) + ' / ' + stageObjects.length + ' · ' + (lives > 0 ? '❤'.repeat(lives) : '💔')
                    );
                }
            };

            const runStage = () => {
                if (lives <= 0) {
                    onAnswer(JSON.stringify({
                        reached: currentStage,
                        totalStages: stageObjects.length,
                        lives: 0,
                        results: results,
                    }), false);
                    return;
                }
                if (currentStage >= stageObjects.length) {
                    onAnswer(JSON.stringify({
                        reached: stageObjects.length,
                        totalStages: stageObjects.length,
                        lives: lives,
                        results: results,
                    }), true);
                    return;
                }

                const stage = stageObjects[currentStage];
                const host = renderHeader();

                const intro = document.createElement('div');
                intro.style.textAlign = 'center';
                intro.style.padding = '20px';
                intro.style.color = '#5A6B87';
                intro.style.fontSize = '14px';
                intro.innerText = E.t('第 ' + (currentStage + 1) + ' 关：' + stage.cn, 'Stage ' + (currentStage + 1) + ': ' + stage.en);
                host.appendChild(intro);

                setTimeout(() => {
                    const playHost = document.createElement('div');
                    playHost.style.flex = '1';
                    playHost.style.minHeight = '0';
                    playHost.style.display = 'flex';
                    playHost.style.flexDirection = 'column';
                    host.innerHTML = '';
                    host.appendChild(playHost);

                    stage.run(playHost, function (passed) {
                        results.push({ key: stage.key, cn: stage.cn, passed: passed });
                        if (!passed) lives--;

                        updateHeader();

                        const overlay = document.createElement('div');
                        overlay.style.textAlign = 'center';
                        overlay.style.padding = '30px';
                        host.innerHTML = '';
                        host.appendChild(overlay);

                        const title = document.createElement('div');
                        title.style.fontSize = '22px';
                        title.style.fontWeight = 'bold';
                        title.style.marginBottom = '12px';
                        title.style.color = passed ? '#2ECC71' : '#E74C3C';
                        title.innerText = passed ? E.t('过关！', 'Stage Cleared!') : E.t('这关没过，扣 1 命', 'Failed — lose 1 life');
                        overlay.appendChild(title);

                        const lifeInfo = document.createElement('div');
                        lifeInfo.style.fontSize = '14px';
                        lifeInfo.style.color = '#5A6B87';
                        lifeInfo.style.marginBottom = '24px';
                        lifeInfo.innerText = lives > 0 ? E.t('剩余命数：' + '❤'.repeat(lives), 'Lives left: ' + '❤'.repeat(lives)) : E.t('命已用完', 'No lives left');
                        overlay.appendChild(lifeInfo);

                        const btn = document.createElement('button');
                        btn.className = 'qx5-btn qx5-btn-primary';
                        btn.style.padding = '12px 40px';
                        btn.style.height = 'auto';
                        btn.style.maxWidth = '240px';
                        btn.style.margin = '0 auto';
                        btn.innerText = lives > 0 ? E.t('继续', 'Continue') : E.t('查看结果', 'See Result');
                        btn.onclick = () => {
                            currentStage++;
                            runStage();
                        };
                        overlay.appendChild(btn);
                    });
                }, 1200);
            };

            runStage();
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { reached: 0, totalStages: 5, lives: 3, results: [] };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: info.reached,
                totalCount: info.totalStages,
                reached: info.reached,
                totalStages: info.totalStages,
                lives: info.lives,
                results: info.results,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';

            const cleared = s.reached >= s.totalStages;
            const titleText = cleared
                ? E.t('通关！', 'Cleared!')
                : E.t('到达第 ' + s.reached + ' 关', 'Reached Stage ' + s.reached);

            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('综合闯关 · 结果', 'Combo Challenge · Result')}</div>
                <div class="qx5-result-hero" style="color:${cleared ? '#2ECC71' : '#E74C3C'}">${s.reached} / ${s.totalStages}</div>
                <div class="qx5-result-sub">${titleText}</div>
                <div class="qx5-result-row"><span>${E.t('剩余命数', 'Lives left')}</span><b>${'❤'.repeat(Math.max(0, s.lives)) || '—'}</b></div>
                ${(s.results || []).map((r, i) => `
                    <div class="qx5-result-row">
                        <span>${E.t('第 ', 'Stage ')}${i+1}${E.t(' 关：', ': ')}${r.cn || r.key}</span>
                        <b style="color:${r.passed ? '#2ECC71' : '#E74C3C'}">${r.passed ? E.t('通过', 'Pass') : E.t('未过', 'Fail')}</b>
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