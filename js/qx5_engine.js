/* ================================================================
   情绪宝 - qx5 趣味测评 引擎
   v2：
   - finishGame 防重入 + 标 finished
   - quitflag 只在"题没做完 + 用户退出"时为 true
   - onAnswer(response, correctOverride) 支持显式传对错
   - recordTrial 支持 correctOverride
   - 其余同 v1
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://lmmnwmueppkdbzvufxar.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    /* ============ 工具 ============ */
    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
    function getUserId() { return (window.mQxb && window.mQxb.user_id) || null; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function isGuest() { return getUserType() === 14; }
    function getLang() { return (window.mQxb && window.mQxb.Language) || 1; }

    function uid() {
        if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function nowMs() {
        return (window.performance && performance.now) ? performance.now() : Date.now();
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function mean(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    /* ============ Supabase REST ============ */
    async function restPost(table, rows) {
        const url = `${SUPABASE_URL}/rest/v1/${table}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify(rows),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST POST ${table}: ${res.status} ${txt}`);
        }
        return true;
    }

    async function restPatch(table, query, patch) {
        const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'return=minimal',
            },
            body: JSON.stringify(patch),
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST PATCH ${table}: ${res.status} ${txt}`);
        }
        return true;
    }

    async function restGet(path) {
        const url = `${SUPABASE_URL}/rest/v1/${path}`;
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`REST GET ${path}: ${res.status} ${txt}`);
        }
        return res.json();
    }

    /* ============ 会话状态 ============ */
    let state = {
        gameRegistry: {},
        currentGame: null,
        currentSession: null,
        hostEl: null,
        onProgress: null,
        onComplete: null,
    };

    /* ============ 对外：注册游戏 ============ */
    function registerGame(cfg) {
        if (!cfg || !cfg.id) {
            console.error('[qx5Engine] registerGame: 缺少 id');
            return;
        }
        state.gameRegistry[cfg.id] = cfg;
    }

    function listGames() {
        return Object.values(state.gameRegistry);
    }

    function getGame(id) {
        return state.gameRegistry[id] || null;
    }

    /* ============ 对外：开始一场游戏 ============ */
    async function start(gameId, hostEl, options) {
        options = options || {};
        const cfg = state.gameRegistry[gameId];
        if (!cfg) {
            console.error('[qx5Engine] 未注册的游戏:', gameId);
            return false;
        }

        state.currentGame = cfg;
        state.hostEl = hostEl;
        state.onProgress = options.onProgress || null;
        state.onComplete = options.onComplete || null;

        const sessionId = uid();
        const startedAt = new Date().toISOString();

        let trials = [];
        try {
            trials = cfg.generateTrials() || [];
        } catch (e) {
            console.error('[qx5Engine] generateTrials 抛错', e);
            return false;
        }
        if (!trials.length) {
            console.error('[qx5Engine] 题目为空');
            return false;
        }

        state.currentSession = {
            sessionid: sessionId,
            gameid: cfg.id,
            collectionid: cfg.collectionId || 'misc',
            startedat: startedAt,
            trials: trials,
            currentIndex: 0,
            trialRecords: [],
            userResponses: [],
            aborted: false,
            finished: false,
        };

        try {
            await restPost('emobao_game_session', [{
                sessionid: sessionId,
                userid: getUserId() || '00000000-0000-0000-0000-000000000000',
                gameid: cfg.id,
                collectionid: cfg.collectionId || 'misc',
                startedat: startedAt,
                languagemode: getLang(),
                quitflag: false,
            }]);
        } catch (e) {
            console.warn('[qx5Engine] 建 session 失败，游戏继续但不存库', e);
        }

        renderCurrentTrial();
        return true;
    }

    /* ============ 内部：渲染当前题 ============ */
    function renderCurrentTrial() {
        const s = state.currentSession;
        const cfg = state.currentGame;
        if (!s || !cfg) return;

        if (s.currentIndex >= s.trials.length) {
            finishGame(false);
            return;
        }

        const trial = s.trials[s.currentIndex];
        const trialIndex = s.currentIndex;

        const trialStartMs = nowMs();

        /* response 必填，correctOverride 可选 */
        const onAnswer = function (response, correctOverride) {
            const rt = Math.round(nowMs() - trialStartMs);
            recordTrial(trialIndex, trial, response, rt, correctOverride);

            s.currentIndex++;
            if (state.onProgress) {
                try {
                    state.onProgress({
                        index: s.currentIndex,
                        total: s.trials.length,
                        trial,
                        response,
                        correct: (trial.correct != null) ? (response === trial.correct) : null,
                        rt,
                    });
                } catch (e) {}
            }
            renderCurrentTrial();
        };

        try {
            cfg.renderTrial(state.hostEl, trial, onAnswer, {
                index: s.currentIndex,
                total: s.trials.length,
            });
        } catch (e) {
            console.error('[qx5Engine] renderTrial 抛错', e);
            onAnswer('__error__');
        }
    }

    /* ============ 内部：记录一题 ============ */
    function recordTrial(trialIndex, trial, response, rt, correctOverride) {
        const s = state.currentSession;
        if (!s) return;
        const cfg = state.currentGame;

        let correct = null;
        if (correctOverride === true || correctOverride === false) {
            correct = correctOverride;
        } else if (trial.correct != null) {
            correct = (response === trial.correct);
        }

        s.trialRecords.push({
            trialno: trialIndex + 1,
            condition: trial.condition || '',
            stimulus: trial.stimulus || {},
            response: String(response),
            correct: correct,
            reactiontimems: rt,
        });

        (async () => {
            try {
                await restPost('emobao_game_trial', [{
                    sessionid: s.sessionid,
                    userid: getUserId() || '00000000-0000-0000-0000-000000000000',
                    gameid: cfg.id,
                    trialno: trialIndex + 1,
                    condition: trial.condition || '',
                    stimulus: trial.stimulus || {},
                    response: String(response),
                    correct: correct,
                    reactiontimems: rt,
                }]);
            } catch (e) {
                console.warn('[qx5Engine] 写 trial 失败', e);
            }
        })();
    }

    /* ============ 内部：结束一场 ============ */
    async function finishGame(aborted) {
        const s = state.currentSession;
        const cfg = state.currentGame;
        if (!s || !cfg) return;
        if (s.finished) return;
        s.finished = true;

        s.aborted = !!aborted;
        const endedAt = new Date().toISOString();

        let score = {};
        try {
            if (typeof cfg.computeScore === 'function') {
                score = cfg.computeScore({
                    trials: s.trials,
                    records: s.trialRecords,
                    aborted: s.aborted,
                }) || {};
            } else {
                score = defaultScore(s.trialRecords);
            }
        } catch (e) {
            console.error('[qx5Engine] computeScore 抛错', e);
            score = {};
        }

        const total = s.trialRecords.length;
        const correctCount = s.trialRecords.filter(r => r.correct === true).length;
        const startMs = new Date(s.startedat).getTime();
        const durationMs = Date.now() - startMs;

        /* 题没做完 + 用户退出 → 才算 quit */
        const realQuit = (total < s.trials.length) && s.aborted;

        try {
            await restPatch(
                'emobao_game_session',
                `sessionid=eq.${s.sessionid}`,
                {
                    endedat: endedAt,
                    durationms: durationMs,
                    totaltrials: total,
                    correcttrials: correctCount,
                    scorejson: score,
                    quitflag: realQuit,
                }
            );
        } catch (e) {
            console.warn('[qx5Engine] 更新 session 失败', e);
        }

        if (typeof cfg.renderResult === 'function') {
            try {
                cfg.renderResult(state.hostEl, {
                    score: score,
                    records: s.trialRecords,
                    aborted: s.aborted,
                    onRestart: () => restart(),
                    onExit: () => exit(),
                });
            } catch (e) {
                console.error('[qx5Engine] renderResult 抛错', e);
                renderDefaultResult(state.hostEl, score, s);
            }
        } else {
            renderDefaultResult(state.hostEl, score, s);
        }

        if (state.onComplete) {
            try { state.onComplete({ score, records: s.trialRecords, aborted: s.aborted }); } catch (e) {}
        }
    }

    /* ============ 默认计分 ============ */
    function defaultScore(records) {
        const rts = records.filter(r => r.correct === true).map(r => r.reactiontimems);
        const correct = records.filter(r => r.correct === true).length;
        const total = records.length;
        return {
            accuracy: total ? correct / total : 0,
            correctCount: correct,
            totalCount: total,
            meanRT: Math.round(mean(rts)),
        };
    }

    /* ============ 默认结果页 ============ */
    function renderDefaultResult(hostEl, score, session) {
        if (!hostEl) return;
        const cfg = state.currentGame;
        const titleCn = (cfg && cfg.title && cfg.title.cn) || '结果';
        const titleEn = (cfg && cfg.title && cfg.title.en) || 'Result';

        hostEl.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.className = 'qx5-result';
        wrap.innerHTML = `
            <div class="qx5-result-title">${t(titleCn + ' · 结果', titleEn + ' · Result')}</div>
            <div class="qx5-result-row"><span>${t('正确率','Accuracy')}</span><b>${(score.accuracy * 100).toFixed(1)}%</b></div>
            <div class="qx5-result-row"><span>${t('正确','Correct')}</span><b>${score.correctCount || 0} / ${score.totalCount || 0}</b></div>
            ${score.meanRT ? `<div class="qx5-result-row"><span>${t('平均反应时','Mean RT')}</span><b>${score.meanRT} ms</b></div>` : ''}
            <div class="qx5-result-actions">
                <button class="qx5-btn qx5-btn-primary" id="qx5_result_restart">${t('再玩一次','Play Again')}</button>
                <button class="qx5-btn qx5-btn-secondary" id="qx5_result_exit">${t('返回','Back')}</button>
            </div>
        `;
        hostEl.appendChild(wrap);

        document.getElementById('qx5_result_restart').onclick = () => restart();
        document.getElementById('qx5_result_exit').onclick = () => exit();
    }

    /* ============ 重新开始 / 退出 ============ */
    function restart() {
        if (!state.currentGame) return;
        const cfg = state.currentGame;
        start(cfg.id, state.hostEl, {
            onProgress: state.onProgress,
            onComplete: state.onComplete,
        });
    }

    function exit() {
        state.currentSession = null;
        state.currentGame = null;
        if (window.qx5_onExit) window.qx5_onExit();
    }

    /* ============ 供游戏调用：中止 ============ */
    function abort() {
        if (!state.currentSession) return;
        if (state.currentSession.finished) return;
        finishGame(true);
    }

    /* ============ 供游戏调用：进度信息 ============ */
    function getProgress() {
        const s = state.currentSession;
        if (!s) return null;
        return {
            index: s.currentIndex,
            total: s.trials.length,
        };
    }

    /* ============ 对外 ============ */
    window.qx5Engine = {
        registerGame,
        listGames,
        getGame,
        start,
        abort,
        restart,
        exit,
        getProgress,
        t,
        isGuest,
        getLang,
        getUserId,
        shuffle,
        mean,
        nowMs,
    };

})();