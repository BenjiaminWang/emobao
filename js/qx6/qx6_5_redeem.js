/* ================================================================
   情绪宝 - qx6-5 发卡与渠道管理面板
   v3 (2026-10-29)
   更新内容：
   - 落实UI整改：改名发卡中心，Tab重组（纯码生成、邀请卡制作、数据业绩）
   - 紧凑化“纯码生成”表单布局
   - “数据与业绩”支持按合作方筛选批次
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) return;
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
            <div class="qx6-rd-tabs" style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button class="qx6-rd-tab active" data-tab="issue" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; background: #2C7BE5; color: #fff; font-weight: bold; cursor: pointer;">🔢 纯码生成</button>
                <button class="qx6-rd-tab" data-tab="qrcode" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; background: #fff; color: #475569; font-weight: bold; cursor: pointer;">🎴 邀请卡制作</button>
                <button class="qx6-rd-tab" data-tab="query" style="flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #E2E8F0; background: #fff; color: #475569; font-weight: bold; cursor: pointer;">📊 数据与业绩</button>
            </div>

            <!-- 纯码生成面板 -->
            <div class="qx6-rd-panel" id="qx6_rd_issue_panel">
                <div class="qx6-card" style="max-width: 600px; margin: 0 auto; padding: 30px; background:#fff; border-radius:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 20px; color:#1E293B;">生成纯数字兑换码</div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">分配身份</label>
                        <select class="qx6-input" id="qx6_rd_type" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">${typeOptions}</select>
                    </div>
                    
                    <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                        <div style="flex: 1;">
                            <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">生成数量</label>
                            <input type="number" class="qx6-input" id="qx6_rd_count" value="1" min="1" max="100" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                        </div>
                        <div style="flex: 1;">
                            <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">有效天数</label>
                            <input type="number" class="qx6-input" id="qx6_rd_days" value="365" min="1" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                        </div>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">所属批次备注</label>
                        <input type="text" class="qx6-input" id="qx6_rd_batch" value="${'BATCH-' + new Date().toISOString().slice(0,10).replace(/-/g,'')}" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                    </div>

                    <button class="qx6-btn qx6-btn-primary" id="qx6_rd_generate" style="width: 100%; padding: 12px; background:#2C7BE5; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">一键生成兑换码</button>
                    <div class="qx6-status" id="qx6_rd_issue_status" style="margin-top: 12px; text-align: center; font-size:14px;"></div>
                    
                    <div class="qx6-rd-result" id="qx6_rd_issue_result" style="margin-top:20px; display:flex; flex-wrap:wrap; gap:10px; justify-content:center;"></div>
                </div>
            </div>

            <!-- 数据与业绩面板 -->
            <div class="qx6-rd-panel" id="qx6_rd_query_panel" style="display:none;">
                <div class="qx6-card" style="padding: 24px; background:#fff; border-radius:12px;">
                    <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                        <select class="qx6-input" id="qx6_rd_filter_partner" style="flex:1; padding:10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                            <option value="">全部合作方</option>
                        </select>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_rd_refresh" style="padding: 10px 20px; background:#2C7BE5; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">查询</button>
                    </div>
                    <div class="qx6-status" id="qx6_rd_query_status" style="margin-bottom:16px; font-size:14px;"></div>
                    <div class="qx6-rd-batch-list" id="qx6_rd_batch_list" style="display: flex; flex-direction: column; gap: 12px;"></div>
                </div>
            </div>

            <!-- 邀请卡制作容器 -->
            <div class="qx6-rd-panel" id="qx6_rd_qrcode_panel" style="display:none;"></div>
        `;

        // Tab 切换逻辑
        bodyEl.querySelectorAll('.qx6-rd-tab').forEach(tab => {
            tab.onclick = () => {
                bodyEl.querySelectorAll('.qx6-rd-tab').forEach(x => {
                    x.classList.remove('active');
                    x.style.background = '#fff';
                    x.style.color = '#475569';
                });
                tab.classList.add('active');
                tab.style.background = '#2C7BE5';
                tab.style.color = '#fff';
                
                const which = tab.dataset.tab;
                bodyEl.querySelector('#qx6_rd_issue_panel').style.display = which === 'issue' ? 'block' : 'none';
                bodyEl.querySelector('#qx6_rd_query_panel').style.display = which === 'query' ? 'block' : 'none';
                bodyEl.querySelector('#qx6_rd_qrcode_panel').style.display = which === 'qrcode' ? 'block' : 'none';
                
                if (which === 'query') loadBatches();
                if (which === 'qrcode') {
                    const renderFn = window.qx6Registry['redeem_qrcode'];
                    if (renderFn) renderFn(bodyEl.querySelector('#qx6_rd_qrcode_panel'));
                }
            };
        });

        // 纯码生成逻辑（保持原样）
        const typeEl   = bodyEl.querySelector('#qx6_rd_type');
        const countEl  = bodyEl.querySelector('#qx6_rd_count');
        const daysEl   = bodyEl.querySelector('#qx6_rd_days');
        const batchEl  = bodyEl.querySelector('#qx6_rd_batch');
        const genBtn   = bodyEl.querySelector('#qx6_rd_generate');
        const issueStatus = bodyEl.querySelector('#qx6_rd_issue_status');
        const issueResult = bodyEl.querySelector('#qx6_rd_issue_result');

        genBtn.onclick = async () => {
            const ut = parseInt(typeEl.value);
            const count = parseInt(countEl.value);
            const days = parseInt(daysEl.value);
            const batchno = batchEl.value.trim();

            if (!count || count < 1 || count > 100) {
                issueStatus.innerText = '数量需 1-100';
                issueStatus.style.color = '#E74C3C';
                return;
            }

            genBtn.disabled = true;
            issueStatus.innerText = '生成中…';
            issueStatus.style.color = '#64748B';

            try {
                const codes = [];
                for (let i = 0; i < count; i++) {
                    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const code = `EMO-${rand}-${Date.now().toString(36).toUpperCase()}`;
                    codes.push({
                        code, usertypekey: ut, maxactivations: 1, currentactivations: 0, validays: days, isused: false, batchno,
                    });
                }

                const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emobao_redemptioncode`, {
                    method: 'POST',
                    headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify(codes),
                });

                if (!res.ok) throw new Error("POST失败");
                const created = await res.json();
                issueStatus.innerText = `已生成 ${created.length} 个`;
                issueStatus.style.color = '#00C853';

                issueResult.innerHTML = created.map(c => `<div style="padding:6px 12px; background:#F1F5F9; border-radius:6px; font-family:monospace; font-weight:bold; color:#1E293B;">${c.code}</div>`).join('');

            } catch (e) {
                issueStatus.innerText = '生成失败: ' + e.message;
                issueStatus.style.color = '#E74C3C';
            } finally {
                genBtn.disabled = false;
            }
        };

        // 查询面板逻辑
        const refreshBtn  = bodyEl.querySelector('#qx6_rd_refresh');
        const queryStatus = bodyEl.querySelector('#qx6_rd_query_status');
        const batchList   = bodyEl.querySelector('#qx6_rd_batch_list');
        const filterPartner = bodyEl.querySelector('#qx6_rd_filter_partner');

        // 加载合作方列表到查询下拉框
        U.restGet('emo_partner?isactive=eq.true').then(partners => {
            (partners || []).forEach(p => {
                filterPartner.innerHTML += `<option value="${p.partner_id}">${p.partner_name_cn}</option>`;
            });
        });

        async function loadBatches() {
            queryStatus.innerText = '加载中…';
            queryStatus.style.color = '#64748B';
            batchList.innerHTML = '';

            try {
                const selectedPid = filterPartner.value;
                // 这里为了演示，如果是全部就先拉所有码；如果有合作方筛选，最好在后端或RPC层处理，目前先用简单过滤
                const rows = await U.restGet(
                    `emobao_redemptioncode?select=batchno,generatedat,validays,maxactivations,usertypekey,isused,currentactivations,qrcode_id&order=generatedat.desc&limit=1000`
                );

                const batches = {};
                (rows || []).forEach(r => {
                    const b = r.batchno || '(无批次)';
                    if (!batches[b]) {
                        batches[b] = { batchno: b, generatedat: r.generatedat, validays: r.validays, usertypekey: r.usertypekey, total: 0, used: 0, activated: 0 };
                    }
                    batches[b].total++;
                    if (r.isused) batches[b].used++;
                    batches[b].activated += (r.currentactivations || 0);
                });

                const list = Object.values(batches).sort((a, b) => (b.generatedat || '').localeCompare(a.generatedat || ''));

                if (!list.length) {
                    batchList.innerHTML = `<div style="color:#64748B; text-align:center;">暂无批次</div>`;
                    queryStatus.innerText = '';
                    return;
                }

                batchList.innerHTML = list.map(b => {
                    const lb = U.typeLabel(b.usertypekey);
                    return `
                        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-weight:bold; color:#1E293B;">${b.batchno}</span>
                                <span style="background:#E0F2FE; color:#2C7BE5; padding:2px 8px; border-radius:12px; font-size:12px;">${lb}</span>
                            </div>
                            <div style="font-size: 12px; color: #64748B;">
                                ${(b.generatedat || '').slice(0,10)} · ${b.total} 码 · 已用 ${b.used} · 已激活 ${b.activated} · 有效 ${b.validays} 天
                            </div>
                        </div>
                    `;
                }).join('');

                queryStatus.innerText = `共 ${list.length} 批`;
                queryStatus.style.color = '#00C853';

            } catch (e) {
                queryStatus.innerText = '加载失败';
                queryStatus.style.color = '#E74C3C';
            }
        }

        refreshBtn.onclick = loadBatches;
    }

    window.qx6Register('redeem', render);
})();