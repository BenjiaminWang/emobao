/* ================================================================
   情绪宝 - qx6-5 兑换码管理面板
   路径：js/qx6/qx6_5_redeem.js
   日期：2026-10-13
   说明：
   - 仅系统管理员可访问
   - 发放：按身份/数量/有效天数/上限/批次号生成兑换码
   - 查询：按批次聚合显示
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_5_redeem] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        const map = U.typeMap();
        const typeOptions = U.typeKeysSorted().map(k => {
            const lb = map[k];
            const lang = (window.mQxb && window.mQxb.Language) || 1;
            const name = lang === 1 ? lb.cn : lb.en;
            return `<option value="${k}">${k} - ${name}</option>`;
        }).join('');

        bodyEl.innerHTML = `
            <div class="qx6-rd-tabs">
                <button class="qx6-rd-tab active" data-tab="issue">${t('发放', 'Issue')}</button>
                <button class="qx6-rd-tab" data-tab="query">${t('查询', 'Query')}</button>
            </div>

            <div class="qx6-rd-panel" id="qx6_rd_issue_panel">
                <div class="qx6-card">
                    <div class="qx6-rd-field">
                        <label>${t('目标身份', 'Target Type')}</label>
                        <select class="qx6-input" id="qx6_rd_type">${typeOptions}</select>
                    </div>
                    <div class="qx6-rd-field">
                        <label>${t('数量', 'Count')}</label>
                        <input type="number" class="qx6-input" id="qx6_rd_count" value="1" min="1" max="100">
                    </div>
                    <div class="qx6-rd-field">
                        <label>${t('有效天数', 'Valid Days')}</label>
                        <input type="number" class="qx6-input" id="qx6_rd_days" value="365" min="1">
                    </div>
                    <div class="qx6-rd-field">
                        <label>${t('团队上限（企业/家庭）', 'Max Activations (Enterprise/Family)')}</label>
                        <input type="number" class="qx6-input" id="qx6_rd_maxact" value="1" min="1">
                    </div>
                    <div class="qx6-rd-field">
                        <label>${t('批次号', 'Batch No')}</label>
                        <input type="text" class="qx6-input" id="qx6_rd_batch" value="${'BATCH-' + new Date().toISOString().slice(0,10).replace(/-/g,'')}">
                    </div>
                    <button class="qx6-btn qx6-btn-primary" id="qx6_rd_generate">${t('生成', 'Generate')}</button>
                    <div class="qx6-status" id="qx6_rd_issue_status"></div>
                    <div class="qx6-rd-result" id="qx6_rd_issue_result"></div>
                </div>
            </div>

            <div class="qx6-rd-panel" id="qx6_rd_query_panel" style="display:none;">
                <div class="qx6-card">
                    <button class="qx6-btn qx6-btn-primary" id="qx6_rd_refresh">${t('刷新批次列表', 'Refresh Batches')}</button>
                    <div class="qx6-status" id="qx6_rd_query_status"></div>
                    <div class="qx6-rd-batch-list" id="qx6_rd_batch_list"></div>
                </div>
            </div>
        `;

        bodyEl.querySelectorAll('.qx6-rd-tab').forEach(tab => {
            tab.onclick = () => {
                bodyEl.querySelectorAll('.qx6-rd-tab').forEach(x => x.classList.remove('active'));
                tab.classList.add('active');
                const which = tab.dataset.tab;
                bodyEl.querySelector('#qx6_rd_issue_panel').style.display = which === 'issue' ? 'block' : 'none';
                bodyEl.querySelector('#qx6_rd_query_panel').style.display = which === 'query' ? 'block' : 'none';
                if (which === 'query') loadBatches();
            };
        });

        const typeEl   = bodyEl.querySelector('#qx6_rd_type');
        const countEl  = bodyEl.querySelector('#qx6_rd_count');
        const daysEl   = bodyEl.querySelector('#qx6_rd_days');
        const maxActEl = bodyEl.querySelector('#qx6_rd_maxact');
        const batchEl  = bodyEl.querySelector('#qx6_rd_batch');
        const genBtn   = bodyEl.querySelector('#qx6_rd_generate');
        const issueStatus = bodyEl.querySelector('#qx6_rd_issue_status');
        const issueResult = bodyEl.querySelector('#qx6_rd_issue_result');
        const refreshBtn  = bodyEl.querySelector('#qx6_rd_refresh');
        const queryStatus = bodyEl.querySelector('#qx6_rd_query_status');
        const batchList   = bodyEl.querySelector('#qx6_rd_batch_list');

        typeEl.onchange = () => {
            const ut = parseInt(typeEl.value);
            if (ut === 6) {
                maxActEl.value = 5;
                maxActEl.disabled = true;
            } else if (ut === 11) {
                maxActEl.value = 50;
                maxActEl.disabled = false;
            } else {
                maxActEl.value = 1;
                maxActEl.disabled = true;
            }
        };
        typeEl.onchange();

        genBtn.onclick = async () => {
            const ut = parseInt(typeEl.value);
            const count = parseInt(countEl.value);
            const days = parseInt(daysEl.value);
            const maxAct = parseInt(maxActEl.value);
            const batchno = batchEl.value.trim();

            if (!count || count < 1 || count > 100) {
                issueStatus.innerText = t('数量需 1-100', 'Count must be 1-100');
                issueStatus.className = 'qx6-status qx6-status-error';
                return;
            }

            genBtn.disabled = true;
            issueStatus.innerText = t('生成中…', 'Generating…');
            issueStatus.className = 'qx6-status qx6-status-info';

            try {
                const codes = [];
                for (let i = 0; i < count; i++) {
                    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const code = `EMO-${rand}-${Date.now().toString(36).toUpperCase()}`;
                    codes.push({
                        code,
                        usertypekey: ut,
                        maxactivations: maxAct,
                        currentactivations: 0,
                        validays: days,
                        isused: false,
                        batchno,
                    });
                }

                const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emobao_redemptioncode`, {
                    method: 'POST',
                    headers: {
                        'apikey': U.SUPABASE_KEY,
                        'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify(codes),
                });

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(`POST ${res.status} ${txt}`);
                }

                const created = await res.json();
                issueStatus.innerText = t(`已生成 ${created.length} 个`, `Generated ${created.length}`);
                issueStatus.className = 'qx6-status qx6-status-success';

                issueResult.innerHTML = created.map(c =>
                    `<div class="qx6-rd-code">${c.code}</div>`
                ).join('');

            } catch (e) {
                console.error(e);
                issueStatus.innerText = t('生成失败：', 'Generate failed: ') + e.message;
                issueStatus.className = 'qx6-status qx6-status-error';
            } finally {
                genBtn.disabled = false;
            }
        };

        async function loadBatches() {
            queryStatus.innerText = t('加载中…', 'Loading…');
            queryStatus.className = 'qx6-status qx6-status-info';
            batchList.innerHTML = '';

            try {
                const rows = await U.restGet(
                    `emobao_redemptioncode?select=batchno,generatedat,validays,maxactivations,usertypekey,isused,currentactivations&order=generatedat.desc&limit=1000`
                );

                const batches = {};
                (rows || []).forEach(r => {
                    const b = r.batchno || '(无批次)';
                    if (!batches[b]) {
                        batches[b] = {
                            batchno: b,
                            generatedat: r.generatedat,
                            validays: r.validays,
                            maxactivations: r.maxactivations,
                            usertypekey: r.usertypekey,
                            total: 0,
                            used: 0,
                            activated: 0,
                        };
                    }
                    batches[b].total++;
                    if (r.isused) batches[b].used++;
                    batches[b].activated += (r.currentactivations || 0);
                });

                const list = Object.values(batches).sort((a, b) =>
                    (b.generatedat || '').localeCompare(a.generatedat || '')
                );

                if (!list.length) {
                    batchList.innerHTML = `<div class="qx6-empty">${t('暂无批次', 'No batches')}</div>`;
                    queryStatus.innerText = '';
                    return;
                }

                batchList.innerHTML = list.map(b => {
                    const lb = U.typeLabel(b.usertypekey);
                    return `
                        <div class="qx6-rd-batch" data-batch="${b.batchno}">
                            <div class="qx6-rd-batch-head">
                                <span class="qx6-rd-batch-no">${b.batchno}</span>
                                <span class="qx6-rd-batch-type">${lb}</span>
                            </div>
                            <div class="qx6-rd-batch-meta">
                                ${(b.generatedat || '').slice(0,10)} ·
                                ${b.total} 码 ·
                                已用 ${b.used} ·
                                已激活 ${b.activated} ·
                                有效 ${b.validays} 天 ·
                                上限 ${b.maxactivations}
                            </div>
                        </div>
                    `;
                }).join('');

                queryStatus.innerText = t(`共 ${list.length} 批`, `${list.length} batches`);
                queryStatus.className = 'qx6-status qx6-status-success';

            } catch (e) {
                console.error(e);
                queryStatus.innerText = t('加载失败', 'Load failed');
                queryStatus.className = 'qx6-status qx6-status-error';
            }
        }

        refreshBtn.onclick = loadBatches;
    }

    window.qx6Register('redeem', render);
})();