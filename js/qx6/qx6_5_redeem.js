/* ================================================================
   情绪宝 - qx6-5 发卡与渠道管理面板
   v6.2 (2026-11-05) 完整无错版
   更新内容：
   - 纯码生成面板：增加“所属合作方”下拉框，生成的码自动挂靠。
   - 纯码生成面板：增加“使用名额”输入框，不再写死 1 人。
   - 数据与业绩：修复关联查询，能明确显示合作方名称（如：海花岛健身中心）。
   - 数据与业绩：增加 🗑️ 删除批次功能，一键清理测试垃圾数据。
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
                        <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">所属合作方</label>
                        <select class="qx6-input" id="qx6_rd_partner" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                            <option value="">加载中...</option>
                        </select>
                    </div>

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
                            <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">使用名额</label>
                            <input type="number" class="qx6-input" id="qx6_rd_maxact" value="1" min="1" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;" title="1个码能供多少人使用">
                        </div>
                        <div style="flex: 1;">
                            <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">有效天数</label>
                            <input type="number" class="qx6-input" id="qx6_rd_days" value="365" min="1" style="width: 100%; padding: 10px; border-radius:8px; border:1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                        </div>
                    </div>

                    <div style="margin-bottom: 24px;">
                        <label style="display:block; font-weight: bold; margin-bottom: 8px; color:#1E293B;">批次名称</label>
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

        // 纯码生成逻辑
        const partnerEl = bodyEl.querySelector('#qx6_rd_partner');
        const typeEl   = bodyEl.querySelector('#qx6_rd_type');
        const countEl  = bodyEl.querySelector('#qx6_rd_count');
        const maxActEl = bodyEl.querySelector('#qx6_rd_maxact');
        const daysEl   = bodyEl.querySelector('#qx6_rd_days');
        const batchEl  = bodyEl.querySelector('#qx6_rd_batch');
        const genBtn   = bodyEl.querySelector('#qx6_rd_generate');
        const issueStatus = bodyEl.querySelector('#qx6_rd_issue_status');
        const issueResult = bodyEl.querySelector('#qx6_rd_issue_result');

        // 加载合作方下拉框
        let cachedPartners = [];
        U.restGet('emo_partner?isactive=eq.true&order=partner_code').then(partners => {
            cachedPartners = partners || [];
            partnerEl.innerHTML = '<option value="">-- 请选择 --</option>';
            cachedPartners.forEach(p => {
                partnerEl.innerHTML += `<option value="${p.partner_id}">${p.partner_name_cn}</option>`;
            });
        });

        genBtn.onclick = async () => {
            const pid = partnerEl.value;
            const ut = parseInt(typeEl.value);
            const count = parseInt(countEl.value);
            const maxact = parseInt(maxActEl.value) || 1;
            const days = parseInt(daysEl.value);
            const batchno = batchEl.value.trim();

            if (!pid) {
                issueStatus.innerText = '请选择所属合作方';
                issueStatus.style.color = '#E74C3C';
                return;
            }
            if (!count || count < 1 || count > 100) {
                issueStatus.innerText = '生成数量需 1-100';
                issueStatus.style.color = '#E74C3C';
                return;
            }

            genBtn.disabled = true;
            issueStatus.innerText = '处理中…';
            issueStatus.style.color = '#64748B';

            try {
                // 1. 自动在 emo_qrcode_image 表里建一个批次记录来挂靠
                const randLabel = `纯码批次 ${new Date().toLocaleDateString()}`;
                const imgRes = await fetch(`${U.SUPABASE_URL}/rest/v1/emo_qrcode_image`, {
                    method: 'POST',
                    headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify({ 
                        qrcode_label: randLabel, 
                        landing_path: 'qx00_login.html', 
                        isactive: true, 
                        partner_id: pid 
                    })
                });
                if (!imgRes.ok) throw new Error("创建批次关联失败");
                const imgData = await imgRes.json();
                const qid = imgData[0].qrcode_id; 

                const codes = [];
                for (let i = 0; i < count; i++) {
                    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
                    const code = `EMO-${rand}-${Date.now().toString(36).toUpperCase()}`;
                    codes.push({
                        code, 
                        usertypekey: ut, 
                        maxactivations: maxact, 
                        currentactivations: 0, 
                        validays: days, 
                        isused: false, 
                        batchno,
                        qrcode_id: qid
                    });
                }

                const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emobao_redemptioncode`, {
                    method: 'POST',
                    headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify(codes),
                });

                if (!res.ok) throw new Error("生成码失败");
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

        // ==========================================
        // 查询面板逻辑
        // ==========================================
        const refreshBtn  = bodyEl.querySelector('#qx6_rd_refresh');
        const queryStatus = bodyEl.querySelector('#qx6_rd_query_status');
        const batchList   = bodyEl.querySelector('#qx6_rd_batch_list');
        const filterPartner = bodyEl.querySelector('#qx6_rd_filter_partner');

        // 加载合作方列表到查询下拉框
        U.restGet('emo_partner?isactive=eq.true').then(partners => {
            filterPartner.innerHTML = '<option value="">全部合作方</option>';
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
                
                const rows = await U.restGet(
                    `emobao_redemptioncode?select=batchno,generatedat,validays,maxactivations,usertypekey,isused,currentactivations,qrcode_id&order=generatedat.desc&limit=1000`
                );

                const qids = [...new Set((rows || []).map(r => r.qrcode_id).filter(Boolean))];
                
                let qrMap = {};
                if (qids.length > 0) {
                    const qrImages = await U.restGet(`emo_qrcode_image?qrcode_id=in.(${qids.map(x=>`"${x}"`).join(',')})&select=qrcode_id,qrcode_label,partner_id`);
                    
                    const pids = [...new Set((qrImages || []).map(q => q.partner_id).filter(Boolean))];
                    let partnerMap = {};
                    if (pids.length > 0) {
                        const partners = await U.restGet(`emo_partner?partner_id=in.(${pids.map(x=>`"${x}"`).join(',')})&select=partner_id,partner_name_cn`);
                        (partners || []).forEach(p => { partnerMap[p.partner_id] = p.partner_name_cn; });
                    }

                    (qrImages || []).forEach(q => {
                        qrMap[q.qrcode_id] = {
                            label: q.qrcode_label,
                            partnerName: partnerMap[q.partner_id] || '未知合作方',
                            partnerId: q.partner_id
                        };
                    });
                }

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
                            qrInfo: qrMap[r.qrcode_id] || null 
                        };
                    }
                    batches[b].total++;
                    if (r.isused) batches[b].used++;
                    batches[b].activated += (r.currentactivations || 0);
                });

                let list = Object.values(batches).sort((a, b) => (b.generatedat || '').localeCompare(a.generatedat || ''));

                if (selectedPid) {
                    list = list.filter(item => item.qrInfo && item.qrInfo.partnerId === selectedPid);
                }

                if (!list.length) {
                    batchList.innerHTML = `<div style="color:#64748B; text-align:center;">暂无符合条件的批次</div>`;
                    queryStatus.innerText = '';
                    return;
                }

                batchList.innerHTML = list.map(b => {
                    const lb = U.typeLabel(b.usertypekey);
                    
                    let contextHtml = '';
                    if (b.qrInfo) {
                        contextHtml = `<div style="margin-bottom: 8px; font-size: 14px; color: #1E293B; font-weight: bold;">🏢 ${b.qrInfo.partnerName}</div>`;
                    } else {
                        contextHtml = `<div style="margin-bottom: 8px; font-size: 13px; color: #94A3B8;">未关联合作方</div>`;
                    }

                    // 渲染每一项时带上删除按钮，data-batch 存批次号
                    return `
                        <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; position: relative;">
                            ${contextHtml}
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-weight:bold; color:#475569; font-size: 13px;">批次: ${b.batchno}</span>
                                <span style="background:#E0F2FE; color:#2C7BE5; padding:2px 8px; border-radius:12px; font-size:12px;">${lb}</span>
                            </div>
                            <div style="font-size: 12px; color: #64748B;">
                                ${(b.generatedat || '').slice(0,10)} · ${b.total} 码 · 已激活 ${b.activated} · 有效 ${b.validays} 天 · 单码名额:${b.maxactivations}
                            </div>
                            
                            <!-- 删除按钮 -->
                            <button class="qx6-btn-delete-batch" data-batch="${b.batchno}" title="删除此批次" 
                                style="position: absolute; right: 12px; bottom: 12px; background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.6; transition: opacity 0.2s;">
                                🗑️
                            </button>
                        </div>
                    `;
                }).join('');

                // 绑定删除事件
                batchList.querySelectorAll('.qx6-btn-delete-batch').forEach(btn => {
                    btn.onmouseenter = () => btn.style.opacity = '1';
                    btn.onmouseleave = () => btn.style.opacity = '0.6';
                    
                    btn.onclick = async (e) => {
                        const batchnoToDel = e.target.dataset.batch;
                        if (!batchnoToDel) return;

                        // 双重确认，防误触
                        if (!confirm(`⚠️ 确定要删除批次 [${batchnoToDel}] 及其包含的所有兑换码吗？`)) return;
                        if (!confirm(`再次确认：此操作不可恢复！`)) return;

                        e.target.innerText = '⏳';
                        e.target.disabled = true;

                        try {
                            // 1. 删除这批兑换码
                            const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emobao_redemptioncode?batchno=eq.${encodeURIComponent(batchnoToDel)}`, {
                                method: 'DELETE',
                                headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}` }
                            });
                            if (!res.ok) throw new Error("删除兑换码失败");

                            queryStatus.innerText = '删除成功';
                            queryStatus.style.color = '#00C853';
                            loadBatches(); // 刷新列表
                        } catch (err) {
                            alert("删除失败：" + err.message);
                            e.target.innerText = '🗑️';
                            e.target.disabled = false;
                        }
                    };
                });

                queryStatus.innerText = `共 ${list.length} 批`;
                queryStatus.style.color = '#00C853';

            } catch (e) {
                console.error(e);
                queryStatus.innerText = '加载失败';
                queryStatus.style.color = '#E74C3C';
            }
        }

        const refreshEl = bodyEl.querySelector('#qx6_rd_refresh');
        if (refreshEl) refreshEl.onclick = loadBatches;
    }

    window.qx6Register('redeem', render);
})();