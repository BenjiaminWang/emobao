/* ================================================================
   情绪宝 - qx5 入口
   v4：
   - 列表改为树形折叠：大类 → 游戏，默认收起
   - qx5_init 里调 qx5Profile.refreshBar() 刷新胶囊按钮
   - 其余同 v3
   ================================================================ */

   (function () {
    'use strict';

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }

    /* 大类定义与顺序 */
    const COLLECTIONS = [
        { id: 'speed',     cn: '反应速度', en: 'Speed' },
        { id: 'attention', cn: '注意力',   en: 'Attention' },
        { id: 'memory',    cn: '记忆',     en: 'Memory' },
        { id: 'emotion',   cn: '情绪',     en: 'Emotion' },
        { id: 'decision',  cn: '决策',     en: 'Decision' },
        { id: 'language',  cn: '语言',     en: 'Language' },
        { id: 'logic',     cn: '逻辑',     en: 'Logic' },
        { id: 'space',     cn: '空间',     en: 'Space' },
        { id: 'time',      cn: '时间',     en: 'Time' },
        { id: 'misc',      cn: '综合',     en: 'Misc' },
    ];

    let state = {
        initialized: false,
        currentGame: null,
        expanded: {},
    };

    function getEl(id) { return document.getElementById(id); }

    function showListView() {
        getEl('qx5_list_view').style.display = 'flex';
        getEl('qx5_play_view').style.display = 'none';
        getEl('qx5_play_host').innerHTML = '';
    }

    function showPlayView(game) {
        getEl('qx5_list_view').style.display = 'none';
        getEl('qx5_play_view').style.display = 'flex';
        getEl('qx5_play_title').innerText = t(game.title.cn, game.title.en);
        getEl('qx5_play_host').innerHTML = '';
    }

    /* ============ 树形列表渲染 ============ */
    function renderGameList() {
        const grid = getEl('qx5_game_grid');
        if (!grid) return;
        grid.innerHTML = '';
        grid.className = 'qx5-tree';

        const games = window.qx5Engine.listGames();
        if (!games.length) {
            grid.innerHTML = `<div style="text-align:center;color:#96A3B8;padding:40px 0;font-size:13px;">${t('暂无游戏', 'No games yet')}</div>`;
            return;
        }

        const byCollection = {};
        games.forEach(g => {
            const cid = g.collectionId || 'misc';
            if (!byCollection[cid]) byCollection[cid] = [];
            byCollection[cid].push(g);
        });

        COLLECTIONS.forEach(col => {
            const list = byCollection[col.id];
            if (!list || !list.length) return;

            const expanded = !!state.expanded[col.id];

            const catEl = document.createElement('div');
            catEl.className = 'qx5-tree-cat';

            const titleEl = document.createElement('div');
            titleEl.className = 'qx5-tree-cat-title';
            titleEl.innerHTML = `
                <span class="qx5-tree-arrow">${expanded ? '▼' : '▶'}</span>
                <span class="qx5-tree-cat-name">${t(col.cn, col.en)}</span>
                <span class="qx5-tree-cat-count">${list.length}</span>
            `;
            titleEl.onclick = function () {
                state.expanded[col.id] = !state.expanded[col.id];
                renderGameList();
            };
            catEl.appendChild(titleEl);

            if (expanded) {
                const childrenEl = document.createElement('div');
                childrenEl.className = 'qx5-tree-children';

                list.forEach(g => {
                    const card = document.createElement('div');
                    card.className = 'qx5-game-card';
                    card.dataset.gameId = g.id;
                    
                    // 把副标题（也就是玩法简介）用来做语音导引
                    const voiceText = t(g.subtitle.cn, g.subtitle.en);
                    
                    card.innerHTML = `
                        <div class="qx5-game-card-title" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${t(g.title.cn, g.title.en)}</span>
                            <span class="qx5-voice-btn" style="cursor:pointer; font-size:16px; padding:4px; opacity:0.6; transition:opacity 0.2s;" title="${t('语音导引', 'Voice Guide')}">🔊</span>
                        </div>
                        <div class="qx5-game-card-sub">${t(g.subtitle.cn, g.subtitle.en)}</div>
                    `;
                    
                    // 绑定语音点击事件（阻止冒泡，防止触发进入游戏）
                    const voiceBtn = card.querySelector('.qx5-voice-btn');
                    voiceBtn.onmouseenter = () => voiceBtn.style.opacity = '1';
                    voiceBtn.onmouseleave = () => voiceBtn.style.opacity = '0.6';
                    voiceBtn.onclick = function (e) {
                        e.stopPropagation(); 
                        if (window.qxSpeak) {
                            // 播放语音：游戏名字 + 玩法简介
                            const speakContent = t(`欢迎来到 ${g.title.cn}。${g.subtitle.cn}`, `Welcome to ${g.title.en}. ${g.subtitle.en}`);
                            window.qxSpeak(speakContent);
                        }
                    };
                    
                    card.onclick = function () { startGame(g.id); };
                    childrenEl.appendChild(card);
                });

                catEl.appendChild(childrenEl);
            }

            grid.appendChild(catEl);
        });
    }

    async function startGame(gameId) {
        const game = window.qx5Engine.getGame(gameId);
        if (!game) {
            console.error('[qx5] 找不到游戏', gameId);
            return;
        }
        state.currentGame = game;
        showPlayView(game);

        const hostEl = getEl('qx5_play_host');
        await window.qx5Engine.start(gameId, hostEl, {
            onComplete: function (data) {
                console.log('[qx5] 游戏结束', gameId, data);
                state.currentGame = null;
                /* 玩完后刷新胶囊按钮的"已玩"计数 */
                if (window.qx5Profile && typeof window.qx5Profile.refreshBar === 'function') {
                    try { window.qx5Profile.refreshBar(); } catch (e) {}
                }
            },
        });
    }

    window.qx5_onExit = function () {
        state.currentGame = null;
        showListView();
    };

    function onQuitClick() {
        if (state.currentGame) {
            if (!confirm(t('确定退出游戏吗？本次进度会保存', 'Quit? Progress will be saved.'))) return;
            try { window.qx5Engine.abort(); } catch (e) {}
            state.currentGame = null;
            showListView();
        } else {
            window.returnToMain();
        }
    }

    async function qx5_init() {
        console.log('qx5_init 开始');
        if (state.initialized) return;

        state.currentGame = null;
        state.expanded = {};
        renderGameList();
        showListView();

        const exitBtn = getEl('qx5_btn_exit');
        if (exitBtn) exitBtn.onclick = function () { window.returnToMain(); };

        const quitBtn = getEl('qx5_btn_quit');
        if (quitBtn) quitBtn.onclick = onQuitClick;

        /* 刷新认知画像胶囊按钮 */
        if (window.qx5Profile && typeof window.qx5Profile.refreshBar === 'function') {
            try { await window.qx5Profile.refreshBar(); } catch (e) {}
        }

        state.initialized = true;
        console.log('qx5_init 完成');
    }

    function qx5_destroy() {
        console.log('qx5_destroy');
        state.initialized = false;
        state.currentGame = null;
        try { window.qx5Engine.abort(); } catch (e) {}
        const grid = getEl('qx5_game_grid');
        if (grid) grid.innerHTML = '';
        const host = getEl('qx5_play_host');
        if (host) host.innerHTML = '';
    }

    window.qx5_init = qx5_init;
    window.qx5_destroy = qx5_destroy;

})();