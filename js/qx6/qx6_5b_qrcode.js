/* ================================================================
   情绪宝 - qx6-5b 二维码生成面板
   v17 (2026-10-29)
   更新内容：
   - 新增：生成卡片时，支持操作者选择“身份”和“有效天数”
   - 修复：彻底接管合作方改名、新建批次等弹窗逻辑
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) return;
    const t = U.t;

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ================= 1. 企业信息大表单弹窗 =================
    function showPartnerModal(partnerData, callback) {
        const isEdit = !!partnerData;
        const title = isEdit ? '编辑合作方信息' : '新建合作方';
        
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 99999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px);';

        const modal = document.createElement('div');
        modal.style.cssText = 'background: #fff; padding: 24px; border-radius: 12px; width: 340px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; flex-direction: column; transform: scale(0.95); transition: all 0.2s ease;';

        modal.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; color: #1E293B; margin-bottom: 16px;">${title}</div>
            
            <label style="font-size:13px; color:#64748B; margin-bottom:4px;">企业/合作方名称 *</label>
            <input type="text" id="qx6_p_name" value="${isEdit ? esc(partnerData.partner_name_cn) : ''}" placeholder="如：凤凰健身房" style="width: 100%; padding: 8px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 14px; outline: none; margin-bottom: 12px; box-sizing: border-box;">

            <label style="font-size:13px; color:#64748B; margin-bottom:4px;">联系人姓名</label>
            <input type="text" id="qx6_p_contact" value="${isEdit ? esc(partnerData.contact_name || '') : ''}" placeholder="如：王经理" style="width: 100%; padding: 8px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 14px; outline: none; margin-bottom: 12px; box-sizing: border-box;">

            <label style="font-size:13px; color:#64748B; margin-bottom:4px;">联系电话</label>
            <input type="text" id="qx6_p_phone" value="${isEdit ? esc(partnerData.contact_phone || '') : ''}" placeholder="如：13800138000" style="width: 100%; padding: 8px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 14px; outline: none; margin-bottom: 12px; box-sizing: border-box;">

            <label style="font-size:13px; color:#64748B; margin-bottom:4px;">备注信息</label>
            <input type="text" id="qx6_p_remark" value="${isEdit ? esc(partnerData.remark || '') : ''}" placeholder="如：年框协议客户" style="width: 100%; padding: 8px 10px; border: 1px solid #CBD5E1; border-radius: 6px; font-size: 14px; outline: none; margin-bottom: 20px; box-sizing: border-box;">

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="qx6_p_cancel" style="padding: 8px 16px; border-radius: 6px; border: none; background: #F1F5F9; color: #475569; cursor: pointer; font-size: 14px;">取消</button>
                <button id="qx6_p_confirm" style="padding: 8px 16px; border-radius: 6px; border: none; background: #2C7BE5; color: #fff; cursor: pointer; font-size: 14px;">保存</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        setTimeout(() => { 
            modal.style.transform = 'scale(1)'; 
            modal.querySelector('#qx6_p_name').focus(); 
        }, 10);

        const close = () => { 
            modal.style.transform = 'scale(0.95)'; 
            overlay.style.opacity = '0'; 
            setTimeout(() => document.body.removeChild(overlay), 200); 
        };

        modal.querySelector('#qx6_p_cancel').onclick = close;

        modal.querySelector('#qx6_p_confirm').onclick = () => {
            const name = modal.querySelector('#qx6_p_name').value.trim();
            if (!name) { alert("名称不能为空！"); return; }
            
            const data = {
                partner_name_cn: name,
                contact_name: modal.querySelector('#qx6_p_contact').value.trim() || '',
                contact_phone: modal.querySelector('#qx6_p_phone').value.trim() || '',
                remark: modal.querySelector('#qx6_p_remark').value.trim() || '',
                isactive: true
            };
            
            close();
            callback(data);
        };
    }

    // ================= 2. 单行输入小弹窗 =================
    function showSimplePrompt(title, placeholder, callback) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 99999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(2px);';

        const modal = document.createElement('div');
        modal.style.cssText = 'background: #fff; padding: 24px; border-radius: 12px; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; flex-direction: column; transform: scale(0.95); transition: all 0.2s ease;';

        modal.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; color: #1E293B; margin-bottom: 16px;">${title}</div>
            <input type="text" id="qx6_simple_input" placeholder="${placeholder}" style="width: 100%; padding: 10px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 14px; outline: none; margin-bottom: 20px; box-sizing: border-box;">
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button id="qx6_simple_cancel" style="padding: 8px 16px; border-radius: 6px; border: none; background: #F1F5F9; color: #475569; cursor: pointer; font-size: 14px;">取消</button>
                <button id="qx6_simple_confirm" style="padding: 8px 16px; border-radius: 6px; border: none; background: #2C7BE5; color: #fff; cursor: pointer; font-size: 14px;">确定</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = modal.querySelector('#qx6_simple_input');
        setTimeout(() => { modal.style.transform = 'scale(1)'; input.focus(); }, 10);

        const close = () => { modal.style.transform = 'scale(0.95)'; overlay.style.opacity = '0'; setTimeout(() => document.body.removeChild(overlay), 200); };

        modal.querySelector('#qx6_simple_cancel').onclick = close;

        modal.querySelector('#qx6_simple_confirm').onclick = () => {
            const val = input.value.trim();
            if (!val) { alert("内容不能为空！"); return; }
            close();
            callback(val);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') modal.querySelector('#qx6_simple_confirm').click();
            if (e.key === 'Escape') close();
        };
    }

    // ================= 3. 主渲染逻辑 =================
    function render(bodyEl) {
        if (!U.isAdmin()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员可访问。', 'Admin only.')}</div>`;
            return;
        }

        if (typeof window.QRCode === 'undefined') {
            bodyEl.innerHTML = `<div style="padding:20px; color:red; text-align:center;">⚠️ 二维码库未加载，请检查 index.html 引入路径。</div>`;
            return;
        }

        // 获取身份字典，用来渲染下拉框
        const map = U.typeMap();
        const typeOptions = U.typeKeysSorted().map(k => {
            const lb = map[k];
            const lang = (window.mQxb && window.mQxb.Language) || 1;
            const name = lang === 1 ? lb.cn : lb.en;
            return `<option value="${k}">${k} - ${name}</option>`;
        }).join('');

        bodyEl.innerHTML = `
            <div class="qx6-card" style="padding: 24px; background:#fff; border-radius:12px; margin-bottom:20px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
                    <div style="font-size: 18px; font-weight: bold; color: #1E293B;">生成专属邀请卡</div>
                    <button id="qx6_qr_print_top" style="padding: 8px 16px; border-radius: 20px; border:none; background:#E2E8F0; color:#64748B; cursor:not-allowed; display:flex; align-items:center; gap:6px;" disabled>🖨️ 打印全部</button>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <label style="display:flex; justify-content:space-between; align-items:center; font-weight: bold; margin-bottom: 8px; color: #1E293B;">
                        <span>选择合作方</span>
                        <a href="javascript:void(0)" id="qx6_qr_add_partner" style="color:#2C7BE5; font-size:13px; text-decoration:none; cursor:pointer; font-weight:normal;">+ 新建合作方</a>
                    </label>
                    <select id="qx6_qr_partner" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                        <option value="">加载中...</option>
                    </select>
                    <div style="text-align: right; margin-top: 8px;">
                        <a href="javascript:void(0)" id="qx6_qr_edit_partner" style="color:#E67E22; font-size:13px; text-decoration:none; cursor:pointer; display:none;">✏️ 修改当前合作方信息 / 改名</a>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display:flex; justify-content:space-between; align-items:center; font-weight: bold; margin-bottom: 8px; color: #1E293B;">
                        <span>选择发行批次</span>
                        <a href="javascript:void(0)" id="qx6_qr_add_image" style="color:#2C7BE5; font-size:13px; text-decoration:none; cursor:pointer; font-weight:normal;">+ 新建批次</a>
                    </label>
                    <select id="qx6_qr_image" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                        <option value="">请先选合作方</option>
                    </select>
                </div>

                <!-- 【新增】身份与期限选择 -->
                <div style="display: flex; gap: 16px; margin-bottom: 20px;">
                    <div style="flex: 2;">
                        <label style="display:block; font-weight: bold; margin-bottom: 8px; color: #1E293B;">赋予身份</label>
                        <select id="qx6_qr_type" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                            ${typeOptions}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display:block; font-weight: bold; margin-bottom: 8px; color: #1E293B;">有效天数</label>
                        <input type="number" id="qx6_qr_days" value="365" min="1" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display:block; font-weight: bold; margin-bottom: 8px; color: #1E293B;">生成数量</label>
                    <input type="number" id="qx6_qr_count" value="1" min="1" max="100" style="width: 120px; padding: 10px; border-radius: 8px; border: 1px solid #CBD5E1; outline:none; background:#F8FAFC;">
                </div>

                <div id="qx6_qr_status" style="margin-bottom: 16px; font-size: 14px; color: #64748B;"></div>

                <button id="qx6_qr_generate" style="width: 100%; padding: 14px; border-radius: 8px; border:none; background:#2C7BE5; color:#fff; font-size:16px; font-weight:bold; cursor:pointer; transition: opacity 0.2s;">自动分配并生成</button>
            </div>

            <div id="qx6_qr_preview_area" style="display:none; background: #F8FAFC; padding: 20px; border-radius: 12px;">
                <div id="qx6_qr_grid" style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;"></div>
            </div>
        `;

        const partnerSel = bodyEl.querySelector('#qx6_qr_partner');
        const imageSel   = bodyEl.querySelector('#qx6_qr_image');
        const typeSel    = bodyEl.querySelector('#qx6_qr_type');
        const daysInput  = bodyEl.querySelector('#qx6_qr_days');
        const countInput = bodyEl.querySelector('#qx6_qr_count');
        const statusEl   = bodyEl.querySelector('#qx6_qr_status');
        const genBtn     = bodyEl.querySelector('#qx6_qr_generate');
        const printTopBtn= bodyEl.querySelector('#qx6_qr_print_top');
        const previewArea= bodyEl.querySelector('#qx6_qr_preview_area');
        const gridEl     = bodyEl.querySelector('#qx6_qr_grid');
        const editPartnerBtn = bodyEl.querySelector('#qx6_qr_edit_partner');

        function showStatus(text, type) {
            statusEl.innerText = text || '';
            statusEl.style.color = type === 'error' ? '#E74C3C' : (type === 'success' ? '#00C853' : '#64748B');
        }

        function fetchPartners() {
            U.restGet('emo_partner?isactive=eq.true&order=partner_code').then(partners => {
                partnerSel.innerHTML = '<option value="">-- 请选择 --</option>';
                (partners || []).forEach(p => {
                    partnerSel.innerHTML += `<option value="${p.partner_id}">${esc(p.partner_name_cn)}</option>`;
                });
            }).catch(e => showStatus('加载合作方失败', 'error'));
        }
        fetchPartners();

        partnerSel.onchange = () => {
            const pid = partnerSel.value;
            previewArea.style.display = 'none';
            
            if (!pid) {
                imageSel.innerHTML = '<option value="">请先选合作方</option>';
                editPartnerBtn.style.display = 'none';
                return;
            }
            
            editPartnerBtn.style.display = 'inline-block';
            imageSel.innerHTML = '<option value="">加载中...</option>';
            
            U.restGet(`emo_qrcode_image?partner_id=eq.${pid}&isactive=eq.true&order=createdat.desc`).then(images => {
                imageSel.innerHTML = '<option value="">-- 请选择 --</option>';
                (images || []).forEach(img => {
                    imageSel.innerHTML += `<option value="${img.qrcode_id}">${esc(img.qrcode_label)}</option>`;
                });
            });
        };

        bodyEl.querySelector('#qx6_qr_add_partner').onclick = () => {
            showPartnerModal(null, (data) => {
                data.partner_code = "P-" + Date.now().toString(36).toUpperCase();
                showStatus('正在创建合作方...', 'info');
                
                fetch(`${U.SUPABASE_URL}/rest/v1/emo_partner`, {
                    method: 'POST',
                    headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify(data)
                }).then(res => {
                    if (!res.ok) throw new Error("创建失败");
                    showStatus('合作方创建成功', 'success');
                    fetchPartners();
                }).catch(e => showStatus(e.message, 'error'));
            });
        };

        editPartnerBtn.onclick = async () => {
            const pid = partnerSel.value;
            if (!pid) return;
            
            const res = await U.restGet(`emo_partner?partner_id=eq.${pid}&limit=1`);
            if (!res || !res[0]) return alert("未找到该合作方数据");
            
            showPartnerModal(res[0], (newData) => {
                showStatus('正在保存修改...', 'info');
                
                const payload = {
                    partner_name_cn: newData.partner_name_cn,
                    contact_name: newData.contact_name || '',
                    contact_phone: newData.contact_phone || '',
                    remark: newData.remark || '',
                    isactive: true 
                };

                fetch(`${U.SUPABASE_URL}/rest/v1/emo_partner?partner_id=eq.${pid}`, {
                    method: 'PATCH',
                    headers: { 
                        'apikey': U.SUPABASE_KEY, 
                        'Authorization': `Bearer ${U.SUPABASE_KEY}`, 
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                }).then(async r => {
                    if (!r.ok) {
                        const errText = await r.text();
                        throw new Error("请求被拒绝: " + errText);
                    }
                    showStatus('修改已保存', 'success');
                    
                    U.restGet('emo_partner?isactive=eq.true&order=partner_code').then(partners => {
                        partnerSel.innerHTML = '<option value="">-- 请选择 --</option>';
                        (partners || []).forEach(p => {
                            partnerSel.innerHTML += `<option value="${p.partner_id}">${esc(p.partner_name_cn)}</option>`;
                        });
                        partnerSel.value = pid;
                        partnerSel.onchange();
                    });
                }).catch(e => {
                    console.error(e);
                    showStatus(e.message, 'error');
                });
            });
        };

        bodyEl.querySelector('#qx6_qr_add_image').onclick = () => {
            const pid = partnerSel.value;
            if (!pid) { alert("请先在左侧选择所属的合作方。"); return; }
            
            showSimplePrompt("新建发行批次", "请输入批次名（如：2026海报版）", (label) => {
                showStatus('正在创建批次...', 'info');
                fetch(`${U.SUPABASE_URL}/rest/v1/emo_qrcode_image`, {
                    method: 'POST',
                    headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                    body: JSON.stringify({ 
                        qrcode_label: label, 
                        landing_path: 'qx00_login.html', 
                        isactive: true, 
                        partner_id: pid 
                    })
                }).then(res => {
                    if (!res.ok) throw new Error("创建失败");
                    showStatus('批次创建成功', 'success');
                    partnerSel.onchange(); 
                }).catch(e => showStatus(e.message, 'error'));
            });
        };

        genBtn.onclick = async () => {
            const pid = partnerSel.value;
            const qid = imageSel.value;
            const ut = parseInt(typeSel.value); // 【新增】获取身份
            const days = parseInt(daysInput.value); // 【新增】获取天数
            const count = parseInt(countInput.value) || 1;

            if (!pid || !qid) {
                showStatus('请选择合作方和批次', 'error');
                return;
            }
            if (!days || days < 1) {
                showStatus('有效天数必须大于0', 'error');
                return;
            }

            genBtn.disabled = true;
            showStatus('正在生成，请稍候...', 'info');
            gridEl.innerHTML = ''; 
            previewArea.style.display = 'none';
            printTopBtn.disabled = true;

            try {
                const codesToInsert = [];
                const batchNo = "AUTO-" + Date.now().toString(36).toUpperCase();
                for (let i = 0; i < count; i++) {
                    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
                    codesToInsert.push({
                        code: `EMO-${rand}-${Date.now().toString(36).toUpperCase()}`,
                        usertypekey: ut,          // 【动态】
                        maxactivations: 1,
                        currentactivations: 0,
                        validays: days,           // 【动态】
                        isused: false,
                        batchno: batchNo,
                        qrcode_id: qid
                    });
                }

                const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emobao_redemptioncode`, {
                    method: 'POST',
                    headers: { 
                        'apikey': U.SUPABASE_KEY, 
                        'Authorization': `Bearer ${U.SUPABASE_KEY}`, 
                        'Content-Type': 'application/json', 
                        'Prefer': 'return=representation' 
                    },
                    body: JSON.stringify(codesToInsert)
                });

                if (!res.ok) throw new Error("数据库写入失败");
                const createdCodes = await res.json();
                const partnerName = partnerSel.options[partnerSel.selectedIndex].text;
                
                const cleanUrl = 'https://emobao.com/qx00_login.html';

                createdCodes.forEach((c, i) => {
                    const card = document.createElement('div');
                    card.className = 'qx-print-card';
                    card.style.cssText = 'width: 280px; height: 380px; background: #fff; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative; overflow: hidden; margin: 10px; box-sizing: border-box;';

                    const title = document.createElement('div');
                    title.style.cssText = 'position: absolute; top: 30px; left: 0; width: 100%; text-align: center; font-size: 18px; font-weight: bold; color: #1E293B;';
                    title.innerText = '情绪宝 · 专属邀请卡';

                    const pName = document.createElement('div');
                    pName.style.cssText = 'position: absolute; top: 65px; left: 0; width: 100%; text-align: center; font-size: 15px; color: #2C7BE5; font-weight: bold;';
                    pName.innerText = partnerName;

                    const qrBox = document.createElement('div');
                    qrBox.id = `qr_holder_${i}`;
                    qrBox.style.cssText = 'position: absolute; top: 110px; left: 50%; transform: translateX(-50%); width: 160px; height: 160px; display: block; z-index: 99;';

                    const codeText = document.createElement('div');
                    codeText.style.cssText = 'position: absolute; bottom: 55px; left: 0; width: 100%; text-align: center; font-size: 13px; font-family: monospace; color: #1E293B; font-weight: bold;';
                    codeText.innerText = `兑换码: ${c.code}`;

                    const hint = document.createElement('div');
                    hint.style.cssText = 'position: absolute; bottom: 30px; left: 0; width: 100%; text-align: center; font-size: 13px; color: #94A3B8;';
                    hint.innerText = '扫码开启情绪之旅';

                    card.appendChild(title);
                    card.appendChild(pName);
                    card.appendChild(qrBox);
                    card.appendChild(codeText); 
                    card.appendChild(hint); 
                    gridEl.appendChild(card);
                });

                previewArea.style.display = 'block';

                let index = 0;
                function renderNextQR() {
                    if (index >= createdCodes.length) {
                        showStatus(`成功生成 ${count} 张卡片`, 'success');
                        printTopBtn.disabled = false;
                        printTopBtn.style.background = '#2C7BE5';
                        printTopBtn.style.color = '#fff';
                        printTopBtn.style.cursor = 'pointer';
                        return;
                    }

                    const holder = document.getElementById(`qr_holder_${index}`);
                    if (holder) {
                        try {
                            holder.innerHTML = '';
                            
                            const tempDiv = document.createElement('div');
                            tempDiv.style.cssText = 'width:160px; height:160px; visibility:hidden; position:absolute; left:-9999px;';
                            document.body.appendChild(tempDiv);

                            new window.QRCode(tempDiv, {
                                text: cleanUrl,
                                width: 160,
                                height: 160,
                                correctLevel: window.QRCode.CorrectLevel.H
                            });

                            setTimeout(() => {
                                const canvas = tempDiv.querySelector('canvas');
                                const img = tempDiv.querySelector('img');
                                if (canvas) {
                                    const newImg = document.createElement('img');
                                    newImg.src = canvas.toDataURL("image/png");
                                    newImg.style.cssText = 'width: 160px; height: 160px; display: block;';
                                    holder.appendChild(newImg);
                                } else if (img) {
                                    img.style.cssText = 'width: 160px; height: 160px; display: block;';
                                    holder.appendChild(img);
                                }
                                document.body.removeChild(tempDiv);
                                
                                index++;
                                renderNextQR();
                            }, 50);

                        } catch (err) {
                            console.error(`第 ${index+1} 张二维码异常:`, err);
                            holder.innerHTML = '<div style="color:red; font-size:12px;">生成失败</div>';
                            index++;
                            renderNextQR();
                        }
                    } else {
                        index++;
                        renderNextQR();
                    }
                }

                setTimeout(renderNextQR, 100);

            } catch (error) {
                console.error(error);
                showStatus(error.message, 'error');
                genBtn.disabled = false;
            }
        };

        printTopBtn.onclick = () => {
            const cards = gridEl.innerHTML;
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
                <html>
                <head>
                    <style>
                        body { margin:0; padding:20px; display:flex; flex-wrap:wrap; gap:20px; justify-content:center; background:#fff;}
                        .qx-print-card { width:280px; height:380px; border:1px dashed #ccc; page-break-inside:avoid; position: relative; }
                        .qx-print-card img { width:160px !important; height:160px !important; display:block !important; }
                        @media print { @page { margin: 10mm; } }
                    </style>
                </head>
                <body>${cards}</body>
                </html>
            `);
            doc.close();

            iframe.onload = () => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            };
        };
    }

    window.qx6Register('redeem_qrcode', render);
})();