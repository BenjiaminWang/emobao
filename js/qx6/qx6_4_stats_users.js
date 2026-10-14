/* ================================================================
   情绪宝 - qx6-4 用户总体情况面板
   路径：js/qx6/qx6_4_stats_users.js
   日期：2026-10-13
   说明：
   - 仅系统管理员可访问
   - 显示用户总数 / 有使用记录 / 访客数
   - 用户随时间变化折线图
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_4_stats_users] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-sg-grid" id="qx6_sg_grid">
                    <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                </div>
            </div>
            <div class="qx6-card">
                <div class="qx6-card-title">${t('各类用户随时间变化', 'Users over time')}</div>
                <div class="qx6-sg-chart" id="qx6_sg_chart">
                    <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                </div>
            </div>
        `;

        const gridEl = bodyEl.querySelector('#qx6_sg_grid');
        const chartEl = bodyEl.querySelector('#qx6_sg_chart');

        (async function () {
            try {
                const totalRes = await fetch(
                    `${U.SUPABASE_URL}/rest/v1/emobao_user?select=userid`,
                    {
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                            'Prefer': 'count=exact',
                            'Range-Unit': 'items',
                            'Range': '0-0',
                        },
                    }
                );
                const totalRange = totalRes.headers.get('content-range') || '';
                const total = parseInt((totalRange.split('/')[1] || '0'), 10);

                const guestRes = await fetch(
                    `${U.SUPABASE_URL}/rest/v1/emobao_user?isguest=eq.true&select=userid`,
                    {
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                            'Prefer': 'count=exact',
                            'Range-Unit': 'items',
                            'Range': '0-0',
                        },
                    }
                );
                const guestRange = guestRes.headers.get('content-range') || '';
                const guestCount = parseInt((guestRange.split('/')[1] || '0'), 10);

                let activeCount = 0;
                try {
                    const diaryRes = await fetch(
                        `${U.SUPABASE_URL}/rest/v1/emobao_emotiondiary?select=userid`,
                        {
                            headers: {
                                'apikey': U.SUPABASE_KEY,
                                'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                            },
                        }
                    );
                    const diaries = await diaryRes.json();
                    const activeSet = new Set((diaries || []).map(d => d.userid));
                    activeCount = activeSet.size;
                } catch (e) {}

                gridEl.innerHTML = `
                    <div class="qx6-sg-item">
                        <div class="qx6-sg-num">${total}</div>
                        <div class="qx6-sg-label">${t('用户总数', 'Total Users')}</div>
                    </div>
                    <div class="qx6-sg-item">
                        <div class="qx6-sg-num">${activeCount}</div>
                        <div class="qx6-sg-label">${t('有使用记录', 'Active Users')}</div>
                    </div>
                    <div class="qx6-sg-item">
                        <div class="qx6-sg-num">${guestCount}</div>
                        <div class="qx6-sg-label">${t('访客', 'Guests')}</div>
                    </div>
                `;

                const usersRes = await fetch(
                    `${U.SUPABASE_URL}/rest/v1/emobao_user?select=createdat,usertypekey&order=createdat.asc&limit=5000`,
                    {
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                        },
                    }
                );
                const users = await usersRes.json();
                renderTimeChart(chartEl, users || []);

            } catch (e) {
                console.error(e);
                gridEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
                chartEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
            }
        })();

        function renderTimeChart(container, users) {
            if (!users.length) {
                container.innerHTML = `<div class="qx6-empty">${t('暂无数据', 'No data')}</div>`;
                return;
            }
            const dayMap = {};
            users.forEach(u => {
                const d = (u.createdat || '').slice(0, 10);
                if (!d) return;
                dayMap[d] = (dayMap[d] || 0) + 1;
            });
            const days = Object.keys(dayMap).sort();
            if (!days.length) {
                container.innerHTML = `<div class="qx6-empty">${t('暂无数据', 'No data')}</div>`;
                return;
            }
            const counts = days.map(d => dayMap[d]);
            const maxCount = Math.max(...counts, 1);
            const W = 600, H = 200, PAD = 30;
            const plotW = W - PAD * 2;
            const plotH = H - PAD * 2;
            const points = days.map((d, i) => {
                const x = PAD + (i / Math.max(1, days.length - 1)) * plotW;
                const y = PAD + plotH - (counts[i] / maxCount) * plotH;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            container.innerHTML = `
                <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:200px;">
                    <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="#E1E8F0" stroke-width="1"/>
                    <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H-PAD}" stroke="#E1E8F0" stroke-width="1"/>
                    <polyline points="${points}" fill="none" stroke="#2C7BE5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                    <text x="${PAD}" y="${H-8}" font-size="10" fill="#96A3B8">${days[0]}</text>
                    <text x="${W-PAD}" y="${H-8}" font-size="10" fill="#96A3B8" text-anchor="end">${days[days.length-1]}</text>
                    <text x="${PAD-4}" y="${PAD+8}" font-size="10" fill="#96A3B8" text-anchor="end">${maxCount}</text>
                </svg>
            `;
        }
    }

    window.qx6Register('stats_users', render);
})();