/* ================================================================
   情绪宝 - qx5 认知画像
   v2：
   - refreshBar 里 sub.innerText 改为"X / Y"短格式（配合胶囊按钮）
   - 其余同 v1
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://lmmnwmueppkdbzvufxar.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    const DIMENSIONS = [
        { id: 'speed',     cn: '反应',   en: 'Speed' },
        { id: 'attention', cn: '注意',   en: 'Attention' },
        { id: 'memory',    cn: '记忆',   en: 'Memory' },
        { id: 'emotion',   cn: '情绪',   en: 'Emotion' },
        { id: 'decision',  cn: '决策',   en: 'Decision' },
        { id: 'language',  cn: '语言',   en: 'Language' },
        { id: 'logic',     cn: '逻辑',   en: 'Logic' },
        { id: 'space',     cn: '空间',   en: 'Space' },
        { id: 'time',      cn: '时间',   en: 'Time' },
    ];

    function t(cn, en) {
        const lang = (window.mQxb && window.mQxb.Language) || 1;
        return lang === 1 ? cn : en;
    }
    function getUserId() { return (window.mQxb && window.mQxb.user_id) || null; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function isGuest() { return getUserType() === 14; }

    let state = {
        data: null,
    };

    /* ============ Supabase 拉历史 ============ */
    async function fetchHistory() {
        const uid = getUserId();
        if (!uid) return [];
        const url = `${SUPABASE_URL}/rest/v1/emobao_game_session?userid=eq.${encodeURIComponent(uid)}&order=startedat.desc&limit=200`;
        const res = await fetch(url, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        if (!res.ok) throw new Error('fetchHistory failed: ' + res.status);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    /* ============ 从历史里算分 ============ */
    function computeProfile(history) {
        const bestByDim = {};
        DIMENSIONS.forEach(d => { bestByDim[d.id] = 0; });

        history.forEach(row => {
            const cid = row.collectionid || 'misc';
            if (!bestByDim.hasOwnProperty(cid)) return;

            const score = row.scorejson || {};
            let acc = 0;
            if (typeof score.accuracy === 'number') acc = score.accuracy;
            else if (score.correctCount != null && score.totalCount) acc = score.correctCount / score.totalCount;
            else acc = 0.5;

            if (row.quitflag === true) return;

            const val = Math.max(0, Math.min(1, acc)) * 100;
            if (val > bestByDim[cid]) bestByDim[cid] = val;
        });

        const dims = {};
        DIMENSIONS.forEach(d => {
            dims[d.id] = Math.round(bestByDim[d.id]);
        });

        const playedGames = new Set(history.filter(r => !r.quitflag).map(r => r.gameid));
        const totalGames = (window.qx5Engine && window.qx5Engine.listGames)
            ? window.qx5Engine.listGames().length : 60;

        return {
            dims: dims,
            played: playedGames.size,
            total: totalGames,
            historyCount: history.length,
        };
    }

    /* ============ 画雷达图 ============ */
    function drawRadar(hostEl, dims) {
        hostEl.innerHTML = '';
        const w = Math.max(280, hostEl.clientWidth || 320);
        const h = w;
        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(w, h) * 0.32;
        const N = DIMENSIONS.length;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        for (let k = 1; k <= 4; k++) {
            const r = R * k / 4;
            const path = document.createElementNS(svgNS, 'polygon');
            const points = [];
            for (let i = 0; i < N; i++) {
                const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
                const x = cx + Math.cos(ang) * r;
                const y = cy + Math.sin(ang) * r;
                points.push(`${x},${y}`);
            }
            path.setAttribute('points', points.join(' '));
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#EEF3F8');
            path.setAttribute('stroke-width', 1);
            svg.appendChild(path);
        }

        for (let i = 0; i < N; i++) {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const x = cx + Math.cos(ang) * R;
            const y = cy + Math.sin(ang) * R;
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', cx);
            line.setAttribute('y1', cy);
            line.setAttribute('x2', x);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', '#EEF3F8');
            line.setAttribute('stroke-width', 1);
            svg.appendChild(line);
        }

        const dataPoints = [];
        DIMENSIONS.forEach((d, i) => {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const val = Math.max(0, Math.min(100, dims[d.id] || 0));
            const r = R * val / 100;
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            dataPoints.push(`${x},${y}`);
        });
        const poly = document.createElementNS(svgNS, 'polygon');
        poly.setAttribute('points', dataPoints.join(' '));
        poly.setAttribute('fill', 'rgba(44,123,229,0.25)');
        poly.setAttribute('stroke', '#2C7BE5');
        poly.setAttribute('stroke-width', 2);
        poly.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(poly);

        DIMENSIONS.forEach((d, i) => {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const val = Math.max(0, Math.min(100, dims[d.id] || 0));
            const r = R * val / 100;
            const x = cx + Math.cos(ang) * r;
            const y = cy + Math.sin(ang) * r;
            const c = document.createElementNS(svgNS, 'circle');
            c.setAttribute('cx', x);
            c.setAttribute('cy', y);
            c.setAttribute('r', 3);
            c.setAttribute('fill', '#2C7BE5');
            svg.appendChild(c);
        });

        DIMENSIONS.forEach((d, i) => {
            const ang = -Math.PI / 2 + (i / N) * Math.PI * 2;
            const lx = cx + Math.cos(ang) * (R + 18);
            const ly = cy + Math.sin(ang) * (R + 18);
            const label = document.createElementNS(svgNS, 'text');
            label.setAttribute('x', lx);
            label.setAttribute('y', ly + 3);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', 12);
            label.setAttribute('font-weight', 'bold');
            label.setAttribute('fill', '#1A2B4A');
            label.textContent = t(d.cn, d.en);
            svg.appendChild(label);

            /* 分数：画在离中心较近的位置，避免与维度名重叠 */
            const val = Math.max(0, Math.min(100, dims[d.id] || 0));
            const vlx = cx + Math.cos(ang) * Math.min(R * 0.5, R * val / 100 + 12);
            const vly = cy + Math.sin(ang) * Math.min(R * 0.5, R * val / 100 + 12);
            const vlabel = document.createElementNS(svgNS, 'text');
            vlabel.setAttribute('x', vlx);
            vlabel.setAttribute('y', vly + 3);
            vlabel.setAttribute('text-anchor', 'middle');
            vlabel.setAttribute('font-size', 10);
            vlabel.setAttribute('fill', val > 0 ? '#2C7BE5' : '#C0C8D4');
            vlabel.textContent = String(val);
            svg.appendChild(vlabel);
        });

        hostEl.appendChild(svg);
    }

    /* ============ 画维度列表 ============ */
    function drawDimList(hostEl, dims) {
        hostEl.innerHTML = '';
        DIMENSIONS.forEach(d => {
            const v = Math.max(0, Math.min(100, dims[d.id] || 0));
            const row = document.createElement('div');
            row.className = 'qx5-profile-list-row';
            row.innerHTML = `
                <div class="qx5-profile-list-name">${t(d.cn, d.en)}</div>
                <div class="qx5-profile-list-bar">
                    <div class="qx5-profile-list-fill" style="width:${v}%"></div>
                </div>
                <div class="qx5-profile-list-val">${v}</div>
            `;
            hostEl.appendChild(row);
        });
    }

    /* ============ 刷新胶囊按钮 ============ */
    async function refreshBar() {
        const bar = document.getElementById('qx5_profile_bar');
        if (!bar) return;

        if (isGuest()) {
            bar.style.display = 'none';
            return;
        }

        let history = [];
        try {
            history = await fetchHistory();
        } catch (e) {
            console.warn('[qx5Profile] 拉历史失败', e);
            bar.style.display = 'none';
            return;
        }

        if (!history.length) {
            bar.style.display = 'none';
            state.data = null;
            return;
        }

        state.data = computeProfile(history);
        bar.style.display = 'inline-flex';

        const sub = document.getElementById('qx5_profile_bar_sub');
        if (sub) {
            sub.innerText = `${state.data.played} / ${state.data.total}`;
        }
    }

    /* ============ 打开浮层 ============ */
    async function openModal() {
        const modal = document.getElementById('qx5_profile_modal');
        if (!modal) return;

        if (!state.data) {
            let history = [];
            try { history = await fetchHistory(); } catch (e) {}
            state.data = computeProfile(history);
        }

        const radarHost = document.getElementById('qx5_profile_radar');
        const listHost = document.getElementById('qx5_profile_list');
        drawRadar(radarHost, state.data.dims);
        drawDimList(listHost, state.data.dims);

        modal.style.display = 'flex';
    }

    function closeModal() {
        const modal = document.getElementById('qx5_profile_modal');
        if (modal) modal.style.display = 'none';
    }

    /* ============ init ============ */
    function bind() {
        const bar = document.getElementById('qx5_profile_bar');
        if (bar) bar.onclick = openModal;

        const closeBtn = document.getElementById('qx5_profile_modal_close');
        if (closeBtn) closeBtn.onclick = closeModal;

        const modal = document.getElementById('qx5_profile_modal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) closeModal();
            };
        }
    }

    window.qx5Profile = {
        refreshBar: refreshBar,
        openModal: openModal,
        closeModal: closeModal,
    };

    document.addEventListener('DOMContentLoaded', function () {
        bind();
    });

})();