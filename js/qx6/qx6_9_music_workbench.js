/* ================================================================
   情绪宝 - 音乐导播台 (Music Director Console)
   路径：js/qx6/qx6_9_music_workbench.js
   ================================================================ */
   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) return;
    const t = U.t;

    function render(bodyEl) {
        if (!U.isAdmin() && !U.isMusician()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅管理员可访问', 'Admin only')}</div>`;
            return;
        }

        bodyEl.innerHTML = `
            <div class="qx6-card" style="height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-shrink: 0;">
                    <select id="qx9_work_select" class="qx6-input" style="flex: 1; padding: 10px; font-size: 14px;">
                        <option value="">-- 请选择要编排的曲目 --</option>
                    </select>
                    <button class="qx6-btn qx6-btn-secondary" id="qx9_refresh">刷新</button>
                </div>
                
                <div id="qx9_timeline_list" style="flex: 1; overflow-y: auto; background: #F8FBFF; padding: 12px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="text-align: center; color: #96A3B8; padding-top: 40px;">请选择一首音乐开始编排</div>
                </div>

                <div style="margin-top: 16px; text-align: right; flex-shrink: 0; display: none;" id="qx9_add_area">
                    <button class="qx6-btn qx6-btn-primary" id="qx9_add_btn" style="background: #2ECC71; border-color: #2ECC71; padding: 10px 20px; border-radius: 8px;">+ 添加新段落</button>
                </div>
            </div>
        `;

        const workSelect = bodyEl.querySelector('#qx9_work_select');
        const refreshBtn = bodyEl.querySelector('#qx9_refresh');
        const listEl = bodyEl.querySelector('#qx9_timeline_list');
        const addArea = bodyEl.querySelector('#qx9_add_area');
        const addBtn = bodyEl.querySelector('#qx9_add_btn');

        let currentWorkId = '';

        // 1. 加载曲目列表
        async function loadWorks() {
            try {
                const works = await U.restGet('emo_works?select=workid,title_cn&order=created_at.desc');
                workSelect.innerHTML = '<option value="">-- 请选择要编排的曲目 --</option>';
                works.forEach(w => {
                    workSelect.innerHTML += `<option value="${w.workid}">${w.title_cn || w.workid}</option>`;
                });
            } catch (e) {
                alert('加载曲目失败');
            }
        }

        // 2. 加载时间轴段落
        async function loadTimelines(workid) {
            if (!workid) {
                listEl.innerHTML = '<div style="text-align: center; color: #96A3B8; padding-top: 40px;">请选择一首音乐开始编排</div>';
                addArea.style.display = 'none';
                return;
            }
            currentWorkId = workid;
            addArea.style.display = 'block';
            listEl.innerHTML = '<div style="text-align:center; color:#96A3B8;">加载段落中...</div>';

            try {
                const rows = await U.restGet(`emo_work_timelines?workid=eq.${workid}&order=start_time.asc`);
                if (!rows || rows.length === 0) {
                    listEl.innerHTML = '<div style="text-align:center; color:#96A3B8; padding: 20px;">暂无段落数据，请点击下方按钮添加</div>';
                    return;
                }

                listEl.innerHTML = '';
                rows.forEach((tl, idx) => {
                    const card = document.createElement('div');
                    card.style.cssText = 'background:#fff; border-radius:8px; padding:16px; box-shadow:0 2px 10px rgba(0,0,0,0.04); border-left:4px solid #2C7BE5;';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:12px; align-items:center;">
                            <span style="font-weight:bold; color:#1A2B4A; font-size: 15px;">段落 ${idx + 1} <span style="color:#96A3B8; font-size:12px; margin-left: 8px;">(${fmt(tl.start_time)} - ${fmt(tl.end_time)})</span></span>
                            <button class="del-btn" style="color:#E74C3C; background:none; border:none; cursor:pointer; font-size: 13px;">🗑️ 删除此段</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
                            <label style="font-size:12px; color:#5A6B87; display:flex; flex-direction:column;">开始时间(秒)
                                <input type="number" class="te-inp" data-f="start_time" value="${tl.start_time}" style="margin-top:4px; padding:8px; border:1px solid #E1E8F0; border-radius:4px;">
                            </label>
                            <label style="font-size:12px; color:#5A6B87; display:flex; flex-direction:column;">结束时间(秒)
                                <input type="number" class="te-inp" data-f="end_time" value="${tl.end_time}" style="margin-top:4px; padding:8px; border:1px solid #E1E8F0; border-radius:4px;">
                            </label>
                            <label style="font-size:12px; color:#5A6B87; display:flex; flex-direction:column;">段落名称/情绪
                                <input type="text" class="te-inp" data-f="section_name" value="${tl.section_name || ''}" placeholder="如：第一乐章 / 舒缓" style="margin-top:4px; padding:8px; border:1px solid #E1E8F0; border-radius:4px;">
                            </label>
                        </div>
                        <label style="font-size:12px; color:#5A6B87; display:flex; flex-direction:column; margin-bottom:12px;">中文代序文字（语音播报内容）
                            <textarea class="te-inp" data-f="ai_guide_text" placeholder="请输入这段音乐的引导语..." style="margin-top:4px; width:100%; min-height:70px; padding:8px; border:1px solid #E1E8F0; border-radius:4px; box-sizing:border-box; resize:vertical; font-family: inherit; line-height: 1.5;">${tl.ai_guide_text || ''}</textarea>
                        </label>
                        <label style="font-size:12px; color:#5A6B87; display:flex; flex-direction:column; margin-bottom:12px;">英文代序文字
                            <textarea class="te-inp" data-f="ai_guide_text_en" placeholder="English guide text..." style="margin-top:4px; width:100%; min-height:50px; padding:8px; border:1px solid #E1E8F0; border-radius:4px; box-sizing:border-box; resize:vertical; font-family: inherit; line-height: 1.5;">${tl.ai_guide_text_en || ''}</textarea>
                        </label>
                        <div style="text-align:right;">
                            <button class="save-btn" style="background:#2C7BE5; color:#fff; border:none; padding:8px 20px; border-radius:6px; cursor:pointer; font-weight: bold;">保存此段</button>
                        </div>
                    `;
                    
                    // 删除按钮
                    card.querySelector('.del-btn').onclick = async () => {
                        if (!confirm('确定删除此段落吗？')) return;
                        const keyField = tl.id ? 'id' : 'start_time';
                        const keyVal = tl.id || tl.start_time;
                        await fetch(`${U.SUPABASE_URL}/rest/v1/emo_work_timelines?workid=eq.${workid}&${keyField}=eq.${keyVal}`, {
                            method: 'DELETE', headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}` }
                        });
                        loadTimelines(workid);
                    };

                    // 保存按钮
                    card.querySelector('.save-btn').onclick = async (e) => {
                        const btn = e.target;
                        btn.innerText = '保存中...'; btn.disabled = true;
                        const payload = {};
                        card.querySelectorAll('.te-inp').forEach(inp => {
                            payload[inp.dataset.f] = inp.dataset.f.includes('time') ? parseFloat(inp.value) : inp.value;
                        });

                        const keyField = tl.id ? 'id' : 'start_time';
                        const keyVal = tl.id || tl.start_time;
                        const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emo_work_timelines?workid=eq.${workid}&${keyField}=eq.${keyVal}`, {
                            method: 'PATCH',
                            headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (res.ok) { 
                            btn.innerText = '✅ 已保存'; 
                            btn.style.background = '#2ECC71';
                            setTimeout(() => { btn.innerText = '保存此段'; btn.style.background = '#2C7BE5'; btn.disabled = false; }, 1500); 
                        } else {
                            const errText = await res.text(); // 抓取服务器的真实报错
                            console.error('保存失败的详情:', errText);
                            alert('保存失败！服务器返回：\n' + errText); 
                            btn.innerText = '保存此段'; 
                            btn.disabled = false; 
                        }
                    };

                    listEl.appendChild(card);
                });
            } catch (err) {
                listEl.innerHTML = `<div style="color:#E74C3C; text-align:center;">加载失败: ${err.message}</div>`;
            }
        }

        // 监听切换曲目
        workSelect.onchange = () => loadTimelines(workSelect.value);
        
        // 刷新按钮
        refreshBtn.onclick = () => {
            loadWorks();
            if (workSelect.value) loadTimelines(workSelect.value);
        };

        // 添加新段落
        addBtn.onclick = async () => {
            if (!currentWorkId) return;
            const payload = {
                workid: currentWorkId,
                start_time: 0,
                end_time: 60,
                ai_guide_text: '请在此输入代序文字...',
                section_name: '新段落'
            };
            await fetch(`${U.SUPABASE_URL}/rest/v1/emo_work_timelines`, {
                method: 'POST',
                headers: { 'apikey': U.SUPABASE_KEY, 'Authorization': `Bearer ${U.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            loadTimelines(currentWorkId);
        };

        // 初始化
        loadWorks();
    }

    function fmt(sec) { return `${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`; }

    // 注册面板
    window.qx6Register('music_workbench', render);
})();