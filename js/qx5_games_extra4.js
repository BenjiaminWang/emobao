/* ================================================================
   情绪宝 - qx5 趣味测评 游戏库（第 5 批：20 个游戏）
   v1：
   - 从"数字字母交替"到"随机奖励"，凑满 50 个
   - 依赖 qx5_engine.js
   ================================================================ */

   (function () {
    'use strict';

    if (!window.qx5Engine) {
        console.error('[qx5_games_extra4] 缺少 qx5Engine');
        return;
    }
    const E = window.qx5Engine;

    /* 通用小工具：快速生成"点选项"题型 */
    function makeChoiceGame(cfg) {
        E.registerGame({
            id: cfg.id,
            collectionId: cfg.collectionId,
            title: cfg.title,
            subtitle: cfg.subtitle,
            generateTrials: cfg.generateTrials,
            renderTrial: function (hostEl, trial, onAnswer, meta) {
                hostEl.innerHTML = '';
                const top = document.createElement('div');
                top.className = 'qx5-flash-top';
                top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题', 'Trial ' + meta.index + ' / ' + meta.total);
                hostEl.appendChild(top);

                const stage = document.createElement('div');
                stage.className = 'qx5-flash-stage';
                hostEl.appendChild(stage);

                const prompt = document.createElement('div');
                prompt.style.fontSize = '20px';
                prompt.style.padding = '20px';
                prompt.style.textAlign = 'center';
                prompt.style.color = '#1A2B4A';
                prompt.style.lineHeight = '1.6';
                prompt.style.maxWidth = '90%';
                prompt.innerText = trial.stimulus.prompt || '';
                stage.appendChild(prompt);

                const opts = document.createElement('div');
                opts.className = 'qx5-face-options';
                opts.style.gridTemplateColumns = cfg.cols || 'repeat(3, 1fr)';
                trial.stimulus.options.forEach(o => {
                    const btn = document.createElement('button');
                    btn.className = 'qx5-face-btn';
                    btn.style.borderColor = '#2C7BE5';
                    btn.style.color = '#2C7BE5';
                    btn.style.padding = '12px';
                    btn.style.fontSize = '14px';
                    btn.innerText = o;
                    btn.onclick = () => onAnswer(o);
                    opts.appendChild(btn);
                });
                hostEl.appendChild(opts);
            },
            computeScore: cfg.computeScore || function (data) {
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
            renderResult: cfg.renderResult || function (hostEl, data) {
                const s = data.score;
                hostEl.innerHTML = '';
                const wrap = document.createElement('div');
                wrap.className = 'qx5-result';
                wrap.innerHTML = `
                    <div class="qx5-result-title">${E.t(cfg.title.cn, cfg.title.en)} · ${E.t('结果', 'Result')}</div>
                    <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                    <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
                    <div class="qx5-result-row"><span>${E.t('正确', 'Correct')}</span><b>${s.correctCount} / ${s.totalCount}</b></div>
                    ${s.meanRT ? `<div class="qx5-result-row"><span>${E.t('平均 RT', 'Mean RT')}</span><b>${s.meanRT} ms</b></div>` : ''}
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
    }


    /* ================================================================
       21. 数字字母交替
       ================================================================ */
    makeChoiceGame({
        id: 'digit_letter_alt',
        collectionId: 'attention',
        title: { cn: '数字字母交替', en: 'Digit Letter Alternation' },
        subtitle: { cn: '数字、字母、数字、字母…… 别切错', en: 'Number, letter, number, letter…' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const isNum = (i % 2 === 0);
                const n = Math.floor(Math.random() * 9) + 1;
                const l = 'ABCDEFGHIJ'[Math.floor(Math.random() * 10)];
                const target = isNum ? String(n) : l;
                const others = isNum ? ['1','2','3','4','5','6','7','8','9'].filter(x => x !== target) : 'ABCDEFGHIJ'.split('').filter(x => x !== target);
                const wrong = E.shuffle(others).slice(0, 2);
                trials.push({
                    id: 'dla_' + i,
                    condition: isNum ? 'number' : 'letter',
                    stimulus: {
                        prompt: E.t('这一题选数字', 'Pick a digit') + ' ' + (isNum ? '' : '×'),
                        options: E.shuffle([target].concat(wrong)),
                    },
                    correct: target,
                });
            }
            return E.shuffle(trials);
        },
    });


    /* ================================================================
       22. 语音情绪判断（文字模拟）
       ================================================================ */
    const VOICE_EMOTIONS = [
        { text: '……算了，随便吧。', emo: '压抑' },
        { text: '你猜怎么着？我中了！', emo: '欢快' },
        { text: '别碰我！', emo: '焦躁' },
        { text: '嗯……让我想想。', emo: '平静' },
        { text: '真的吗？太好了！', emo: '热烈' },
        { text: '没什么，就这样吧。', emo: '忧伤' },
        { text: '哎……', emo: '悲伤' },
        { text: '这有什么大不了的。', emo: '明朗' },
    ];

    makeChoiceGame({
        id: 'voice_emotion',
        collectionId: 'emotion',
        title: { cn: '语气情绪', en: 'Tone Emotion' },
        subtitle: { cn: '这句台词，是什么情绪？', en: 'What emotion is this line?' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            return E.shuffle(VOICE_EMOTIONS.map((v, i) => ({
                id: 've_' + i,
                condition: 'voice',
                stimulus: {
                    prompt: '「' + v.text + '」',
                    options: ['焦躁','热烈','欢快','轻快','明朗','平静','压抑','忧伤','悲伤'],
                },
                correct: v.emo,
            })));
        },
    });


    /* ================================================================
       23. 手指节奏（时间 - 快速点击）
       ================================================================ */
    E.registerGame({
        id: 'tap_rhythm',
        collectionId: 'time',
        title: { cn: '手指节奏', en: 'Tap Rhythm' },
        subtitle: { cn: '10 秒内尽可能快点', en: 'Tap as fast as you can in 10s' },
        generateTrials: function () {
            return [{ id: 'tr_one', condition: 'tap', stimulus: { durationSec: 10 } }];
        },
        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'tr_timer';
            top.innerText = E.t('点「开始」后疯狂点击下方区域', 'Tap the area below as fast as you can');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.flexDirection = 'column';
            stage.style.gap = '12px';
            hostEl.appendChild(stage);

            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-primary';
            btn.style.padding = '12px 32px';
            btn.style.height = 'auto';
            btn.innerText = E.t('开始', 'Start');
            stage.appendChild(btn);

            const area = document.createElement('div');
            area.style.width = '80%';
            area.style.maxWidth = '400px';
            area.style.height = '200px';
            area.style.background = '#FAFAFA';
            area.style.borderRadius = '8px';
            area.style.display = 'flex';
            area.style.alignItems = 'center';
            area.style.justifyContent = 'center';
            area.style.fontSize = '48px';
            area.style.fontWeight = 'bold';
            area.style.color = '#2C7BE5';
            area.style.userSelect = 'none';
            area.style.cursor = 'pointer';
            area.innerText = '0';
            stage.appendChild(area);

            let running = false;
            let taps = 0;
            const duration = trial.stimulus.durationSec * 1000;
            let startMs = 0;
            let timer = null;

            const tick = () => {
                const left = Math.max(0, Math.ceil((duration - (E.nowMs() - startMs)) / 1000));
                document.getElementById('tr_timer').innerText = E.t('还剩 ' + left + ' 秒 · 已点 ' + taps + ' 次', left + 's left · ' + taps + ' taps');
            };

            area.onclick = () => {
                if (!running) return;
                taps++;
                area.innerText = String(taps);
            };

            btn.onclick = () => {
                if (running) return;
                running = true;
                startMs = E.nowMs();
                btn.innerText = E.t('进行中…', 'Running…');
                btn.disabled = true;
                timer = setInterval(tick, 200);
                setTimeout(() => {
                    clearInterval(timer);
                    running = false;
                    const rate = Math.round(taps / (duration / 1000) * 10) / 10;
                    onAnswer(JSON.stringify({ taps: taps, rate: rate }), true);
                }, duration);
            };
        },
        computeScore: function (data) {
            const rec = data.records[0];
            let info = { taps: 0, rate: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return { accuracy: 1, correctCount: 1, totalCount: 1, taps: info.taps, rate: info.rate };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('手指节奏 · 结果', 'Tap Rhythm · Result')}</div>
                <div class="qx5-result-hero">${s.rate} <span class="qx5-result-hero-unit">${E.t('次/秒', 'taps/s')}</span></div>
                <div class="qx5-result-sub">${E.t('点击频率', 'Tap rate')}</div>
                <div class="qx5-result-row"><span>${E.t('总点击数', 'Total taps')}</span><b>${s.taps}</b></div>
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
       24. 计算闪算
       ================================================================ */
    makeChoiceGame({
        id: 'mental_math',
        collectionId: 'logic',
        title: { cn: '心算闪电', en: 'Mental Math' },
        subtitle: { cn: '越快越准越好', en: 'Fast and accurate' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 15; i++) {
                const a = Math.floor(Math.random() * 20) + 1;
                const b = Math.floor(Math.random() * 20) + 1;
                const op = Math.random() < 0.5 ? '+' : '-';
                const answer = op === '+' ? a + b : a - b;
                const others = [answer + 1, answer - 1, answer + 2, answer - 2, answer + 3];
                const wrong = E.shuffle(others.filter(x => x !== answer)).slice(0, 3);
                trials.push({
                    id: 'mm_' + i,
                    condition: op,
                    stimulus: {
                        prompt: a + ' ' + op + ' ' + b + ' = ?',
                        options: E.shuffle([String(answer)].concat(wrong.map(String))),
                    },
                    correct: String(answer),
                });
            }
            return trials;
        },
    });


    /* ================================================================
       25. 情绪一致性（情绪 - 元认知）
       ================================================================ */
    E.registerGame({
        id: 'emotion_consistency',
        collectionId: 'emotion',
        title: { cn: '情绪一致性', en: 'Emotion Consistency' },
        subtitle: { cn: '同样的表情，每次判断都一样吗？', en: 'Do you judge the same face the same way?' },
        generateTrials: function () {
            const trials = [];
            const testFaces = [1, 3, 5, 7, 9];
            /* 每个表情问 3 次 */
            for (let r = 0; r < 3; r++) {
                testFaces.forEach(f => {
                    trials.push({
                        id: 'ec_' + r + '_' + f,
                        condition: 'face_' + f,
                        stimulus: { faceKey: f },
                        correct: String(f),
                    });
                });
            }
            return E.shuffle(trials);
        },
        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 选最接近的情绪', 'Trial ' + meta.index + ' / ' + meta.total + ' · Pick the closest emotion');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const face = document.createElement('div');
            const color = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[trial.stimulus.faceKey]) || '#2C7BE5';
            face.style.width = '140px';
            face.style.height = '140px';
            face.style.borderRadius = '50%';
            face.style.background = color;
            face.style.display = 'flex';
            face.style.alignItems = 'center';
            face.style.justifyContent = 'center';
            face.style.fontSize = '60px';
            face.style.color = '#fff';
            face.innerText = ['😐','😊','🙂','😔','😢','😌','😞','😟','😩'][trial.stimulus.faceKey - 1];
            stage.appendChild(face);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = 'repeat(5, 1fr)';
            [1,3,5,7,9].forEach(f => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                const c = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[f]) || '#2C7BE5';
                btn.style.borderColor = c;
                btn.style.color = c;
                btn.style.fontSize = '12px';
                const names = { 1:'焦躁',3:'欢快',5:'明朗',7:'压抑',9:'悲伤' };
                btn.innerText = names[f];
                btn.onclick = () => onAnswer(String(f));
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },
        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            /* 一致性：同一脸答同一个选项的比例 */
            const byFace = {};
            recs.forEach(r => {
                const k = (r.condition || '').replace('face_', '');
                if (!byFace[k]) byFace[k] = [];
                byFace[k].push(r.response);
            });
            let consistent = 0;
            let total = 0;
            Object.keys(byFace).forEach(k => {
                const arr = byFace[k];
                total++;
                const uniq = Array.from(new Set(arr));
                if (uniq.length === 1) consistent++;
            });
            return {
                accuracy: recs.length ? ok.length / recs.length : 0,
                correctCount: ok.length,
                totalCount: recs.length,
                consistency: total ? consistent / total : 0,
            };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('情绪一致性 · 结果', 'Emotion Consistency · Result')}</div>
                <div class="qx5-result-hero">${(s.consistency * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('三次判断的一致率', 'Consistency across 3 repeats')}</div>
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
       26. 反义词（语言）
       ================================================================ */
    const ANTONYMS = [
        { w: '大', a: '小' }, { w: '高', a: '低' }, { w: '快', a: '慢' },
        { w: '冷', a: '热' }, { w: '明', a: '暗' }, { w: '重', a: '轻' },
        { w: '多', a: '少' }, { w: '新', a: '旧' }, { w: '长', a: '短' },
        { w: '笑', a: '哭' },
    ];
    makeChoiceGame({
        id: 'antonym',
        collectionId: 'language',
        title: { cn: '反义词', en: 'Antonym' },
        subtitle: { cn: '它的反面是什么？', en: 'What is the opposite?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            return E.shuffle(ANTONYMS.map((x, i) => {
                const others = ANTONYMS.filter((_, k) => k !== i).map(y => y.a);
                const wrong = E.shuffle(others).slice(0, 2);
                return {
                    id: 'an_' + i,
                    condition: 'antonym',
                    stimulus: { prompt: x.w + ' 的反义词？', options: E.shuffle([x.a].concat(wrong)) },
                    correct: x.a,
                };
            }));
        },
    });


    /* ================================================================
       27. 数字倒数
       ================================================================ */
    makeChoiceGame({
        id: 'count_backward',
        collectionId: 'memory',
        title: { cn: '数字倒数', en: 'Count Backward' },
        subtitle: { cn: '从 100 减 7，再减 7……', en: 'From 100, subtract 7 each time' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            let cur = 100;
            for (let i = 0; i < 8; i++) {
                cur -= 7;
                const answer = cur;
                const wrong = [answer + 7, answer - 7, answer + 14, answer - 14].filter(x => x !== answer);
                trials.push({
                    id: 'cb_' + i,
                    condition: 'minus7',
                    stimulus: { prompt: E.t('下一个数字是？', 'Next number?'), options: E.shuffle([String(answer)].concat(E.shuffle(wrong).slice(0, 3).map(String))) },
                    correct: String(answer),
                });
            }
            return trials;
        },
    });


    /* ================================================================
       28. 逻辑真伪
       ================================================================ */
    const LOGIC_ITEMS = [
        { q: '所有的猫都会飞。咪咪是一只猫。那么咪咪会飞。', a: '逻辑正确' },
        { q: '如果下雨，地面就会湿。地面是湿的。所以一定下雨了。', a: '逻辑错误' },
        { q: '所有的花都需要水。玫瑰是花。所以玫瑰需要水。', a: '逻辑正确' },
        { q: '今天天气好，就一定会有好事发生。', a: '逻辑错误' },
        { q: 'A 比 B 高，B 比 C 高。所以 A 比 C 高。', a: '逻辑正确' },
        { q: '所有的鱼都会游泳。鲨鱼会游泳。所以鲨鱼是鱼。', a: '逻辑错误' },
    ];
    makeChoiceGame({
        id: 'logic_truth',
        collectionId: 'logic',
        title: { cn: '逻辑真伪', en: 'Logic Truth' },
        subtitle: { cn: '这段推理对不对？', en: 'Is this reasoning correct?' },
        cols: 'repeat(2, 1fr)',
        generateTrials: function () {
            return E.shuffle(LOGIC_ITEMS.map((x, i) => ({
                id: 'lt_' + i,
                condition: 'logic',
                stimulus: { prompt: x.q, options: ['逻辑正确', '逻辑错误'] },
                correct: x.a,
            })));
        },
    });


    /* ================================================================
       29. 表情匹配（情绪）
       ================================================================ */
    makeChoiceGame({
        id: 'face_match_emoji',
        collectionId: 'emotion',
        title: { cn: '表情匹配', en: 'Emoji Match' },
        subtitle: { cn: '这个 emoji 更像哪种情绪？', en: 'Which emotion fits this emoji?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const list = [
                { e: '😄', emo: '欢快' }, { e: '😢', emo: '悲伤' }, { e: '😠', emo: '焦躁' },
                { e: '😌', emo: '平静' }, { e: '😔', emo: '压抑' }, { e: '🤩', emo: '热烈' },
                { e: '🙂', emo: '明朗' }, { e: '😞', emo: '忧伤' }, { e: '😊', emo: '轻快' },
            ];
            return E.shuffle(list.map((x, i) => ({
                id: 'fme_' + i,
                condition: 'emoji',
                stimulus: { prompt: x.e, options: ['焦躁','热烈','欢快','轻快','明朗','平静','压抑','忧伤','悲伤'] },
                correct: x.emo,
            })));
        },
    });


    /* ================================================================
       30. 快速分类
       ================================================================ */
    const CATEGORY_ITEMS = [
        { w: '苹果', c: '水果' }, { w: '香蕉', c: '水果' }, { w: '萝卜', c: '蔬菜' },
        { w: '白菜', c: '蔬菜' }, { w: '猫', c: '动物' }, { w: '狗', c: '动物' },
        { w: '桌子', c: '家具' }, { w: '椅子', c: '家具' }, { w: '钢琴', c: '乐器' }, { w: '吉他', c: '乐器' },
    ];
    makeChoiceGame({
        id: 'quick_category',
        collectionId: 'language',
        title: { cn: '快速分类', en: 'Quick Category' },
        subtitle: { cn: '它属于哪一类？', en: 'Which category?' },
        cols: 'repeat(5, 1fr)',
        generateTrials: function () {
            return E.shuffle(CATEGORY_ITEMS.map((x, i) => ({
                id: 'qc_' + i,
                condition: x.c,
                stimulus: { prompt: x.w, options: ['水果', '蔬菜', '动物', '家具', '乐器'] },
                correct: x.c,
            })));
        },
    });


    /* ================================================================
       31. 情绪连线
       ================================================================ */
    makeChoiceGame({
        id: 'emotion_link',
        collectionId: 'emotion',
        title: { cn: '情绪连线', en: 'Emotion Link' },
        subtitle: { cn: '这个情境，会产生哪种情绪？', en: 'Which emotion fits this scene?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const scenes = [
                { s: '你被堵在路上，已经迟到 20 分钟。', e: '焦躁' },
                { s: '朋友为你准备了生日惊喜。', e: '欢快' },
                { s: '你在安静的图书馆里看书。', e: '平静' },
                { s: '陪伴多年的宠物去世了。', e: '悲伤' },
                { s: '拿到了梦寐以求的 offer。', e: '热烈' },
                { s: '天空阴沉，你独自在家。', e: '忧伤' },
                { s: '收到了不友善的评价。', e: '压抑' },
                { s: '刚跑完步，凉爽舒服。', e: '轻快' },
                { s: '阳光正好，一切都顺。', e: '明朗' },
            ];
            return E.shuffle(scenes.map((x, i) => ({
                id: 'el_' + i,
                condition: 'scene',
                stimulus: { prompt: x.s, options: ['焦躁','热烈','欢快','轻快','明朗','平静','压抑','忧伤','悲伤'] },
                correct: x.e,
            })));
        },
    });


    /* ================================================================
       32. 视野闪测（空间）
       ================================================================ */
    E.registerGame({
        id: 'visual_field',
        collectionId: 'space',
        title: { cn: '视野闪测', en: 'Visual Field Flash' },
        subtitle: { cn: '一闪而过，你注意到了吗？', en: 'A single flash — did you notice?' },
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 10; i++) {
                trials.push({
                    id: 'vf_' + i,
                    condition: 'flash',
                    stimulus: {},
                    correct: 'yes',
                });
            }
            return trials;
        },
        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.innerText = E.t('第 ' + meta.index + ' / ' + meta.total + ' 题 · 仔细看', 'Trial ' + meta.index + ' / ' + meta.total + ' · Watch closely');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.position = 'relative';
            hostEl.appendChild(stage);

            const w = stage.clientWidth || 400;
            const h = stage.clientHeight || 400;
            const x = Math.random() * 0.7 * w + 0.15 * w;
            const y = Math.random() * 0.7 * h + 0.15 * h;
            const quadrant = (x < w / 2 ? '左' : '右') + (y < h / 2 ? '上' : '下');

            const dot = document.createElement('div');
            dot.style.position = 'absolute';
            dot.style.left = (x - 15) + 'px';
            dot.style.top = (y - 15) + 'px';
            dot.style.width = '30px';
            dot.style.height = '30px';
            dot.style.borderRadius = '50%';
            dot.style.background = '#2C7BE5';
            dot.style.opacity = '0';
            stage.appendChild(dot);

            setTimeout(() => { dot.style.opacity = '1'; }, 500);
            setTimeout(() => {
                dot.style.opacity = '0';
                const opts = document.createElement('div');
                opts.className = 'qx5-face-options';
                opts.style.gridTemplateColumns = '1fr 1fr';
                ['左上','右上','左下','右下'].forEach(q => {
                    const btn = document.createElement('button');
                    btn.className = 'qx5-face-btn';
                    btn.style.borderColor = '#2C7BE5';
                    btn.style.color = '#2C7BE5';
                    btn.innerText = q;
                    btn.onclick = () => onAnswer(q);
                    opts.appendChild(btn);
                });
                stage.appendChild(opts);
            }, 700);

            trial.__quadrant = quadrant;
        },
        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            return { accuracy: recs.length ? ok.length / recs.length : 0, correctCount: ok.length, totalCount: recs.length };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('视野闪测 · 结果', 'Visual Field Flash · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
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
       33. 节奏模仿（时间）
       ================================================================ */
    makeChoiceGame({
        id: 'rhythm_mimic',
        collectionId: 'time',
        title: { cn: '节奏模仿', en: 'Rhythm Mimic' },
        subtitle: { cn: '这个节奏里拍了几下？', en: 'How many beats in this pattern?' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 10; i++) {
                const n = 3 + Math.floor(Math.random() * 5);
                const wrongs = [n-1, n+1, n+2].filter(x => x > 0 && x !== n);
                trials.push({
                    id: 'rm_' + i,
                    condition: 'count',
                    stimulus: { prompt: 'X - X - X X - X'.slice(0, 5 + n * 2), options: E.shuffle([String(n)].concat(wrongs.slice(0,3).map(String))) },
                    correct: String(n),
                });
            }
            return trials;
        },
    });


    /* ================================================================
       34. 面部表情速度（情绪）
       ================================================================ */
    E.registerGame({
        id: 'face_speed',
        collectionId: 'emotion',
        title: { cn: '面部表情速度', en: 'Face Speed' },
        subtitle: { cn: '快速判断表情，别犹豫', en: 'Judge faces fast — no hesitation' },
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 15; i++) {
                const key = 1 + Math.floor(Math.random() * 9);
                trials.push({
                    id: 'fs_' + i,
                    condition: 'face_' + key,
                    stimulus: { key: key },
                    correct: String(key),
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

            const face = document.createElement('div');
            const color = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[trial.stimulus.key]) || '#2C7BE5';
            face.style.width = '140px';
            face.style.height = '140px';
            face.style.borderRadius = '50%';
            face.style.background = color;
            face.style.display = 'flex';
            face.style.alignItems = 'center';
            face.style.justifyContent = 'center';
            face.style.fontSize = '60px';
            face.style.color = '#fff';
            face.innerText = ['😠','🤩','😄','😊','🙂','😌','😔','😞','😢'][trial.stimulus.key - 1];
            stage.appendChild(face);

            const opts = document.createElement('div');
            opts.className = 'qx5-face-options';
            opts.style.gridTemplateColumns = 'repeat(3, 1fr)';
            const names = ['焦躁','热烈','欢快','轻快','明朗','平静','压抑','忧伤','悲伤'];
            names.forEach((n, i) => {
                const btn = document.createElement('button');
                btn.className = 'qx5-face-btn';
                const c = (window.qxEmotionWheel && window.qxEmotionWheel.EMOTION_COLORS && window.qxEmotionWheel.EMOTION_COLORS[i+1]) || '#2C7BE5';
                btn.style.borderColor = c;
                btn.style.color = c;
                btn.style.fontSize = '12px';
                btn.innerText = n;
                btn.onclick = () => onAnswer(String(i+1));
                opts.appendChild(btn);
            });
            hostEl.appendChild(opts);
        },
        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            const rts = ok.map(r => r.reactiontimems);
            return { accuracy: recs.length ? ok.length / recs.length : 0, correctCount: ok.length, totalCount: recs.length, meanRT: Math.round(E.mean(rts)) };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('面部表情速度 · 结果', 'Face Speed · Result')}</div>
                <div class="qx5-result-hero">${(s.accuracy * 100).toFixed(0)} <span class="qx5-result-hero-unit">%</span></div>
                <div class="qx5-result-sub">${E.t('正确率', 'Accuracy')}</div>
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
       35. 视觉搜索（注意）
       ================================================================ */
    makeChoiceGame({
        id: 'visual_search',
        collectionId: 'attention',
        title: { cn: '视觉搜索', en: 'Visual Search' },
        subtitle: { cn: '快速找到目标符号', en: 'Find the target symbol fast' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            const targets = ['★', '♥', '☀', '☁', '✿'];
            for (let i = 0; i < 12; i++) {
                const t = targets[Math.floor(Math.random() * targets.length)];
                const others = targets.filter(x => x !== t);
                trials.push({
                    id: 'vs_' + i,
                    condition: 'search',
                    stimulus: { prompt: E.t('找到：', 'Find: ') + t, options: E.shuffle([t].concat(others).slice(0, 4)) },
                    correct: t,
                });
            }
            return trials;
        },
    });


    /* ================================================================
       36. 图片情绪联想（情绪）
       ================================================================ */
    makeChoiceGame({
        id: 'emotion_association',
        collectionId: 'emotion',
        title: { cn: '情绪联想', en: 'Emotion Association' },
        subtitle: { cn: '这个词，让你想到哪种情绪？', en: 'What emotion does this word evoke?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const list = [
                { w: '离别', e: '忧伤' }, { w: '拥抱', e: '热烈' }, { w: '雨天', e: '压抑' },
                { w: '宴会', e: '欢快' }, { w: '晨光', e: '明朗' }, { w: '深夜', e: '平静' },
                { w: '奔跑', e: '轻快' }, { w: '争吵', e: '焦躁' }, { w: '墓地', e: '悲伤' },
            ];
            return E.shuffle(list.map((x, i) => ({
                id: 'ea_' + i,
                condition: 'word',
                stimulus: { prompt: x.w, options: ['焦躁','热烈','欢快','轻快','明朗','平静','压抑','忧伤','悲伤'] },
                correct: x.e,
            })));
        },
    });


    /* ================================================================
       37. 手指路径（空间）
       ================================================================ */
    E.registerGame({
        id: 'finger_path',
        collectionId: 'space',
        title: { cn: '手指路径', en: 'Finger Path' },
        subtitle: { cn: '按顺序滑动到目标点', en: 'Follow the numbered dots in order' },
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 5; i++) {
                const N = 4;
                const points = [];
                for (let k = 0; k < 5; k++) {
                    const r = Math.floor(Math.random() * N);
                    const c = Math.floor(Math.random() * N);
                    if (!points.some(p => p[0] === r && p[1] === c)) points.push([r, c]);
                }
                trials.push({
                    id: 'fp_' + i,
                    condition: 'path5',
                    stimulus: { N: N, points: points },
                });
            }
            return trials;
        },
        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'fp_top';
            top.innerText = E.t('按 1 → 5 的顺序点击', 'Tap 1 → 5 in order');
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
                    cell.style.borderRadius = '6px';
                    cell.style.display = 'flex';
                    cell.style.alignItems = 'center';
                    cell.style.justifyContent = 'center';
                    cell.style.fontSize = '20px';
                    cell.style.fontWeight = 'bold';
                    cell.style.color = '#2C7BE5';
                    cell.style.cursor = 'pointer';
                    cell.style.userSelect = 'none';
                    cell.dataset.rc = r + ',' + c;
                    grid.appendChild(cell);
                    cells.push(cell);
                }
            }

            trial.stimulus.points.forEach((p, idx) => {
                const cell = cells[p[0] * N + p[1]];
                cell.innerText = String(idx + 1);
            });

            let next = 1;
            const startMs = E.nowMs();
            let errors = 0;
            cells.forEach(cell => {
                cell.onclick = () => {
                    const n = parseInt(cell.innerText);
                    if (n === next) {
                        cell.style.background = '#E8F8F0';
                        next++;
                        if (next > trial.stimulus.points.length) {
                            const elapsed = Math.round(E.nowMs() - startMs);
                            onAnswer(JSON.stringify({ errors: errors, elapsed: elapsed }), errors === 0);
                        }
                    } else {
                        errors++;
                        cell.style.background = '#FDEDEC';
                        setTimeout(() => cell.style.background = '#fff', 300);
                    }
                };
            });
        },
        computeScore: function (data) {
            let totalErr = 0, totalTime = 0, correct = 0;
            data.records.forEach(r => {
                try {
                    const info = JSON.parse(r.response);
                    totalErr += info.errors || 0;
                    totalTime += info.elapsed || 0;
                    if (r.correct) correct++;
                } catch (e) {}
            });
            return { accuracy: data.records.length ? correct / data.records.length : 0, correctCount: correct, totalCount: data.records.length, totalErrors: totalErr, totalTime: totalTime };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('手指路径 · 结果', 'Finger Path · Result')}</div>
                <div class="qx5-result-hero">${s.correctCount} / ${s.totalCount}</div>
                <div class="qx5-result-sub">${E.t('完美通关数', 'Perfect runs')}</div>
                <div class="qx5-result-row"><span>${E.t('总错误', 'Total errors')}</span><b>${s.totalErrors}</b></div>
                <div class="qx5-result-row"><span>${E.t('总用时', 'Total time')}</span><b>${(s.totalTime/1000).toFixed(1)} s</b></div>
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
       38. 拼音找词（语言）
       ================================================================ */
    makeChoiceGame({
        id: 'pinyin_word',
        collectionId: 'language',
        title: { cn: '拼音找词', en: 'Pinyin Word' },
        subtitle: { cn: '拼音对应的词是？', en: 'Which word matches the pinyin?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const list = [
                { p: 'píng guǒ', w: '苹果' }, { p: 'shǒu jī', w: '手机' },
                { p: 'diàn nǎo', w: '电脑' }, { p: 'shī fu', w: '师父' },
                { p: 'xué xiào', w: '学校' }, { p: 'yī shēng', w: '医生' },
                { p: 'chá shuǐ', w: '茶水' }, { p: 'kuài zi', w: '筷子' },
                { p: 'yǔ sǎn', w: '雨伞' }, { p: 'bào zhǐ', w: '报纸' },
            ];
            return E.shuffle(list.map((x, i) => {
                const others = list.filter((_, k) => k !== i).map(y => y.w);
                return {
                    id: 'pw_' + i,
                    condition: 'pinyin',
                    stimulus: { prompt: x.p, options: E.shuffle([x.w].concat(E.shuffle(others).slice(0, 2))) },
                    correct: x.w,
                };
            }));
        },
    });


    /* ================================================================
       39. 影子形状（空间）
       ================================================================ */
    makeChoiceGame({
        id: 'shadow_shape',
        collectionId: 'space',
        title: { cn: '影子形状', en: 'Shadow Shape' },
        subtitle: { cn: '哪个是它的影子？', en: 'Which is its shadow?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const shapes = ['▲', '■', '●', '★', '◆'];
            const trials = [];
            for (let i = 0; i < 10; i++) {
                const t = shapes[Math.floor(Math.random() * shapes.length)];
                const others = shapes.filter(x => x !== t);
                trials.push({
                    id: 'ss_' + i,
                    condition: 'shadow',
                    stimulus: { prompt: t, options: E.shuffle([t].concat(others.slice(0, 2))) },
                    correct: t,
                });
            }
            return trials;
        },
    });


    /* ================================================================
       40. 隐藏数字（注意 - 视觉搜索）
       ================================================================ */
    makeChoiceGame({
        id: 'hidden_number',
        collectionId: 'attention',
        title: { cn: '隐藏数字', en: 'Hidden Number' },
        subtitle: { cn: '在乱码里找出目标数字', en: 'Find the target digit in noise' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const target = String(Math.floor(Math.random() * 10));
                const wrongs = [];
                while (wrongs.length < 3) {
                    const w = String(Math.floor(Math.random() * 10));
                    if (w !== target && wrongs.indexOf(w) < 0) wrongs.push(w);
                }
                const noise = '';
                trials.push({
                    id: 'hn_' + i,
                    condition: 'search',
                    stimulus: { prompt: E.t('找到：', 'Find: ') + target, options: E.shuffle([target].concat(wrongs)) },
                    correct: target,
                });
            }
            return trials;
        },
    });


    /* ================================================================
       41. 位置记忆（记忆 - 空间）
       ================================================================ */
    E.registerGame({
        id: 'position_memory',
        collectionId: 'memory',
        title: { cn: '位置记忆', en: 'Position Memory' },
        subtitle: { cn: '刚才那个点，在哪一格？', en: 'Where was the dot?' },
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const N = 4;
                const pos = Math.floor(Math.random() * N * N);
                trials.push({
                    id: 'pm_' + i,
                    condition: 'grid4',
                    stimulus: { N: N, pos: pos },
                    correct: String(pos),
                });
            }
            return trials;
        },
        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'pm_top';
            top.innerText = E.t('看这一格', 'Watch this cell');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            hostEl.appendChild(stage);

            const N = trial.stimulus.N;
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(' + N + ', 1fr)';
            grid.style.gap = '6px';
            grid.style.width = '240px';
            grid.style.height = '240px';
            stage.appendChild(grid);

            const cells = [];
            for (let i = 0; i < N * N; i++) {
                const cell = document.createElement('div');
                cell.style.background = '#fff';
                cell.style.border = '1px solid #E1E8F0';
                cell.style.borderRadius = '4px';
                cell.dataset.idx = i;
                grid.appendChild(cell);
                cells.push(cell);
            }

            cells[trial.stimulus.pos].style.background = '#2C7BE5';

            setTimeout(() => {
                cells.forEach(c => c.style.background = '#fff');
                document.getElementById('pm_top').innerText = E.t('刚才亮点在哪一格？', 'Where was the dot?');
                cells.forEach(cell => {
                    cell.style.cursor = 'pointer';
                    cell.onclick = () => {
                        const idx = parseInt(cell.dataset.idx);
                        cell.style.background = '#2ECC71';
                        onAnswer(String(idx));
                    };
                });
            }, 800);
        },
        computeScore: function (data) {
            const recs = data.records;
            const ok = recs.filter(r => r.correct === true);
            return { accuracy: recs.length ? ok.length / recs.length : 0, correctCount: ok.length, totalCount: recs.length };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('位置记忆 · 结果', 'Position Memory · Result')}</div>
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
       42. 语气反转（语言）
       ================================================================ */
    makeChoiceGame({
        id: 'irony_detect',
        collectionId: 'language',
        title: { cn: '语气反转', en: 'Irony Detect' },
        subtitle: { cn: '这句话是字面意思还是反话？', en: 'Literal or ironic?' },
        cols: 'repeat(2, 1fr)',
        generateTrials: function () {
            const list = [
                { s: '下大雨没带伞，朋友说：真棒！', a: '反话' },
                { s: '他很高兴地说：我拿到奖学金了！', a: '字面意思' },
                { s: '摔了一跤，他说：我今天运气真好。', a: '反话' },
                { s: '看完电影她说：这电影太精彩了。', a: '字面意思' },
                { s: '堵车堵了一小时，司机说：真快啊。', a: '反话' },
                { s: '收到花，她说：谢谢你，我很喜欢。', a: '字面意思' },
            ];
            return E.shuffle(list.map((x, i) => ({
                id: 'id_' + i,
                condition: 'irony',
                stimulus: { prompt: x.s, options: ['字面意思', '反话'] },
                correct: x.a,
            })));
        },
    });


    /* ================================================================
       43. 幸运数字（决策）
       ================================================================ */
    makeChoiceGame({
        id: 'lucky_number',
        collectionId: 'decision',
        title: { cn: '幸运数字', en: 'Lucky Number' },
        subtitle: { cn: '你会选哪个数字？', en: 'Which number would you pick?' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 8; i++) {
                const nums = E.shuffle(['1','2','3','4','5','6','7','8','9','10','11','12']).slice(0, 4);
                trials.push({
                    id: 'ln_' + i,
                    condition: 'preference',
                    stimulus: { prompt: E.t('选一个你最想选的数字', 'Pick a number you like most'), options: nums },
                    /* 无对错，取第一个为"参考" */
                    correct: null,
                });
            }
            return trials;
        },
        computeScore: function (data) {
            return { accuracy: 1, correctCount: data.records.length, totalCount: data.records.length, picks: data.records.map(r => r.response) };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('幸运数字 · 你的选择', 'Lucky Number · Your Picks')}</div>
                <div class="qx5-result-sub">${E.t('没有对错，只有偏好', 'No right answer — just preference')}</div>
                ${s.picks.map((p, i) => `<div class="qx5-result-row"><span>第 ${i+1} 次</span><b>${p}</b></div>`).join('')}
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
       44. 快速比较（注意）
       ================================================================ */
    makeChoiceGame({
        id: 'quick_compare',
        collectionId: 'attention',
        title: { cn: '快速比较', en: 'Quick Compare' },
        subtitle: { cn: '哪个数字更大？', en: 'Which number is larger?' },
        cols: 'repeat(2, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 15; i++) {
                const a = Math.floor(Math.random() * 100);
                let b = Math.floor(Math.random() * 100);
                while (b === a) b = Math.floor(Math.random() * 100);
                const correct = a > b ? String(a) : String(b);
                trials.push({
                    id: 'qc2_' + i,
                    condition: 'compare',
                    stimulus: { prompt: '哪个更大？', options: [String(a), String(b)] },
                    correct: correct,
                });
            }
            return trials;
        },
    });


    /* ================================================================
       45. 局部识别（空间）
       ================================================================ */
    makeChoiceGame({
        id: 'part_whole',
        collectionId: 'space',
        title: { cn: '局部识别', en: 'Part or Whole' },
        subtitle: { cn: '这个碎片属于哪张图？', en: 'Which image does this fragment belong to?' },
        cols: 'repeat(3, 1fr)',
        generateTrials: function () {
            const list = ['★', '●', '▲', '■', '◆'];
            const trials = [];
            for (let i = 0; i < 10; i++) {
                const t = list[Math.floor(Math.random() * list.length)];
                const others = list.filter(x => x !== t);
                trials.push({
                    id: 'pw2_' + i,
                    condition: 'piece',
                    stimulus: { prompt: t, options: E.shuffle([t].concat(others.slice(0, 2))) },
                    correct: t,
                });
            }
            return trials;
        },
    });


    /* ================================================================
       46. 声音想象（时间/记忆）
       ================================================================ */
    makeChoiceGame({
        id: 'sound_imagine',
        collectionId: 'time',
        title: { cn: '声音想象', en: 'Sound Imagine' },
        subtitle: { cn: '这个声音是长还是短？', en: 'Long or short sound?' },
        cols: 'repeat(2, 1fr)',
        generateTrials: function () {
            const list = [
                { w: '咚——', t: '长' }, { w: '哒', t: '短' }, { w: '哗——', t: '长' },
                { w: '咔', t: '短' }, { w: '嗡——', t: '长' }, { w: '嘀', t: '短' },
                { w: '轰——', t: '长' }, { w: '啪', t: '短' },
            ];
            return E.shuffle(list.map((x, i) => ({
                id: 'si_' + i,
                condition: 'sound',
                stimulus: { prompt: x.w, options: ['长', '短'] },
                correct: x.t,
            })));
        },
    });


    /* ================================================================
       47. 判断奇偶（执行功能）
       ================================================================ */
    makeChoiceGame({
        id: 'odd_even',
        collectionId: 'logic',
        title: { cn: '判断奇偶', en: 'Odd or Even' },
        subtitle: { cn: '这个数是奇数还是偶数？', en: 'Odd or even?' },
        cols: 'repeat(2, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 15; i++) {
                const n = Math.floor(Math.random() * 100) + 1;
                trials.push({
                    id: 'oe_' + i,
                    condition: 'parity',
                    stimulus: { prompt: String(n), options: ['奇数', '偶数'] },
                    correct: n % 2 === 0 ? '偶数' : '奇数',
                });
            }
            return trials;
        },
    });


    /* ================================================================
       48. 情绪方向（情绪）
       ================================================================ */
    makeChoiceGame({
        id: 'emotion_valence',
        collectionId: 'emotion',
        title: { cn: '情绪方向', en: 'Emotion Valence' },
        subtitle: { cn: '这个情绪是正向还是负向？', en: 'Positive or negative emotion?' },
        cols: 'repeat(2, 1fr)',
        generateTrials: function () {
            const list = [
                { e: '焦躁', v: '负向' }, { e: '欢快', v: '正向' }, { e: '热烈', v: '正向' },
                { e: '悲伤', v: '负向' }, { e: '平静', v: '正向' }, { e: '忧伤', v: '负向' },
                { e: '明朗', v: '正向' }, { e: '压抑', v: '负向' }, { e: '轻快', v: '正向' },
            ];
            return E.shuffle(list.map((x, i) => ({
                id: 'ev_' + i,
                condition: 'valence',
                stimulus: { prompt: x.e, options: ['正向', '负向'] },
                correct: x.v,
            })));
        },
    });


    /* ================================================================
       49. 多任务编号（执行功能）
       ================================================================ */
    makeChoiceGame({
        id: 'multi_number',
        collectionId: 'attention',
        title: { cn: '多任务编号', en: 'Multi Number' },
        subtitle: { cn: '按规则找到正确数字', en: 'Find the right number by rule' },
        cols: 'repeat(4, 1fr)',
        generateTrials: function () {
            const trials = [];
            for (let i = 0; i < 12; i++) {
                const target = Math.floor(Math.random() * 50) + 1;
                const rule = i % 2 === 0 ? '大于' : '小于';
                const wrongs = [];
                while (wrongs.length < 3) {
                    const w = Math.floor(Math.random() * 50) + 1;
                    if (w !== target && wrongs.indexOf(w) < 0) {
                        if ((rule === '大于' && w < target) || (rule === '小于' && w > target)) {
                            wrongs.push(w);
                        }
                    }
                }
                trials.push({
                    id: 'mn_' + i,
                    condition: rule,
                    stimulus: { prompt: '哪个数字' + rule + ' ' + target + '？', options: E.shuffle([String(target)].concat(wrongs.map(String))) },
                    correct: String(target),
                });
            }
            return trials;
        },
    });


    /* ================================================================
       50. 随机奖励（决策 - 奖赏敏感性）
       ================================================================ */
    E.registerGame({
        id: 'random_reward',
        collectionId: 'decision',
        title: { cn: '随机奖励', en: 'Random Reward' },
        subtitle: { cn: '按下去，看能不能中大奖', en: 'Press and see if you win big' },
        generateTrials: function () {
            return [{ id: 'rr_one', condition: 'press', stimulus: { rounds: 15 } }];
        },
        renderTrial: function (hostEl, trial, onAnswer, meta) {
            hostEl.innerHTML = '';
            const top = document.createElement('div');
            top.className = 'qx5-flash-top';
            top.id = 'rr_top';
            top.innerText = E.t('尽可能多地按按钮，看能得多少分', 'Press as often as you can — score whatever you get');
            hostEl.appendChild(top);

            const stage = document.createElement('div');
            stage.className = 'qx5-flash-stage';
            stage.style.flexDirection = 'column';
            stage.style.gap = '16px';
            hostEl.appendChild(stage);

            const score = document.createElement('div');
            score.style.fontSize = '48px';
            score.style.fontWeight = 'bold';
            score.style.color = '#2C7BE5';
            score.innerText = '0';
            stage.appendChild(score);

            const btn = document.createElement('button');
            btn.className = 'qx5-btn qx5-btn-primary';
            btn.style.padding = '16px 48px';
            btn.style.height = 'auto';
            btn.style.fontSize = '18px';
            btn.innerText = E.t('按我', 'Press Me');
            stage.appendChild(btn);

            let total = 0;
            let presses = 0;

            btn.onclick = () => {
                presses++;
                const r = Math.random();
                let got = 0;
                if (r < 0.1) got = 100;
                else if (r < 0.3) got = 20;
                else if (r < 0.6) got = 5;
                else got = 1;
                total += got;
                score.innerText = String(total);
            };

            /* 15 秒后结算 */
            const startMs = E.nowMs();
            const duration = 15000;
            const finish = () => {
                const elapsed = Math.round(E.nowMs() - startMs);
                onAnswer(JSON.stringify({ presses: presses, total: total, elapsed: elapsed }), true);
            };
            setTimeout(finish, duration);

            const tick = setInterval(() => {
                const left = Math.max(0, Math.ceil((duration - (E.nowMs() - startMs)) / 1000));
                document.getElementById('rr_top').innerText = E.t('还剩 ' + left + ' 秒 · 已按 ' + presses + ' 次', left + 's left · ' + presses + ' presses');
                if (left <= 0) clearInterval(tick);
            }, 300);
        },
        computeScore: function (data) {
            const rec = data.records[0];
            let info = { presses: 0, total: 0, elapsed: 0 };
            try { info = JSON.parse(rec.response); } catch (e) {}
            return { accuracy: 1, correctCount: 1, totalCount: 1, presses: info.presses, total: info.total, elapsed: info.elapsed };
        },
        renderResult: function (hostEl, data) {
            const s = data.score;
            hostEl.innerHTML = '';
            const wrap = document.createElement('div');
            wrap.className = 'qx5-result';
            wrap.innerHTML = `
                <div class="qx5-result-title">${E.t('随机奖励 · 结果', 'Random Reward · Result')}</div>
                <div class="qx5-result-hero">${s.total} <span class="qx5-result-hero-unit">${E.t('分', 'pts')}</span></div>
                <div class="qx5-result-sub">${E.t('总得分', 'Total score')}</div>
                <div class="qx5-result-row"><span>${E.t('按键次数', 'Presses')}</span><b>${s.presses}</b></div>
                <div class="qx5-result-row"><span>${E.t('每秒次数', 'Per second')}</span><b>${(s.presses / (s.elapsed / 1000)).toFixed(1)}</b></div>
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