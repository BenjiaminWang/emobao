/* ================================================================
   情绪宝 - qx5 趣味测评 游戏库（第 3 批：10 个游戏）
   v2：
   - beat_master 加入 AudioContext 现场合成"哒"声
   - 其余同 v1
   ================================================================ */

   (function () {
    'use strict';

    if (!window.qx5Engine) {
        console.error('[qx5_games_extra2] 缺少 qx5Engine');
        return;
    }
    const E = window.qx5Engine;

    /* ================================================================
       1. 数字反着来（记忆 - 反向广度）
       ================================================================ */
    E.registerGame({
        id: 'digit_reverse',
        collectionId: 'memory',
        title: { cn: '数字反着来', en: 'Reverse Digits' },
        subtitle: {
            cn: '我说 1-2-3，你说 3-2-1',
            en: 'I say 1-2-3, you say 3-2-1',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const len = 2 + Math.floor(i / 2);
                let s = '';
                for (let j = 0; j < len; j++) s += Math.floor(Math.random() * 10);
                trials.push({
                    id: 'dr_' + i,
                    condition: 'len_' + len,
                    stimulus: { digits: s, len: len },
                    correct: s.split('').reverse().join(''),
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · ' + trial.stimulus.len + ' 位', 'Trial ' + meta.index + ' / ' + meta.total + ' · ' + trial.stimulus.len + ' digits');
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
                input.placeholder = E.t('倒着输入', 'Type reversed');
                stage.appendChild(input);
                input.focus();

                const btn = document.createElement('button');
                btn.className = 'qx5-btn qx5-btn-primary';
                btn.style.marginTop = '16px';
                btn.style.maxWidth = '200px';
                btn.innerText = E.t('确定', 'Submit');
                stage.appendChild(btn);

                const submit = () => onAnswer(input.value.trim());
                btn.onclick = submit;
                input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
            }, 2000);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            let maxLen = 0;
            ok.forEach(r => {
                const m = String(r.condition || '').match(/len_(\d+)/);
                if (m) { const n = parseInt(m[1]); if (n > maxLen) maxLen = n; }
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
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('数字反着来 · 结果', 'Reverse Digits · Result')}</div>
                <div class="qx5-result-hero">${s.maxSpan} <span class="qx5-result-hero-unit">${E.t('位', 'digits')}</span></div>
                <div class="qx5-result-sub">${E.t('最长正确位数', 'Longest correct span')}</div>
                <div class="qx5-result-row"><span>${E.t('正确率', 'Accuracy')}</span><b>${(s.accuracy * 100).toFixed(1)}%</b></div>
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
       2. 追光者（反应 - 视觉追踪）
       ================================================================ */
    E.registerGame({
        id: 'chase_light',
        collectionId: 'speed',
        title: { cn: '追光者', en: 'Chase the Light' },
        subtitle: {
            cn: '光在跑，你追得上吗？',
            en: 'The light moves. Can you catch it?',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 10; i++) {
                trials.push({
                    id: 'cl_' + i,
                    condition: 'chase',
                    stimulus: { durationMs: 8000 },
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 点那个移动的圆', 'Trial ' + meta.index + ' / ' + meta.total + ' · Click the moving dot');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.position = 'relative';
            stage.style.overflow = 'hidden';
            hostEl.appendChild(stage);

            const dot = document.createElement('div');
            dot.className = 'qx5-flash-dot';
            dot.style.width = '50px';
            dot.style.height = '50px';
            dot.style.fontSize = '14px';
            dot.style.position = 'absolute';
            dot.style.left = '50px';
            dot.style.top = '50px';
            dot.style.transition = 'left 1.5s linear, top 1.5s linear';
            dot.innerText = '';
            stage.appendChild(dot);

            let hits = 0;
            let misses = 0;
            let done = false;
            const duration = trial.stimulus.durationMs || 8000;
            const startMs = E.nowMs();

            const moveDot = () => {
                if (done) return;
                const w = stage.clientWidth - 60;
                const h = stage.clientHeight - 60;
                dot.style.left = Math.max(10, Math.random() * w) + 'px';
                dot.style.top = Math.max(10, Math.random() * h) + 'px';
            };
            moveDot();
            const moveTimer = setInterval(moveDot, 1500);

            dot.onclick = function (ev) {
                if (done) return;
                ev.stopPropagation();
                hits++;
                moveDot();
            };
            stage.onclick = function () {
                if (done) return;
                misses++;
            };

            setTimeout(function () {
                done = true;
                clearInterval(moveTimer);
                const elapsed = Math.round(E.nowMs() - startMs);
                onAnswer(JSON.stringify({ hits: hits, misses: misses, elapsed: elapsed }), hits > 0);
            }, duration);
        },

        computeScore: function (data) {
            let totalHits = 0, totalMiss = 0;
            data.records.forEach(r => {
                try {
                    const info = JSON.parse(r.response);
                    totalHits += info.hits || 0;
                    totalMiss += info.misses || 0;
                } catch (e) {}
            });
            return {
                accuracy: 1,
                correctCount: totalHits,
                totalCount: totalHits + totalMiss,
                hits: totalHits,
                misses: totalMiss,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('追光者 · 结果', 'Chase the Light · Result')}</div>
                <div class="qx5-result-hero">${s.hits} <span class="qx5-result-hero-unit">${E.t('次命中', 'hits')}</span></div>
                <div class="qx5-result-sub">${E.t('总命中次数', 'Total Hits')}</div>
                <div class="qx5-result-row"><span>${E.t('误点空白', 'Misses')}</span><b>${s.misses}</b></div>
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
       3. 图形侦探（逻辑 - 归纳推理）
       ================================================================ */
    E.registerGame({
        id: 'pattern_detective',
        collectionId: 'logic',
        title: { cn: '图形侦探', en: 'Pattern Detective' },
        subtitle: {
            cn: '下一张图，长什么样？',
            en: 'What comes next?',
        },

        generateTrials: function () {
            const trials = [];
            const shapes = ['●', '■', '▲', '★'];
            for (let i = 0; i < 10; i++) {
                const s1 = shapes[i % 4];
                const s2 = shapes[(i + 1) % 4];
                const s3 = shapes[(i + 2) % 4];
                const answer = shapes[(i + 3) % 4];
                trials.push({
                    id: 'pd_' + i,
                    condition: 'seq4',
                    stimulus: { s1: s1, s2: s2, s3: s3 },
                    correct: answer,
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 下一张是什么', 'Trial ' + meta.index + ' / ' + meta.total + ' · What comes next');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.display = 'flex';
            stage.style.gap = '20px';
            hostEl.appendChild(stage);

            [trial.stimulus.s1, trial.stimulus.s2, trial.stimulus.s3].forEach(s => {
                const el = document.createElement('div');
                el.style.fontSize = '64px';
                el.style.color = '#2C7BE5';
                el.innerText = s;
                stage.appendChild(el);
            });

            const q = document.createElement('div');
            q.style.fontSize = '64px';
            q.style.color = '#96A3B8';
            q.innerText = '?';
            stage.appendChild(q);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.marginTop = '16px';
            const shapes = ['●', '■', '▲', '★'];
            shapes.forEach(s => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.fontSize = '24px';
                btn.style.borderColor = '#2C7BE5';
                btn.style.color = '#2C7BE5';
                btn.innerText = s;
                btn.onclick = () => onAnswer(s);
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
                <div class="qx5-result-title">${E.t('图形侦探 · 结果', 'Pattern Detective · Result')}</div>
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
       4. 情绪配对（情绪 - 情绪加工）
       ================================================================ */
    const EMOTION_PAIRS = [
        { key: 1, name: '焦躁', nameEn: 'Irritable', desc: '坐立不安，心里火烧' },
        { key: 2, name: '热烈', nameEn: 'Passionate', desc: '充满能量，想大吼一声' },
        { key: 3, name: '欢快', nameEn: 'Cheerful', desc: '想笑，脚步轻快' },
        { key: 4, name: '轻快', nameEn: 'Lively', desc: '轻松自在，愿意聊天' },
        { key: 5, name: '明朗', nameEn: 'Bright', desc: '思路清晰，看什么都顺眼' },
        { key: 6, name: '平静', nameEn: 'Calm', desc: '没什么波动，安安静静' },
        { key: 7, name: '压抑', nameEn: 'Depressed', desc: '胸口闷闷的，不想说话' },
        { key: 8, name: '忧伤', nameEn: 'Melancholy', desc: '有点酸楚，容易怀念' },
        { key: 9, name: '悲伤', nameEn: 'Sad', desc: '心沉到底，想哭' },
    ];

    E.registerGame({
        id: 'emotion_match',
        collectionId: 'emotion',
        title: { cn: '情绪配对', en: 'Emotion Match' },
        subtitle: {
            cn: '哪种表情，配哪种心情？',
            en: 'Which face fits which mood?',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 9; i++) {
                const correct = EMOTION_PAIRS[i];
                const others = EMOTION_PAIRS.filter((_, k) => k !== i);
                const wrong = E.shuffle(others).slice(0, 3);
                const choices = E.shuffle([correct].concat(wrong));
                trials.push({
                    id: 'em_' + i,
                    condition: 'emo_' + correct.key,
                    stimulus: { desc: correct.desc, choices: choices },
                    correct: String(correct.key),
                });
            }
            return E.shuffle(trials);
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

            const desc = document.createElement('div');
            desc.style.fontSize = '20px';
            desc.style.color = '#1A2B4A';
            desc.style.padding = '20px';
            desc.style.textAlign = 'center';
            desc.style.maxWidth = '90%';
            desc.innerText = '「' + trial.stimulus.desc + '」';
            stage.appendChild(desc);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            trial.stimulus.choices.forEach(c => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                const color = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[c.key]) || '#2C7BE5';
                btn.style.borderColor = color;
                btn.style.color = color;
                btn.innerText = E.t(c.name, c.nameEn);
                btn.onclick = () => onAnswer(String(c.key));
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
                <div class="qx5-result-title">${E.t('情绪配对 · 结果', 'Emotion Match · Result')}</div>
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
       5. 棉花糖时刻（决策 - 延迟满足）
       ================================================================ */
    E.registerGame({
        id: 'marshmallow',
        collectionId: 'decision',
        title: { cn: '棉花糖时刻', en: 'Marshmallow Moment' },
        subtitle: {
            cn: '现在要，还是再等等？',
            en: 'Now, or wait for more?',
        },

        generateTrials: function () {
            const trials = [];
            const waits = [3, 5, 8, 12, 20, 30];
            waits.forEach((w, i) => {
                trials.push({
                    id: 'mm_' + i,
                    condition: 'wait_' + w,
                    stimulus: {
                        now: 1,
                        later: Math.round(1 + w * 0.4),
                        waitSec: w,
                    },
                });
            });
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

            const mk = (label, sub, val) => {
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

            box.appendChild(mk(
                E.t('现在要 ' + trial.stimulus.now + ' 个', 'Now: ' + trial.stimulus.now),
                E.t('立刻得到', 'Immediately'),
                'now'
            ));
            box.appendChild(mk(
                E.t('等 ' + trial.stimulus.waitSec + ' 秒得 ' + trial.stimulus.later + ' 个', 'Wait ' + trial.stimulus.waitSec + 's: ' + trial.stimulus.later),
                E.t('延迟满足', 'Delayed reward'),
                'wait'
            ));
            stage.appendChild(box);
        },

        computeScore: function (data) {
            const recs = data.records;
            const waits = recs.filter(r => r.response === 'wait').length;
            return {
                accuracy: 1,
                correctCount: recs.length,
                totalCount: recs.length,
                waitRate: recs.length ? waits / recs.length : 0,
                waitCount: waits,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('棉花糖时刻 · 结果', 'Marshmallow Moment · Result')}</div>
                <div class="qx5-result-hero">${(s.waitRate * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('选择等待的比例', 'Chose to wait')}</div>
                <div class="qx5-result-row"><span>${E.t('等待次数', 'Waited')}</span><b>${s.waitCount} / ${s.totalCount}</b></div>
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
       6. 词语接龙（语言 - 语义流畅性）
       ================================================================ */
    E.registerGame({
        id: 'word_chain',
        collectionId: 'language',
        title: { cn: '词语接龙', en: 'Word Chain' },
        subtitle: {
            cn: '30 秒内，写出尽可能多的水果',
            en: 'Name as many fruits as you can in 30s',
        },

        generateTrials: function () {
            return [{ id: 'wc_one', condition: 'fluency', stimulus: { category: 'fruits', durationSec: 30 } }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'wc_timer';
            top.innerText = E.t('还剩 30 秒', '30s left');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.flexDirection = 'column';
            stage.style.gap = '12px';
            stage.style.padding = '16px';
            hostEl.appendChild(stage);

            const desc = document.createElement('div');
            desc.style.fontSize = '14px';
            desc.style.color = '#5A6B87';
            desc.innerText = E.t('一个词一行', 'One word per line');
            stage.appendChild(desc);

            const textarea = document.createElement('textarea');
            textarea.style.width = '90%';
            textarea.style.maxWidth = '400px';
            textarea.style.height = '200px';
            textarea.style.padding = '10px';
            textarea.style.fontSize = '16px';
            textarea.style.borderRadius = '8px';
            textarea.style.border = '1px solid #D0D7E0';
            textarea.style.fontFamily = 'inherit';
            textarea.placeholder = E.t('苹果\n香蕉\n橘子\n…', 'Apple\nBanana\nOrange\n…');
            stage.appendChild(textarea);
            textarea.focus();

            const startMs = E.nowMs();
            const duration = trial.stimulus.durationSec * 1000;

            const tick = setInterval(() => {
                const left = Math.max(0, Math.ceil((duration - (E.nowMs() - startMs)) / 1000));
                const el = document.getElementById('wc_timer');
                if (el) el.innerText = E.t('还剩 ' + left + ' 秒', left + 's left');
            }, 200);

            setTimeout(() => {
                clearInterval(tick);
                const lines = textarea.value.split('\n').map(s => s.trim()).filter(s => s);
                const uniq = Array.from(new Set(lines));
                onAnswer(JSON.stringify({ count: uniq.length, words: uniq }), true);
            }, duration);
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { count: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: 1,
                totalCount: 1,
                count: info.count,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                if (s.count >= 15) return E.t('语言流畅性极佳', 'Excellent verbal fluency');
                if (s.count >= 10) return E.t('高于平均', 'Above average');
                if (s.count >= 6) return E.t('正常范围', 'Normal');
                return E.t('可以再多练练', 'More practice helps');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('词语接龙 · 结果', 'Word Chain · Result')}</div>
                <div class="qx5-result-hero">${s.count} <span class="qx5-result-hero-unit">${E.t('个', 'words')}</span></div>
                <div class="qx5-result-sub">${E.t('30 秒内不重复的词', 'Unique words in 30s')}</div>
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
       7. 一心二用（执行功能 - 注意分配）
       ================================================================ */
    E.registerGame({
        id: 'dual_task',
        collectionId: 'attention',
        title: { cn: '一心二用', en: 'Dual Task' },
        subtitle: {
            cn: '两件事一起做，还行吗？',
            en: 'Two things at once — can you handle it?',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const useColor = (i % 2 === 0);
                const word = ['红','绿','蓝','黄'][Math.floor(Math.random() * 4)];
                const colorNames = { '红': 'red', '绿': 'green', '蓝': 'blue', '黄': 'yellow' };
                const wordKey = colorNames[word];
                let inkKey = wordKey;
                if (useColor) {
                    const others = ['red','green','blue','yellow'].filter(k => k !== wordKey);
                    inkKey = others[Math.floor(Math.random() * others.length)];
                }
                trials.push({
                    id: 'dt_' + i,
                    condition: useColor ? 'color_task' : 'word_task',
                    stimulus: { word: word, wordKey: wordKey, inkKey: inkKey },
                    correct: useColor ? inkKey : wordKey,
                });
            }
            return E.shuffle(trials);
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            const task = trial.condition === 'color_task' ? E.t('任务A：按颜色', 'Task A: By COLOR') : E.t('任务B：按字义', 'Task B: By WORD');
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · ' + task, 'Trial ' + meta.index + ' / ' + meta.total + ' · ' + task);
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const colorMap = { red: '#E53935', green: '#2ECC71', blue: '#2C7BE5', yellow: '#F1C40F' };
            const word = document.createElement('div');
            word.style.fontSize = '72px';
            word.style.fontWeight = '900';
            word.style.color = colorMap[trial.stimulus.inkKey];
            word.innerText = trial.stimulus.word;
            stage.appendChild(word);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            ['red','green','blue','yellow'].forEach(k => {
                const c = { red: '红', green: '绿', blue: '蓝', yellow: '黄' }[k];
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.borderColor = colorMap[k];
                btn.style.color = colorMap[k];
                btn.innerText = c;
                btn.onclick = () => onAnswer(k);
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },

        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            const colorOk = recs.filter(r => r.condition === 'color_task' && r.correct).map(r => r.reactiontimems);
            const wordOk = recs.filter(r => r.condition === 'word_task' && r.correct).map(r => r.reactiontimems);
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                colorMeanRT: Math.round(E.mean(colorOk)),
                wordMeanRT: Math.round(E.mean(wordOk)),
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('一心二用 · 结果', 'Dual Task · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('总体正确率', 'Overall Accuracy')}</div>
                <div class="qx5-result-row"><span>${E.t('按颜色 RT', 'Color RT')}</span><b>${s.colorMeanRT} ms</b></div>
                <div class="qx5-result-row"><span>${E.t('按字义 RT', 'Word RT')}</span><b>${s.wordMeanRT} ms</b></div>
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
       8. 地图寻路（空间 - 空间记忆）
       ================================================================ */
    E.registerGame({
        id: 'map_route',
        collectionId: 'space',
        title: { cn: '地图寻路', en: 'Map Route' },
        subtitle: {
            cn: '记住从起点到终点的路',
            en: 'Memorize the route from start to goal',
        },

        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 6; i++) {
                const N = 5;
                const path = [];
                let r = 0, c = 0;
                path.push([r, c]);
                while (!(r === N - 1 && c === N - 1)) {
                    if (r < N - 1 && (c === N - 1 || Math.random() < 0.5)) r++;
                    else c++;
                    path.push([r, c]);
                }
                trials.push({
                    id: 'mr_' + i,
                    condition: 'grid5',
                    stimulus: { N: N, path: path },
                    correct: JSON.stringify(path),
                });
            }
            return trials;
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'mr_top';
            top.innerText = E.t('看清楚这条路径', 'Watch the path');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const N = trial.stimulus.N;
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(' + N + ', 1fr)';
            grid.style.gap = '4px';
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
                    cell.dataset.rc = r + ',' + c;
                    grid.appendChild(cell);
                    cells.push(cell);
                }
            }

            let i = 0;
            let showing = true;
            const showPath = () => {
                if (i >= trial.stimulus.path.length) {
                    showing = false;
                    cells.forEach(c => c.style.background = '#fff');
                    document.getElementById('mr_top').innerText = E.t('按顺序点击路径', 'Click the path in order');
                    return;
                }
                const p = trial.stimulus.path[i];
                const cell = cells[p[0] * N + p[1]];
                cell.style.background = '#2C7BE5';
                i++;
                setTimeout(() => {
                    cell.style.background = '#fff';
                    setTimeout(showPath, 100);
                }, 400);
            };
            setTimeout(showPath, 400);

            const userPath = [];
            cells.forEach(cell => {
                cell.onclick = () => {
                    if (showing) return;
                    const rc = cell.dataset.rc.split(',').map(Number);
                    userPath.push(rc);
                    cell.style.background = '#2ECC71';
                    const expected = trial.stimulus.path[userPath.length - 1];
                    if (rc[0] !== expected[0] || rc[1] !== expected[1]) {
                        onAnswer(JSON.stringify({ path: userPath }), false);
                        return;
                    }
                    if (userPath.length === trial.stimulus.path.length) {
                        onAnswer(JSON.stringify({ path: userPath }), true);
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
                <div class="qx5-result-title">${E.t('地图寻路 · 结果', 'Map Route · Result')}</div>
                <div class="qx5-result-hero">${s.correctCount} / ${s.totalCount}</div>
                <div class="qx5-result-sub">${E.t('正确路径数', 'Correct Paths')}</div>
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
       9. 节拍狂人（时间 - 节奏同步）
       v2：加入 AudioContext 现场合成"哒"声
       ================================================================ */
    E.registerGame({
        id: 'beat_master',
        collectionId: 'time',
        title: { cn: '节拍狂人', en: 'Beat Master' },
        subtitle: {
            cn: '踩准每一拍，别掉队',
            en: 'Hit every beat — do not fall behind',
        },

        generateTrials: function () {
            return [{ id: 'bm_one', condition: 'beat', stimulus: { intervalMs: 800, beats: 20 } }];
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'bm_top';
            top.innerText = E.t('点「开始」后跟着节拍点，每 0.8 秒一下', 'Hit "Start", then tap every 0.8 seconds');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.flexDirection = 'column';
            stage.style.gap = '16px';
            hostEl.appendChild(stage);

            const beatCircle = document.createElement('div');
            beatCircle.style.width = '100px';
            beatCircle.style.height = '100px';
            beatCircle.style.borderRadius = '50%';
            beatCircle.style.background = '#E1E8F0';
            beatCircle.style.transition = 'background 0.12s, transform 0.12s';
            stage.appendChild(beatCircle);

            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-primary';
            btn.style.padding = '12px 32px';
            btn.style.height = 'auto';
            btn.style.maxWidth = '240px';
            btn.innerText = E.t('开始', 'Start');
            stage.appendChild(btn);

            const counter = document.createElement('div');
            counter.style.fontSize = '13px';
            counter.style.color = '#5A6B87';
            counter.innerText = '';
            stage.appendChild(counter);

            /* ===== 音频：AudioContext 现场合成"哒" ===== */
            let audioCtx = null;
            function ensureAudio() {
                if (audioCtx) return audioCtx;
                try {
                    const Ctx = window.AudioContext || window.webkitAudioContext;
                    if (Ctx) audioCtx = new Ctx();
                } catch (e) { audioCtx = null; }
                return audioCtx;
            }
            function playBeat() {
                const ctx = ensureAudio();
                if (!ctx) return;
                try {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(1200, ctx.currentTime);
                    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.005);
                    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
                    osc.connect(gain).connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.1);
                } catch (e) {}
            }

            /* ===== 游戏状态 ===== */
            let tapping = false;
            let beats = [];
            let tapTimes = [];
            const intervalMs = trial.stimulus.intervalMs;
            const totalBeats = trial.stimulus.beats;
            let beatTimer = null;

            const flashBeat = () => {
                playBeat();
                beatCircle.style.background = '#2C7BE5';
                beatCircle.style.transform = 'scale(1.15)';
                setTimeout(() => {
                    beatCircle.style.background = '#E1E8F0';
                    beatCircle.style.transform = 'scale(1)';
                }, 130);
                beats.push(E.nowMs());
                counter.innerText = E.t('节拍 ' + beats.length + ' / ' + totalBeats, 'Beat ' + beats.length + ' / ' + totalBeats);
                if (beats.length >= totalBeats) {
                    clearInterval(beatTimer);
                    setTimeout(finish, 400);
                }
            };

            const finish = () => {
                tapping = false;
                let totalErr = 0;
                let count = 0;
                tapTimes.forEach(tt => {
                    let min = Infinity;
                    beats.forEach(bt => {
                        const d = Math.abs(tt - bt);
                        if (d < min) min = d;
                    });
                    if (min < 400) { totalErr += min; count++; }
                });
                const avgErr = count ? Math.round(totalErr / count) : 999;
                onAnswer(JSON.stringify({
                    avgErr: avgErr,
                    taps: tapTimes.length,
                    beats: beats.length,
                    matched: count,
                }), avgErr < 300);
            };

            btn.onclick = function () {
                if (!tapping) {
                    tapping = true;
                    btn.innerText = E.t('跟着点', 'Tap now!');
                    btn.style.background = '#2ECC71';
                    const ctx = ensureAudio();
                    if (ctx && ctx.state === 'suspended') {
                        try { ctx.resume(); } catch (e) {}
                    }
                    flashBeat();
                    beatTimer = setInterval(flashBeat, intervalMs);
                } else {
                    tapTimes.push(E.nowMs());
                }
            };

            stage.addEventListener('click', function (ev) {
                if (ev.target === btn) return;
                if (!tapping) return;
                tapTimes.push(E.nowMs());
            });
        },

        computeScore: function (data) {
            const rec = data.records[0];
            let info = { avgErr: 999, taps: 0, beats: 0, matched: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return {
                accuracy: 1,
                correctCount: 1,
                totalCount: 1,
                avgErr: info.avgErr,
                taps: info.taps,
                beats: info.beats,
                matched: info.matched,
            };
        },

        renderResult: function (hostEl, data) {
            const s = data.score;
            const txt = (function () {
                const e = s.avgErr;
                if (e >= 999) return E.t('没跟上节拍，再来一次吧', 'Missed the beat — try again');
                if (e < 80) return E.t('节拍感极强', 'Excellent sense of rhythm');
                if (e < 150) return E.t('节奏不错', 'Good rhythm');
                if (e < 250) return E.t('一般', 'Average');
                return E.t('多听音乐练练节拍', 'Practice with music');
            })();

            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('节拍狂人 · 结果', 'Beat Master · Result')}</div>
                <div class="qx5-result-hero">${s.avgErr >= 999 ? '—' : s.avgErr} <span class="qx5-result-hero-unit">${s.avgErr >= 999 ? '' : 'ms'}</span></div>
                <div class="qx5-result-sub">${E.t('平均偏差（越小越好）', 'Mean Error (lower is better)')}</div>
                <div class="qx5-result-row"><span>${E.t('点击数', 'Taps')}</span><b>${s.taps}</b></div>
                <div class="qx5-result-row"><span>${E.t('对上的节拍', 'Matched Beats')}</span><b>${s.matched} / ${s.beats}</b></div>
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
       10. 图形旋转（空间 - 心理旋转）
       ================================================================ */
    E.registerGame({
        id: 'shape_rotate',
        collectionId: 'space',
        title: { cn: '图形旋转', en: 'Shape Rotation' },
        subtitle: {
            cn: '转一转，它还一样吗？',
            en: 'Rotate it — is it still the same?',
        },

        generateTrials: function () {
            const baseShapes = ['F', 'R', 'L', 'P', 'G'];
            const trials = [];
            for (let i = 0; i < 10; i++) {
                const shape = baseShapes[i % baseShapes.length];
                const isSame = Math.random() < 0.5;
                const transform = isSame ? 'none' : 'scaleX(-1)';
                trials.push({
                    id: 'sr_' + i,
                    condition: isSame ? 'same' : 'mirror',
                    stimulus: { shape: shape, targetTransform: transform },
                    correct: isSame ? 'same' : 'mirror',
                });
            }
            return E.shuffle(trials);
        },

        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 是不是同一个形状', 'Trial ' + meta.index + ' / ' + meta.total + ' · Same shape?');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.gap = '40px';
            hostEl.appendChild(stage);

            const left = document.createElement('div');
            left.style.fontSize = '80px';
            left.style.fontWeight = '900';
            left.style.color = '#2C7BE5';
            left.innerText = trial.stimulus.shape;
            stage.appendChild(left);

            const right = document.createElement('div');
            right.style.fontSize = '80px';
            right.style.fontWeight = '900';
            right.style.color = '#2C7BE5';
            right.style.transform = trial.stimulus.targetTransform;
            right.innerText = trial.stimulus.shape;
            stage.appendChild(right);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = '1fr 1fr';
            opts.style.marginTop = '16px';

            const mk = (label, val) => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                btn.style.borderColor = '#2C7BE5';
                btn.style.color = '#2C7BE5';
                btn.style.padding = '12px';
                btn.innerText = label;
                btn.onclick = () => onAnswer(val);
                return btn;
            };
            opts.appendChild(mk(E.t('一样', 'Same'), 'same'));
            opts.appendChild(mk(E.t('镜像', 'Mirror'), 'mirror'));
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
                <div class="qx5-result-title">${E.t('图形旋转 · 结果', 'Shape Rotation · Result')}</div>
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

})();