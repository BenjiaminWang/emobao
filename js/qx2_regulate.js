/* ================================================================
   情绪宝 - qx2 情绪调节 (纯净稳定版)
   日期：2026-11-14
   ================================================================ */

   (function () {
    'use strict';

    const SUPABASE_URL = 'https://api.emobao.com';
    const SUPABASE_KEY = 'sb_publishable_hl4A5eAr-AS_ZlCr0bP2tg_E_n-LY5a';

    let _timelineCache = {};
    let _workInfo = { work: null, timelines: [], tags: { instruments: [], styles: [] } };
    let speakWatchdog = null; 
    let _fastTimer = null;
    let mirrorBeforeId = null;
    let mirrorAfterId = null;

    let state = {
        step: 1, isGuest: false, inputEmotionCode: 0, outputEmotionCode: 0, feedback: null,
        playlist: [], currentIndex: 0, audio: null, hrvResult: null, hrvAborted: false,
        started: false, finished: false, initialized: false, hrvSeries: [], hfSeries: [],
        latestHint: '', latestQuality: 'unknown', isWorkMode: false, 
        playMode: 'guided', currentSegIndex: 0, lastSpokenText: '', lastSpokenTime: 0,
        hrvResultBefore: null
    };

    // ==========================================
    // 🌟 基础工具与请求
    // ==========================================
    function t(cn, en) { const lang = (window.mQxb && window.mQxb.Language) || 1; return lang === 1 ? cn : en; }
    function getUserId() { return window.mQxb && window.mQxb.user_id; }
    function getUserType() { return (window.mQxb && parseInt(window.mQxb.user_id_Type)) || 1; }
    function getLang() { return (window.mQxb && window.mQxb.Language) || 1; }

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function translateSectionName(name) {
        if (!name) return '';
        return getLang() === 1 ? name : name.replace('乐章', 'Movement');
    }

    let _toastTimer = null;
    function toast(text, type) {
        type = type || 'info';
        let bar = document.getElementById('qx2_toast_bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'qx2_toast_bar';
            bar.className = 'qx2-toast-bar';
            document.body.appendChild(bar);
        }
        if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
        bar.className = 'qx2-toast-bar qx2-toast-' + type;
        bar.innerText = text;
        requestAnimationFrame(() => bar.classList.add('show'));
        _toastTimer = setTimeout(() => bar.classList.remove('show'), 3500);
    }

    async function rpc(fnName, params) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify(params),
        });
        if (!res.ok) { const txt = await res.text(); throw new Error(`RPC ${fnName}: ${res.status} ${txt}`); }
        return res.json();
    }

    async function restGet(path) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        if (!res.ok) { const txt = await res.text(); throw new Error(`REST ${path}: ${res.status} ${txt}`); }
        return res.json();
    }

    // ==========================================
    // 🌟 动态操作提示栏核心控制器
    // ==========================================
    function updateActionBar(step) {
        const bar = document.getElementById('qx2_music_row');
        if (!bar) return;

        if (window.speechSynthesis) window.speechSynthesis.cancel();

        if (step === 1) {
            bar.innerHTML = `<div class="qx2-ab-text">请确认您当前的情绪、再选择是否采集HRV</div>`;
            if (window.qxSpeak) window.qxSpeak("请确认您当前的情绪、再选择是否采集HRV", null);
        }
        else if (step === 2 && !state.started && !state.isWorkMode) {
            bar.innerHTML = `
                <div class="qx2-ab-text" style="margin-right:16px;">按'开始'听组曲调节情绪，按'选曲'听经典作品</div>
                <div class="qx2-ab-btns">
                    <button class="qx2-ab-btn qx2-ab-btn-secondary" onclick="window.qx2_pickWork()">选曲</button>
                    <button class="qx2-ab-btn qx2-ab-btn-primary" onclick="window.qx2_startAuto()">开始</button>
                </div>
            `;
            if (window.qxSpeak) window.qxSpeak("按开始听组曲调节情绪，按选曲听经典作品", null);
        }
        else if (step === 2 && !state.isWorkMode && state.started) {
            bar.innerHTML = `<div class="qx2-ab-text">请听情绪宝为您准备的音乐</div>`;
            if (window.qxSpeak) window.qxSpeak("请听情绪宝为您准备的音乐", null);
        }
        else if (step === 2 && state.isWorkMode && !state.started) {
            bar.innerHTML = `
                <div class="qx2-ab-text" style="margin-right:16px;">请选出您想听的音乐作品</div>
                <div id="qx2_ab_dropdown" class="qx2-ab-dropdown"></div>
            `;
            if (window.qxSpeak) window.qxSpeak("请选出您想听的音乐作品", null);
            window.qx2_renderDropdown();
        }
        else if (step === 2 && state.isWorkMode && state.started) {
            const curWork = state.playlist[state.currentIndex];
            const workName = curWork ? (curWork.title_cn || curWork.title_en) : '经典作品';
            bar.innerHTML = `<div class="qx2-ab-text">请听《${workName}》</div>`;
            if (window.qxSpeak) window.qxSpeak(`请听《${workName}》`, null);
        }
        else if (step === 3) {
            bar.innerHTML = `
                <div class="qx2-ab-text" style="margin-right:16px;">请按评价过程键后给出听后评价和听后情绪</div>
                <div class="qx2-ab-btns">
                    <button class="qx2-ab-btn qx2-ab-btn-secondary" onclick="window.qx2_quick_eval('better')">更好</button>
                    <button class="qx2-ab-btn qx2-ab-btn-secondary" onclick="window.qx2_quick_eval('same')">一样</button>
                    <button class="qx2-ab-btn qx2-ab-btn-secondary" onclick="window.qx2_quick_eval('worse')">更差</button>
                </div>
            `;
            if (window.qxSpeak) window.qxSpeak("请按评价过程键后给出听后评价和听后情绪", null);
        }
        else if (step === 4) {
            bar.innerHTML = `<div class="qx2-ab-text">情绪调整分析图已生成，请查看下方页签</div>`;
        }
    }

    // ==========================================
    // 🌟 横条交互与评价
    // ==========================================
    window.qx2_pickWork = function() {
        state.isWorkMode = true;
        state.started = false;
        const container = document.getElementById('qx2_container');
        if (container) {
            container.classList.remove('step1-mode');
            container.classList.add('step2-mode', 'work-mode');
        }
        updateActionBar(2);
        const dropdown = document.getElementById('qx2_ab_dropdown');
        if (dropdown) {
            dropdown.classList.add('show');
            if (dropdown.innerHTML.indexOf('加载中') >= 0) {
                window.qx2_renderDropdown();
            }
        }
    };

    window.qx2_startAuto = function() {
        enterAdjustStep(); 
    };

    window.qx2_quick_eval = function(val) {
        state.feedback = val; 
        const valMap = { 'better': t('更好', 'Better'), 'same': t('一样', 'Same'), 'worse': t('更差', 'Worse') };
        const zhVal = valMap[val] || val;

        const bar = document.getElementById('qx2_music_row');
        if (bar) {
            bar.innerHTML = `
                <div class="qx2-ab-text" style="color:#2C7BE5; margin-right:16px; font-weight:bold;">
                    已记录：${zhVal}。请去右上角选情绪，然后点分析
                </div>
                <div class="qx2-ab-btns">
                    <button class="qx2-ab-btn ${val === 'better' ? 'qx2-ab-btn-primary' : 'qx2-ab-btn-secondary'}" onclick="window.qx2_quick_eval('better')">更好</button>
                    <button class="qx2-ab-btn ${val === 'same' ? 'qx2-ab-btn-primary' : 'qx2-ab-btn-secondary'}" onclick="window.qx2_quick_eval('same')">一样</button>
                    <button class="qx2-ab-btn ${val === 'worse' ? 'qx2-ab-btn-primary' : 'qx2-ab-btn-secondary'}" onclick="window.qx2_quick_eval('worse')">更差</button>
                </div>
            `;
        }
        if (window.qxSpeak) window.qxSpeak(`已记录：${zhVal}。请去右上角选择情绪，然后点击分析`, null);
    };

    // ==========================================
    // 🌟 作曲家归一化（优先数据库 composer_std，前端映射兜底）
    // 依据线上 135 条 emo_works 实测；施特劳斯一家按作品核实后分为 4 人，不可合并
    // ==========================================
    const COMPOSER_ALIAS = {
        // 贝多芬
        '贝多芬': '贝多芬', '路德维希·凡·贝多芬': '贝多芬',
        // 柴可夫斯基
        '柴可夫斯基': '柴可夫斯基', '彼得·伊里奇·柴可夫斯基': '柴可夫斯基',
        // 莫扎特
        '莫扎特': '莫扎特', '沃尔夫冈·阿马德乌斯·莫扎特': '莫扎特',
        // 门德尔松
        '门德尔松': '门德尔松', '费利克斯·门德尔松': '门德尔松',
        // 肖邦（两种译名写法）
        '弗里德里克·肖邦': '肖邦', '弗雷德里克·肖邦': '肖邦',
        // 勃拉姆斯
        '勃拉姆斯': '勃拉姆斯', '约翰内斯·勃拉姆斯': '勃拉姆斯',
        // 舒伯特
        '舒伯特': '舒伯特', '弗朗茨·舒伯特': '舒伯特',
        // 李斯特
        '李斯特': '李斯特', '弗朗茨·李斯特': '李斯特',
        // 小约翰·施特劳斯（圆舞曲之王；含"二世"与笼统写法"约翰·施特劳斯"）
        '小约翰·施特劳斯': '小约翰·施特劳斯', '约翰·施特劳斯二世': '小约翰·施特劳斯',
        '约翰·施特劳斯': '小约翰·施特劳斯',
        // 老约翰·施特劳斯（拉德斯基进行曲作者；含"一世"）
        '老约翰·施特劳斯': '老约翰·施特劳斯', '约翰·施特劳斯一世': '老约翰·施特劳斯',
        // 约瑟夫·施特劳斯、理查德·施特劳斯是另外两位作曲家，保持独立，不并入上面两组
    };
    // 优先取数据库归一化字段 composer_std（已由触发器/回填保证），
    // 缺失时回退到前端 COMPOSER_ALIAS 映射，兼容尚未回填的历史行。
    function composerOf(w) {
        if (!w) return '';
        const c = w.composer_std || w.composer;
        if (!c) return '';
        return COMPOSER_ALIAS[c] || c;
    }

    // ==========================================
    // 🌟 多维筛选器
    // ==========================================
    window.qx2_renderDropdown = async function() {
        const dropdown = document.getElementById('qx2_ab_dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#94A3B8;">加载中...</div>';

        try {
            const works = await restGet(`emo_works?is_published=eq.true&order=created_at.desc`);
            if (!works || works.length === 0) {
                dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#94A3B8;">暂无作品</div>';
                return;
            }

            // 归一化：只从主表 form 取曲式，composer 走 composerOf 去重
            const composers = [...new Set(works.map(w => composerOf(w)).filter(Boolean))].sort();
            const forms = [...new Set(works.map(w => w.form).filter(Boolean))].sort();

            // 🌟 精品讲座识别：拉全部时间轴(仅3个字段约15KB)，按作品统计有效段数，>=3 视为有深度分段讲解
            // 动态判定，SOP 以后新增的深度讲解作品会自动成为精品讲座，无需改代码
            const boutiqueSet = new Set();
            try {
                const tls = await restGet(`emo_work_timelines?select=workid,start_time,end_time`);
                const segCount = {};
                (tls || []).forEach(x => {
                    if (x.start_time !== x.end_time) segCount[x.workid] = (segCount[x.workid] || 0) + 1;
                });
                Object.keys(segCount).forEach(id => { if (segCount[id] >= 3) boutiqueSet.add(id); });
            } catch (e) { console.warn('[qx2] 精品讲座判定失败', e); }
            window.qx2_boutiqueSet = boutiqueSet;  // 供其它逻辑复用

            const filterState = { keyword: '', composer: 'all', form: 'all', boutique: 'all' };

            const chip = 'padding:4px 12px;border-radius:16px;border:1px solid #E1E8F0;background:#fff;color:#5A6B87;font-size:12px;cursor:pointer;flex-shrink:0;';
            const chipOn = 'padding:4px 12px;border-radius:16px;border:1px solid #2C7BE5;background:#2C7BE5;color:#fff;font-size:12px;cursor:pointer;flex-shrink:0;';

            dropdown.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#fff;border-radius:0 0 8px 8px;box-shadow:0 8px 16px rgba(0,0,0,0.1);z-index:999;display:flex;flex-direction:column;max-height:60vh;overflow:hidden;width:100%;';

            dropdown.innerHTML = `
                <div style="padding:10px 16px;border-bottom:1px solid #F0F4F9;">
                    <input id="qx2_search_input" type="text" placeholder="输入作品名或作曲家搜索…"
                        style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid #E1E8F0;border-radius:8px;font-size:14px;outline:none;">
                </div>
                <div style="padding:8px 16px 0;display:flex;gap:8px;overflow-x:auto;white-space:nowrap;align-items:center;">
                    <span style="font-size:11px;color:#96A3B8;flex-shrink:0;">作曲家</span>
                    <button class="qx2-f-btn" data-dim="composer" data-val="all" style="${chipOn}">全部</button>
                    ${composers.map(c => `<button class="qx2-f-btn" data-dim="composer" data-val="${escapeHtml(c)}" style="${chip}">${escapeHtml(c)}</button>`).join('')}
                </div>
                <div style="padding:8px 16px 10px;display:flex;gap:8px;overflow-x:auto;white-space:nowrap;align-items:center;border-bottom:1px solid #F0F4F9;">
                    <span style="font-size:11px;color:#96A3B8;flex-shrink:0;">曲式</span>
                    <button class="qx2-f-btn" data-dim="form" data-val="all" style="${chipOn}">全部</button>
                    ${forms.map(f => `<button class="qx2-f-btn" data-dim="form" data-val="${escapeHtml(f)}" style="${chip}">${escapeHtml(f)}</button>`).join('')}
                </div>
                <div style="padding:8px 16px 10px;display:flex;gap:8px;overflow-x:auto;white-space:nowrap;align-items:center;border-bottom:1px solid #F0F4F9;">
                    <span style="font-size:11px;color:#96A3B8;flex-shrink:0;">${escapeHtml(t('讲座', 'Lecture'))}</span>
                    <button class="qx2-f-btn" data-dim="boutique" data-val="all" style="${chipOn}">${escapeHtml(t('全部', 'All'))}</button>
                    <button class="qx2-f-btn" data-dim="boutique" data-val="yes" style="${chip}">🌟 ${escapeHtml(t('精品讲座', 'Boutique lectures'))} (${boutiqueSet.size})</button>
                    <button class="qx2-f-btn" data-dim="boutique" data-val="no" style="${chip}">${escapeHtml(t('普通作品', 'Others'))}</button>
                </div>
                <div id="qx2_work_list_container" style="max-height:40vh;overflow-y:auto;width:100%;"></div>
            `;

            const listContainer = document.getElementById('qx2_work_list_container');
            const searchInput = document.getElementById('qx2_search_input');
            const dimBtns = dropdown.querySelectorAll('.qx2-f-btn');

            function renderList() {
                const kw = filterState.keyword.trim().toLowerCase();
                const filtered = works.filter(w => {
                    if (filterState.composer !== 'all' && composerOf(w) !== filterState.composer) return false;
                    if (filterState.form !== 'all' && w.form !== filterState.form) return false;
                    if (filterState.boutique === 'yes' && !boutiqueSet.has(w.workid)) return false;
                    if (filterState.boutique === 'no' && boutiqueSet.has(w.workid)) return false;
                    if (kw) {
                        const title = ((w.title_cn || '') + ' ' + (w.title_en || '')).toLowerCase();
                        const comp = composerOf(w).toLowerCase();
                        if (!title.includes(kw) && !comp.includes(kw)) return false;
                    }
                    return true;
                });

                if (filtered.length === 0) {
                    listContainer.innerHTML = '<div style="padding:12px;text-align:center;color:#94A3B8;">没有符合条件的曲目</div>';
                    return;
                }

                listContainer.innerHTML = filtered.map(w => {
                    const title = getLang() === 1 ? (w.title_cn || w.title_en) : (w.title_en || w.title_cn);
                    const parts = [];
                    const comp = composerOf(w);
                    if (comp) parts.push(escapeHtml(comp));
                    if (w.form) parts.push(escapeHtml(w.form));
                    if (w.era) parts.push(escapeHtml(w.era));
                    if (w.total_duration) parts.push(`${Math.floor(w.total_duration / 60)}:${String(w.total_duration % 60).padStart(2, '0')}`);
                    const metaInfo = parts.length
                        ? `<span style="font-size:12px;color:#96A3B8;font-weight:normal;margin-left:8px;">${parts.join(' · ')}</span>`
                        : '';
                    return `
                        <div class="qx2-ab-dropdown-item" onclick="window.qx2_selectWork('${w.workid}')"
                            style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #F0F4F9;cursor:pointer;">
                            <span style="font-weight:500;color:#1A2B4A;">${boutiqueSet.has(w.workid) ? '🌟 ' : ''}${escapeHtml(title)}</span>
                            ${metaInfo}
                        </div>
                    `;
                }).join('');
            }

            searchInput.addEventListener('input', () => {
                filterState.keyword = searchInput.value;
                renderList();
            });

            dimBtns.forEach(btn => {
                btn.onclick = () => {
                    const dim = btn.dataset.dim;
                    filterState[dim] = btn.dataset.val;
                    dropdown.querySelectorAll(`.qx2-f-btn[data-dim="${dim}"]`).forEach(b => { b.style.cssText = chip; });
                    btn.style.cssText = chipOn;
                    renderList();
                };
            });

            renderList();
            if (searchInput) searchInput.focus();

        } catch (e) {
            console.error('加载曲库失败', e);
            dropdown.innerHTML = '<div style="padding:12px;text-align:center;color:#E74C3C;">网络错误，请重试</div>';
        }
    };

    window.qx2_selectWork = async function(workid) {
        const dropdown = document.getElementById('qx2_ab_dropdown');
        if (dropdown) dropdown.classList.remove('show');
        
        try {
            const works = await restGet(`emo_works?workid=eq.${workid}`);
            if (works && works.length > 0) {
                const work = works[0];
                state.isWorkMode = true;
                state.started = true;
                state.finished = false;
                state.playlist = [{ trackid: work.workid, title_cn: work.title_cn, title_en: work.title_en, fileurl: work.audio_url, musictypecode: 0, isWork: true, workInfo: work }];
                state.currentIndex = 0;
                         
                const container = document.getElementById('qx2_container');
                if (container) {
                    container.classList.remove('step1-mode');
                    container.classList.add('step2-mode', 'work-mode');
                }
                
                await renderWorkInfo(work);
                initAudio();
                if (window.qxHealChart) {
                    try { 
                        qxHealChart.start('qx2_heal_canvas'); 
                        qxHealChart.push({ quality: 'good', bpm: 70, rmssd: 50, elapsed: 1 });
                    } catch(e){}
                }
                
                state.audio.src = work.audio_url;
                playSegment(0);
                updateActionBar(2);
            }
        } catch (e) { 
            toast('加载作品失败', 'error'); 
        }
    };

    // ==========================================
    // 🌟 界面状态与流程控制
    // ==========================================
    function renderFlowBar() {
        const bar = document.getElementById('qx2_flow_bar');
        if (!bar) return;
        const steps = bar.querySelectorAll('.qx2-flow-step');
        steps.forEach(el => {
            const s = parseInt(el.dataset.step);
            el.classList.remove('pending', 'active', 'done', 'disabled');
            if (s < state.step) el.classList.add('done');
            else if (s === state.step) el.classList.add('active');
            else el.classList.add('pending');
            if (s !== state.step + 1) el.classList.add('disabled');
        });
    }

    function applyStepLayout() {
        const container = document.getElementById('qx2_container');
        if (!container) return;        
        container.classList.remove('step1-mode', 'step2-mode', 'work-mode', 'step4-mode', 'step3-mode');        
        
        if (state.step === 1 || (state.step === 2 && !state.started)) {
            container.classList.add('step1-mode');
        } 
        else if (state.step === 2 && state.started) {
            container.classList.add('step2-mode');
            if (state.isWorkMode) container.classList.add('work-mode');
        } 
        else if (state.step === 3) {
            container.classList.add('step3-mode');
        }
        else if (state.step === 4) {
            container.classList.add('step4-mode');
        }        
        updateActionBar(state.step);
    }

    function setStep(n) {
        state.step = n;
        renderFlowBar();
        applyStepLayout();
    }

    function initMirrorBefore(initialCode) {
        mirrorBeforeId = qxMoodMirror.create('qx2_wheel_before', {
            mode: t('听前情绪', 'Before Emotion'), initialCode: initialCode || 0, doIt: '做', thermometerSide: 'right',
            onChange: (code) => { state.inputEmotionCode = (code == null) ? 0 : code; }
        });
    }

    function initMirrorAfter() {
        mirrorAfterId = qxMoodMirror.create('qx2_wheel_after', {
            mode: t('听后情绪', 'After Emotion'), initialCode: 0, doIt: '不做', thermometerSide: 'left',
            onChange: (code) => { state.outputEmotionCode = (code == null) ? 0 : code; }
        });
    }

    function hideWorkInfo() {
        const card = document.getElementById('qx2_work_info');
        if (card) { card.style.display = 'none'; card.classList.remove('is-lecture'); }
        _workInfo = { work: null, timelines: [], tags: { instruments: [], styles: [] } };
        state.lastSpokenText = '';
    }

    async function renderWorkInfo(work) {
        const card = document.getElementById('qx2_work_info');
        if (!card) return;
        card.style.display = 'block';
        
        const lang = getLang();
        const title = lang === 1 ? (work.title_cn || work.title_en) : (work.title_en || work.title_cn);
        const composer = composerOf(work) || ''; 

        const dur = work.total_duration ? Math.floor(work.total_duration / 60) + ':' + String(work.total_duration % 60).padStart(2, '0') : '--';
        
        // 先清空卡片内容，准备生成
        card.innerHTML = '';

        _workInfo = { work: work, timelines: [], tags: { instruments: [], styles: [] } };

        try {
            const timelines = await restGet(
                `emo_work_timelines?workid=eq.${work.workid}&select=start_time,end_time,ai_guide_text,ai_guide_text_en,section_name,emotion_tag,arousal_score,instruments,dynamics,form_section&order=start_time.asc`
            );
            _workInfo.timelines = timelines || [];
            
            // 🌟 核心判断：如果只有一条从0开始的整段，且没有时间轴的细分，那它就是纯音乐
            const isPureMusic = _workInfo.timelines.length === 1 && _workInfo.timelines[0].start_time === 0;

            if (isPureMusic) {
                // 🎵 纯音乐模式
                card.classList.remove('is-lecture');
                card.style.display = 'block';
                card.style.background = 'transparent';
                card.style.padding = '0';
                card.innerHTML = ''; // 清空文字
                
                // 🌟 核心保命：把包含大球的那个大包间，强制保持显形且填满屏幕！
                const healArea = document.querySelector('.qx2-heal-area');
                if (healArea) {
                    const healTitle = healArea.querySelector('.qx2-heal-title');
                    if (healTitle) healTitle.style.display = 'none'; 
                }
            } else {
                // 🎙️ 精讲模式（有分段讲解的精品讲座）
                card.classList.add('is-lecture');
                card.style.display = 'block';
                card.style.background = '';
                card.style.padding = '';
                card.innerHTML = `
                    <div class="qx2-wi-title">${escapeHtml(title)}</div>
                    <div class="qx2-wi-meta">${escapeHtml(composer)} · ${dur}${work.era ? ' · ' + escapeHtml(work.era) : ''}${work.form ? ' · ' + escapeHtml(work.form) : ''}</div>
                    <div class="qx2-wi-curr-seg" id="qx2_wi_curr_seg" style="display:none;">
                        <div class="qx2-wi-curr-seg-title" id="qx2_wi_curr_title"></div>
                        <div class="qx2-wi-guide" id="qx2_wi_curr_text"></div>
                    </div>
                    <div class="qx2-wi-section" id="qx2_wi_struct_sec" style="display:none;">
                        <div class="qx2-wi-label">${escapeHtml(t('全曲结构', 'Structure'))}</div>
                        <div class="qx2-wi-seg-list" id="qx2_wi_seg_list"></div>
                    </div>
                `;

                // ✅ 修复：DOM 创建后再取元素（旧版在此之前取，永远是 null，导致全曲结构/点选失效）
                const structSec = document.getElementById('qx2_wi_struct_sec');
                const segList = document.getElementById('qx2_wi_seg_list');

                // 恢复包间原状
                const healArea = document.querySelector('.qx2-heal-area');
                if (healArea) {
                    const healTitle = healArea.querySelector('.qx2-heal-title');
                    if (healTitle) healTitle.style.display = 'block';
                }

                if (structSec && segList && _workInfo.timelines.length > 0) {
                    structSec.style.display = 'block';
                    segList.innerHTML = _workInfo.timelines.filter(tl => tl.start_time !== tl.end_time).map((tl) => {
                        const mm = Math.floor(tl.start_time / 60);
                        const ss = String(tl.start_time % 60).padStart(2, '0');
                        return `<span class="qx2-wi-seg-item" data-seg="${tl.start_time}">${mm}:${ss} ${escapeHtml(translateSectionName(tl.section_name) || tl.emotion_tag || '')}</span>`;
                    }).join('');

                    segList.querySelectorAll('.qx2-wi-seg-item').forEach(btn => {
                        btn.style.cursor = 'pointer';
                        btn.onclick = () => {
                            if (window.speechSynthesis) window.speechSynthesis.cancel();
                            if (state.audio) state.audio.pause();
                            const targetStart = parseFloat(btn.dataset.seg);
                            let targetIndex = _workInfo.timelines.findIndex(x => x.start_time === targetStart && x.end_time > x.start_time);
                            if (targetIndex !== -1) playSegment(targetIndex);
                        };
                    });
                }
            }
        } catch (e) { 
            console.warn('[qx2] 拉 timelines 失败', e); 
        }
    }
    function updateWorkInfoProgress(currentSec) {
        if (!_workInfo.work) return;
        const seg = _workInfo.timelines.find(x => currentSec >= x.start_time && currentSec < x.end_time && x.start_time !== x.end_time);
        const segBox = document.getElementById('qx2_wi_curr_seg');
        const titleEl = document.getElementById('qx2_wi_curr_title');
        const textEl = document.getElementById('qx2_wi_curr_text');
        
        if (segBox && titleEl && textEl) {
            if (seg) {
                segBox.style.display = 'block';
                const guideText = getLang() === 2 ? (seg.ai_guide_text_en || seg.ai_guide_text || '') : (seg.ai_guide_text || '');
                const titleStr = `${translateSectionName(seg.section_name) || ''} ${seg.form_section ? '· ' + translateSectionName(seg.form_section) : ''}`;
                titleEl.innerText = titleStr.trim();
                textEl.innerText = guideText;
            } else {
                segBox.style.display = 'none';
            }
        }
        const list = document.getElementById('qx2_wi_seg_list');
        if (list) {
            list.querySelectorAll('.qx2-wi-seg-item').forEach((el) => {
                if (seg && seg.start_time === parseFloat(el.dataset.seg)) el.classList.add('active');
                else el.classList.remove('active');
            });
        }
    }

    function bindFeedbackRadios() {
        document.querySelectorAll('input[name="qx2_feedback"]').forEach(r => {
            r.addEventListener('change', () => { state.feedback = r.value; });
        });
    }

    // ==========================================
    // 🌟 听前/听后语音确认与采样（极简沉浸版）
    // ==========================================
    function runHrvCapture(phase, onFinish) {
        const isPre = (phase === 'pre');
        const voiceText = isPre 
            ? t("为了对情绪调整做出客观分析，建议您进行听前 60 秒的心率变异性测试。请将干净的手指放在摄像头上。如果您不想测试，可以直接跳过。", "We recommend a 60-second pre-listening HRV test. You can skip.")
            : t("音乐播放完毕。请闭上眼睛，保持手指不动，我们再进行 60 秒的后测，看看您的身体发生了哪些变化。不想测的话可以直接跳过。", "Music finished. Please keep your finger still for a 60-second post-test. You can skip.");
        
        if (window.qxSpeak) window.qxSpeak(voiceText, null);

        const modal = document.getElementById('qx1_heal_modal');
        if (!modal) { onFinish(false); return; }

        modal.classList.add('show');
        const progressEl = document.getElementById('qx1_heal_modal_progress');
        if (progressEl) progressEl.style.width = '0%';

        const closeBtn = document.getElementById('qx1_heal_modal_close');
        const originalOnclick = closeBtn.onclick;
        closeBtn.onclick = () => {
            modal.classList.remove('show');
            try { window.qx2_hrv_engine.stop(); } catch(e){}
            if(originalOnclick) closeBtn.onclick = originalOnclick;
            if (window.speechSynthesis) window.speechSynthesis.cancel();
            onFinish(false); 
        };

        if (window.qxHealChart) {
            try { qxHealChart.start('qx1_heal_canvas'); } catch (e) {}
        }

        if (window.qx2_hrv_engine) {
            window.qx2_hrv_engine.start('qx1_heal_canvas', {
                duration: 60,
                onProgress: (remain, total, isWarmup, hintText) => {
                    const timer = document.getElementById('qx1_heal_modal_timer');
                    const progressEl = document.getElementById('qx1_heal_modal_progress');
                    const hintEl = document.getElementById('qx1_heal_modal_hint');
                    
                    if (hintEl) {
                        if (isWarmup) {
                            hintEl.innerHTML = `<span style="color:#B9770E; font-weight:bold;">${hintText || '请调整手指...'}</span>`;
                        } else {
                            hintEl.innerHTML = `<span style="color:#1A2B4A; font-size:14px; font-weight:bold;">${hintText || '信号良好，采集中...'}</span>`;
                        }
                    }

                    if (isWarmup) {
                        if (timer) timer.innerText = t(`${remain} 秒后开始采集`, `Starting in ${remain}s`);
                        if (progressEl) progressEl.style.width = `${total}%`; 
                    } else {
                        if (timer) timer.innerText = t(`${remain} / ${total} 秒`, `${remain} / ${total} s`);
                        if (progressEl) progressEl.style.width = Math.min(100, ((total - remain) / total) * 100) + '%';
                    }
                },
                onComplete: (result) => {
                    modal.classList.remove('show');
                    if (result) { 
                        if (isPre) state.hrvResultBefore = result; 
                        else state.hrvResult = result; 
                        onFinish(true); 
                    } else onFinish(false);
                },
                onError: (err) => {
                    console.error('[HRV引擎错误]', err);
                    toast('摄像头打开失败', 'error');
                    modal.classList.remove('show');
                    onFinish(false);
                }
            });
        }
    }

    // ==========================================
    // 🌟 音乐播放与流程控制
    // ==========================================
    function initAudio() {
        if (!state.audio) {
            state.audio = new Audio(); state.audio.preload = 'auto';
            state.audio.addEventListener('ended', onTrackEnded);
            
            state.audio.addEventListener('timeupdate', () => {
                if (!state.started || state.finished) return;
                if (state.playMode === 'musicOnly') {
                    if (state.isWorkMode && _workInfo.work) updateWorkInfoProgress(state.audio.currentTime);
                    return;
                }
                if (state.isWorkMode && _workInfo.timelines && _workInfo.timelines.length > 0) {
                    const seg = _workInfo.timelines[state.currentSegIndex];
                    if (seg && seg.end_time > seg.start_time && state.audio.currentTime >= seg.end_time - 0.3) {
                        state.audio.pause(); playSegment(state.currentSegIndex + 1);
                    }
                }
            });
            state.audio.addEventListener('stalled', () => { if (state.audio && !state.finished) { state.audio.load(); state.audio.play().catch(() => {}); } });
        }
    }

    function playCurrentTrack() {
        if (state.currentIndex >= state.playlist.length) { onPlaylistFinished(); return; }
        const track = state.playlist[state.currentIndex];
        if (!track || !track.fileurl) { toast(t('曲目文件缺失', 'Track missing'), 'error'); return; }
        initAudio();
        
        if (!state.audio.src || state.audio.src.indexOf(track.fileurl) === -1) {
            state.audio.src = track.fileurl;
        }
        if (state.playMode === 'musicOnly' && !state.isWorkMode) {
            state.audio.currentTime = 0; state.audio.play().catch(e=>{});
        }
        if (state.isWorkMode) return; 

        state.audio.play().then(() => { updateActionBar(2); })
        .catch(err => { if (err.name !== 'AbortError') console.error('播放失败', err); });
    }

    function playSegment(index) {
         // 🌟 核心防错：如果时间轴还没拉回来（数据为空），先等 100 毫秒再试，绝不盲目认为“播放结束”！
        if (!_workInfo.timelines || _workInfo.timelines.length === 0) {
            setTimeout(() => playSegment(index), 100);
            return;
        }
        if (index >= _workInfo.timelines.length) { onPlaylistFinished(); return; }
        state.currentSegIndex = index;
        const seg = _workInfo.timelines[index];
        if (state.audio) state.audio.pause();
        
        updateWorkInfoProgress(seg.start_time);
        const text = getLang() === 2 ? (seg.ai_guide_text_en || seg.ai_guide_text) : seg.ai_guide_text;

        if (state.playMode === 'musicOnly') {
            if (seg.end_time > seg.start_time) { state.audio.currentTime = seg.start_time; state.audio.play().catch(()=>{}); } 
            else playSegment(index + 1); 
            return;
        }

        if (text && window.qxSpeak) {
            let hasTriggered = false;
            const triggerMusic = () => {
                if (hasTriggered) return; hasTriggered = true; clearTimeout(speakWatchdog); 
                if (state.playMode !== 'guided') return; 
                if (seg.end_time > seg.start_time) { state.audio.currentTime = seg.start_time; state.audio.play().catch(()=>{}); } 
                else playSegment(index + 1);
            };
            
            clearTimeout(speakWatchdog);
            speakWatchdog = setTimeout(() => { 
                if (window.speechSynthesis) window.speechSynthesis.cancel(); 
                triggerMusic(); 
            }, 4000); 
            
            window.qxSpeak(text, triggerMusic);
        } else {
            if (seg.end_time > seg.start_time) { state.audio.currentTime = seg.start_time; state.audio.play().catch(()=>{}); } 
            else playSegment(index + 1);
        }
    }

    function onTrackEnded() { 
        state.currentIndex++; 
        if (state.currentIndex < state.playlist.length) playCurrentTrack(); 
        else onPlaylistFinished(); 
    }
    
    function onPlaylistFinished() {
        if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
        state.finished = true;
        try { qxHrvCapture.stop(); } catch (e) {}
        if (window.qxHealChart) { try { qxHealChart.finish(); } catch (e) {} }
        
        runHrvCapture('post', () => {
            const container = document.getElementById('qx2_container');
            if (container) container.classList.remove('step1-mode', 'step2-mode', 'work-mode');
            
            setStep(3);
            if (mirrorAfterId) qxMoodMirror.setDoIt('qx2_wheel_after', '做');
            toast(t('请填写听后评价并选择听后情绪', 'Please fill output emotion'), 'success');
        });
    }

    async function enterAdjustStep() {
        state.isWorkMode = false; hideWorkInfo(); setStep(2);
        if (mirrorBeforeId) { try { qxMoodMirror.setDoIt('qx2_wheel_before', '不做'); } catch (e) {} }
        try {
            const ruleRes = await restGet(`emobao_regulationrule?emotioncode=eq.${state.inputEmotionCode}&isactive=eq.true&ruletype=eq.system&limit=1`);
            if (!ruleRes || ruleRes.length === 0) { toast('暂无此情绪的规则', 'error'); setStep(1); return; }
            
            const playlist = [];
            for (const item of ruleRes[0].sequence) {
                if (item.mode === 'random') {
                    const tracks = await restGet(`emobao_musictrack?musictypecode=eq.${item.musictypecode}&isactive=eq.true`);
                    if (tracks && tracks.length > 0) playlist.push({ trackid: tracks[0].trackid, fileurl: tracks[0].fileurl, musictypecode: tracks[0].musictypecode });
                } else if (item.mode === 'fixed' && item.trackid) {
                    const tracks = await restGet(`emobao_musictrack?trackid=eq.${item.trackid}`);
                    if (tracks && tracks.length > 0) playlist.push({ trackid: tracks[0].trackid, fileurl: tracks[0].fileurl, musictypecode: tracks[0].musictypecode });
                }
            }
            
            if (playlist.length === 0) {
                toast(t('未能获取到音乐，请检查网络或曲库', 'No music found, please check network'), 'error');
                setStep(1);
                return;
            }

            state.playlist = playlist; state.currentIndex = 0; 
            state.started = true; 
            state.finished = false;
            state.hrvSeries = []; state.hfSeries = [];
            
            if (window.qxHealChart) { try { qxHealChart.start('qx2_heal_canvas'); } catch (e) {} }
            
            playCurrentTrack();
        } catch (e) { 
            console.error(e); 
            toast('加载组曲失败，请重试', 'error'); 
            setStep(1); 
        }
    }

    function onFlowStepClick(step) {
        if (step === 4) {
            if (!state.outputEmotionCode || !state.feedback) { 
                toast(t('请先选择听后情绪和主观评价', 'Please fill output emotion and feedback'), 'warning'); 
                return; 
            }
            setStep(4); 
            
            const healArea = document.querySelector('.qx2-heal-area');
            if (healArea) {
                healArea.innerHTML = ''; 
                healArea.style.setProperty('flex', '1 1 100%', 'important');
                healArea.style.setProperty('width', '100%', 'important');
                healArea.style.setProperty('padding', '0', 'important');
                healArea.style.setProperty('background', '#F8FBFF', 'important');
                
                const reportDiv = document.createElement('div');
                reportDiv.id = 'qx2_analysis_body';
                reportDiv.style.cssText = 'width: 100%; height: 100%; overflow-y: auto;';
                healArea.appendChild(reportDiv);
            }
            
            window.renderCombinedReport('qx2_analysis_body'); 
            return;
        }

        if (step === state.step + 1) {
            if (step === 2) {
                if (!state.inputEmotionCode || state.inputEmotionCode === 0) { toast(t('请先用魔镜选出情绪', 'Please pick emotion first'), 'warning'); return; }
                runHrvCapture('pre', (done) => {
                    setStep(2); 
                }); 
                return;
            }
            if (step === 3) {
                if (!state.finished) { toast(t('请先等音乐播放完成', 'Please wait'), 'warning'); return; }
                setStep(3); 
                if (mirrorAfterId) qxMoodMirror.setDoIt('qx2_wheel_after', '做');    
                return;
            }
        }
    }

    function onRestart() {
        state.isWorkMode = false; state.playMode = 'guided'; state.currentSegIndex = 0;
        hideWorkInfo();
        if (state.audio) { try { state.audio.pause(); state.audio.src = ''; state.audio.load(); } catch (e) {} }
        try { qxHrvCapture.stop(); qxHrvCapture.release(); } catch (e) {}
        state.outputEmotionCode = 0; state.feedback = null; state.playlist = []; state.currentIndex = 0; state.started = false; state.finished = false;
        state.hrvResult = null; state.hrvAborted = false; state.hrvSeries = []; state.hfSeries = []; state.hrvResultBefore = null;
        _timelineCache = {};
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (mirrorBeforeId) { try { qxMoodMirror.setDoIt('qx2_wheel_before', '做'); } catch (e) {} }
        if (mirrorAfterId) { try { qxMoodMirror.setDoIt('qx2_wheel_after', '不做'); } catch (e) {} }
        if (mirrorAfterId) { try { qxMoodMirror.setValue('qx2_wheel_after', 0); } catch (e) {} }
        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        const body = document.getElementById('qx2_analysis_body');
        if (body) body.innerHTML = '<div class="qx2-analysis-placeholder">' + t('进第 4 步，自动给出分析', 'Analysis at step 4') + '</div>';
        state.finished = false; // 这里必须有
        setStep(1);
        document.querySelectorAll('input[name="qx2_feedback"]').forEach(r => r.checked = false);
    }

    function onExit() {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (state.started && !state.finished) { if (!confirm(t('正在调整中，确定退出吗？', 'Regulating. Exit?'))) return; }
        if (state.audio) { try { state.audio.pause(); state.audio.src = ''; } catch (e) {} }
        try { qxHrvCapture.stop(); qxHrvCapture.release(); } catch (e) {}
        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        window.returnToMain();
    }

    async function qx2_init() {
        if (state.initialized) return;
        
        // 🌟 物理超度：既然抛弃旧 UI，从 DOM 里彻底移除左右侧边栏，绝不让它渲染出来！
        const analysisArea = document.getElementById('qx2_analysis_area');
        const feedbackArea = document.querySelector('.qx2-feedback-area');
        if (analysisArea) analysisArea.remove();
        if (feedbackArea) feedbackArea.remove();

        state.step = 1; state.inputEmotionCode = 0; state.outputEmotionCode = 0; state.feedback = null;
        state.playlist = []; state.currentIndex = 0; state.started = false; state.finished = false;
        state.hrvResult = null; state.hrvAborted = false; state.hrvSeries = []; state.hfSeries = []; state.hrvResultBefore = null;

        if (window.qx0ApplyDataI18n) window.qx0ApplyDataI18n();

        // 自动带入情绪
        initMirrorBefore(0);
        if (!state.isGuest) {
            rpc('emobao_get_today_perception', { p_userid: getUserId() }).then((result) => {
                const row = Array.isArray(result) ? result[0] : result;
                if (row && row.emotion_code != null) {
                    if (typeof qxMoodMirror !== 'undefined' && qxMoodMirror.setValue) {
                        qxMoodMirror.setValue('qx2_wheel_before', row.emotion_code);
                    }
                    state.inputEmotionCode = row.emotion_code;
                }
            }).catch(e => console.warn('拉取今日情绪失败', e));
        }

        initMirrorAfter(); 
        
        document.getElementById('qx2_btn_restart').onclick = onRestart;
        document.getElementById('qx2_btn_exit').onclick = onExit;

        document.querySelectorAll('#qx2_flow_bar .qx2-flow-step').forEach(el => {
            el.addEventListener('click', () => { 
                if (!el.classList.contains('disabled')) {
                    const stepNum = parseInt(el.dataset.step);
                    if (stepNum === 2) {
                        if (!state.inputEmotionCode || state.inputEmotionCode === 0) { toast(t('请先用魔镜选出情绪', 'Please pick emotion first'), 'warning'); return; }
                        runHrvCapture('pre', (done) => {
                            setStep(2); 
                        }); 
                    } else {
                        onFlowStepClick(stepNum);
                    }
                } 
            });
        });

        setStep(1); 
        
        if (window.qxHealChart) { 
            try { 
                qxHealChart.start('qx2_heal_canvas'); 
                qxHealChart.push({ quality: 'good', bpm: 70, rmssd: 50, elapsed: 1 });
            } catch (e) {} 
        }
        
        setTimeout(() => {
            if (window.qxSpeak) {
                const guideText = t(
                    "朋友，您现在可以通过左上角的情绪宝魔镜，选择您的情绪，点击镜框自动识别，点击镜子把儿的小黄点你手动选择，越向左旋转情绪越低落，越向右情绪越高涨。为了对情绪调整做出客观分析，建议您用选定的设备进行60秒的HRV测试，这将为您得到有趣的分析图准备有价值的数据。",
                    "Friend, you can now use the emotion mirror at the top left to select your emotion. Click the frame for automatic recognition, or click the yellow dot to select manually. Rotate left for lower emotions, right for higher emotions. For objective analysis, we recommend a 60-second HRV test."
                );
                window.qxSpeak(guideText, null);
            }
        }, 500);

        state.initialized = true;
    }

    function qx2_destroy() {
        state.initialized = false;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio.src = ''; state.audio = null; }
        try { qxHrvCapture.stop(); qxHrvCapture.release(); } catch (e) {}
        if (mirrorBeforeId) { qxMoodMirror.destroy('qx2_wheel_before'); mirrorBeforeId = null; }
        if (mirrorAfterId) { qxMoodMirror.destroy('qx2_wheel_after'); mirrorAfterId = null; }
        if (window.qxHealChart) { try { qxHealChart.reset(); } catch (e) {} }
        hideWorkInfo();
    }

    // ==========================================
    // 🌟 全屏分析报告渲染器（qx2 页签专业版）
    // ==========================================
    window.renderCombinedReport = function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const hrvBefore = state.hrvResultBefore || {};
        const hrvAfter = state.hrvResult || {};
        const hasHrv = hrvBefore.rmssd != null && hrvAfter.rmssd != null;
        
        const inEmotion = state.inputEmotionCode || 5;
        const outEmotion = state.outputEmotionCode || 5;
        const rmssdBefore = hrvBefore.rmssd || 0;
        const rmssdAfter = hrvAfter.rmssd || 0;
        const bpmBefore = hrvBefore.bpm || 0;
        const bpmAfter = hrvAfter.bpm || 0;
        
        const rmssdDiff = rmssdAfter - rmssdBefore;
        const bpmDiff = bpmBefore - bpmAfter; 
        const emoImprove = outEmotion - inEmotion;
        // 🌟 终极修复真实曲名（绝不偷懒，取实际播放的那首）
        let workName = '系统推荐组曲';
        if (state.isWorkMode) {
            if (state.playlist && state.playlist.length > 0) {
                // 校验 currentIndex 是否越界，如果越界，说明刚播完，取最后一首
                let idx = state.currentIndex;
                if (idx >= state.playlist.length || idx < 0) {
                    idx = state.playlist.length - 1;
                }
                const curWork = state.playlist[idx] || {};
                workName = curWork.title_cn || curWork.title_en || '经典作品';
            } else {
                workName = '经典作品';
            }
        }
        const feedbackText = state.feedback === 'better' ? '更好' : (state.feedback === 'worse' ? '更差' : '一样');

        // ==== 核心数据计算 ====
        let musicPower = state.feedback === 'better' ? 90 : (state.feedback === 'worse' ? 30 : 60);
        let relaxScore = hasHrv ? Math.max(10, Math.min(100, 50 + rmssdDiff * 5)) : 50;
        let emoScore = Math.max(0, Math.min(100, 50 + emoImprove * 20));
        let hrScore = hasHrv ? Math.max(10, Math.min(100, 50 + bpmDiff * 6)) : 50;
        let radarData = [musicPower, relaxScore, hrScore, (state.feedback === 'same' ? 50 : 80), emoScore];

        // ==== 生成专业 AI 解析文字 ====
        let aiComment = "";
        if (!hasHrv) {
            aiComment = "本次您跳过了生理数据采集，主要依据您的主观感受和情绪变化为您生成画像。建议下次完整测试，能获得更精准的生理反馈。";
        } else if (rmssdDiff > 5 && emoImprove > 0) {
            aiComment = "身心完美共振！您的心率（BPM）下降，代表副交感神经的 RMSSD 显著提升。同时您的情绪代码呈正向跳跃，这是一次极其成功的深度放松与情绪疗愈。";
        } else if (rmssdDiff < -5 && emoImprove > 0) {
            aiComment = "您主观觉得情绪变好了，但生理数据（RMSSD 下降）显示您的身体依然处于隐性防御或紧绷状态。音乐虽然取悦了意识，但身体还没有完全卸下防备。建议再听一段舒缓的曲子。";
        } else if (rmssdDiff < 0 && bpmDiff < 0) {
            aiComment = "本次心率和 RMSSD 双双下降，这通常是慢性疲劳或精力耗竭的生理表现。音乐可能让您感到了一丝安宁，但身体的精力储备需要更多的休息来恢复。";
        } else {
            aiComment = "本次自主神经未发生剧烈波动。身体可能还在寻找平衡，请坚持倾听，关注长期的趋势变化。";
        }

        const emoFileMap = {
            1: '1_焦躁.png', 2: '2_热烈.png', 3: '3_欢快.png',
            4: '4_轻快.png', 5: '5_明朗.png', 6: '6_平静.png',
            7: '7_压抑.png', 8: '8_忧伤.png', 9: '9_悲伤.png'
        };
        const imgPath = `picture/${emoFileMap[inEmotion] || '6_平静.png'}`;
        const imgPathAfter = `picture/${emoFileMap[outEmotion] || '6_平静.png'}`;

        const isEn = getLang() === 2;

        container.innerHTML = `
            <div class="qx2-report-container" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #F8FBFF;">
                <!-- 页签栏 -->
                <div class="qx2-report-tabs" style="display: flex; gap: 6px; padding: 12px 16px 0; border-bottom: 1px solid #E1E8F0; flex-shrink: 0; overflow-x: auto;">
                    <button class="qx2-report-tab active" data-tab="1" style="flex:1; padding:10px; border:none; background:#fff; border-radius:8px 8px 0 0; font-weight:bold; color:#2C7BE5; box-shadow:0 -2px 10px rgba(0,0,0,0.03); cursor:pointer; white-space:nowrap;">${isEn ? 'Mood' : '情绪对比'}</button>
                    <button class="qx2-report-tab" data-tab="2" style="flex:1; padding:10px; border:none; background:transparent; border-radius:8px 8px 0 0; font-weight:bold; color:#5A6B87; cursor:pointer; white-space:nowrap;">${isEn ? 'Radar' : '心身雷达'}</button>
                    <button class="qx2-report-tab" data-tab="3" style="flex:1; padding:10px; border:none; background:transparent; border-radius:8px 8px 0 0; font-weight:bold; color:#5A6B87; cursor:pointer; white-space:nowrap;">${isEn ? 'Tri-Ring' : '三色环'}</button>
                    <button class="qx2-report-tab" data-tab="4" style="flex:1; padding:10px; border:none; background:transparent; border-radius:8px 8px 0 0; font-weight:bold; color:#5A6B87; cursor:pointer; white-space:nowrap;">${isEn ? 'AI' : 'AI 判官'}</button>
                </div>

                <!-- 内容区 -->
                <div class="qx2-report-content" style="flex: 1; min-height: 0; overflow-y: auto; padding: 16px; position: relative;">
                    
                    <!-- Tab 1: 情绪对比 -->
                    <div class="qx2-tab-pane active" id="qx2_report_pane_1" style="display: block;">
                        <div style="background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(44,123,229,0.08); display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 13px; color: #64748B; margin-bottom: 8px;">${isEn ? 'Before' : '听前情绪'}</div>
                                <img src="${imgPath}" style="height: 50px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">
                            </div>
                            <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                                <div style="font-size: 24px; color: #CBD5E1; margin-bottom: 8px;">→</div>
                                <div style="font-size: 13px; font-weight: bold; color: #2ECC71; background: #E8F8F0; padding: 4px 12px; border-radius: 12px;">
                                    ${isEn ? 'Feel: ' : '主观感受：'}${feedbackText}
                                </div>
                            </div>
                            <div style="text-align: center; flex: 1;">
                                <div style="font-size: 13px; color: #64748B; margin-bottom: 8px;">${isEn ? 'After' : '听后情绪'}</div>
                                <img src="${imgPathAfter}" style="height: 50px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">
                            </div>
                        </div>
                        <div style="background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(44,123,229,0.08);">
                            <div style="font-size: 15px; font-weight: bold; color: #1A2B4A; margin-bottom: 12px;">${isEn ? 'Music Prescription' : '🎵 音乐处方验证'}</div>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #5A6B87;">
                                    <span>${isEn ? 'Work: ' : '本次聆听作品：'}</span>
                                    <b style="color: #1A2B4A;">《${workName}》</b>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #5A6B87;">
                                    <span>${isEn ? 'Subjective: ' : '主观情绪改善：'}</span>
                                    <b style="color: #2ECC71;">${feedbackText}</b>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #5A6B87;">
                                    <span>${isEn ? 'Objective: ' : '客观生理改善：'}</span>
                                    <b style="color: ${hasHrv && rmssdDiff > 0 ? '#2ECC71' : '#E74C3C'};">
                                        ${hasHrv ? (rmssdDiff > 0 ? 'RMSSD +' + rmssdDiff.toFixed(1) : 'RMSSD ' + rmssdDiff.toFixed(1)) : (isEn ? 'No Data' : '无数据')}
                                    </b>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab 2: 心身雷达 -->
                    <div class="qx2-tab-pane" id="qx2_report_pane_2" style="display: none;">
                        <div style="background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(44,123,229,0.08); display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 15px; font-weight: bold; color: #1A2B4A; margin-bottom: 4px; width: 100%; text-align: center;">${isEn ? '5D Resonance' : '心身共振五维画像'}</div>
                            <canvas id="qx2_radar_canvas" width="320" height="320" style="width: 100%; max-width: 340px; height: auto;"></canvas>
                            <div style="font-size: 13px; color: #5A6B87; text-align: center; margin-top: 10px; line-height: 1.6; background: #F8FBFF; padding: 10px; border-radius: 8px; width: 100%;">
                                ${isEn ? 'Five dimensions covering music experience, physical response, and mood shifts. Closer to the outer ring means better results.' : '五个维度涵盖了您的音乐体验、生理反应与情绪波动。越靠近外圈，代表本次调节的效果越显著。'}
                            </div>
                        </div>
                    </div>

                    <!-- Tab 3: 三色环 -->
                    <div class="qx2-tab-pane" id="qx2_report_pane_3" style="display: none;">
                        <div style="background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 8px 24px rgba(44,123,229,0.08); display: flex; flex-direction: column; align-items: center;">
                            <div style="font-size: 15px; font-weight: bold; color: #1A2B4A; margin-bottom: 8px; width: 100%; text-align: center;">${isEn ? 'Tri-Ring' : '三色环（音乐·生理·情绪）'}</div>
                            <canvas id="qx2_tri_color_canvas" width="320" height="320" style="width: 100%; max-width: 340px; height: auto;"></canvas>
                            <div style="font-size: 13px; color: #5A6B87; text-align: center; margin-top: 10px; line-height: 1.6; background: #F8FBFF; padding: 10px; border-radius: 8px; width: 100%;">
                                ${isEn ? 'Blue: Music effect, Green: Physical relaxation, Orange: Mood improvement. More balanced rings indicate better healing.' : '蓝色代表音乐本身带来的主观效力，绿色代表真实的生理放松程度，橙色代表情绪状态的改善。三色越饱满、越均衡，说明音乐对您的整体疗愈效果越好。'}
                            </div>
                        </div>
                    </div>

                    <!-- Tab 4: AI 判官 -->
                    <div class="qx2-tab-pane" id="qx2_report_pane_4" style="display: none;">
                        <div style="background: linear-gradient(135deg, #E8F8F0 0%, #FFFFFF 100%); border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(46,204,113,0.1); border-left: 6px solid #2ECC71;">
                            <div style="font-size: 16px; font-weight: bold; color: #2C7BE5; margin-bottom: 12px;">✨ ${isEn ? 'AI Analyzer' : 'AI 生理判官'}</div>
                            <div style="font-size: 15px; color: #1A2B4A; line-height: 1.8;">${aiComment}</div>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // 初始化图表绘制
        drawRadar('qx2_radar_canvas', 
            isEn ? ['Music', 'Relax', 'HR Stable', 'Subjective', 'Mood'] : ['音乐效力', '生理放松', '心率平稳', '主观契合', '情绪改善'], 
            radarData
        );
        drawTriColorRing('qx2_tri_color_canvas', musicPower, relaxScore, emoScore);

        // 🌟 页签切换与专属语音播报逻辑
        const tabs = container.querySelectorAll('.qx2-report-tab');
        const panes = container.querySelectorAll('.qx2-tab-pane');
        
        const speakTab1 = isEn 
            ? `Here is your emotion comparison. You listened to ${workName}. Your subjective feeling was ${feedbackText}.` 
            : `这是您的情绪对比图。您刚刚聆听了《${workName}》，主观感受是${feedbackText}，客观生理数据已为您在下方列出。`;

        const speakTab2 = isEn
            ? `This is your 5-dimension resonance radar. It covers music effect, physical relaxation, and mood improvement.`
            : `这是您的心身共振五维画像。雷达图面积越大，说明音乐、生理和情绪的综合共振效果越强。`;

        const speakTab3 = isEn
            ? `This is the tri-color ring. Music power ${Math.round(musicPower)}, Relaxation ${Math.round(relaxScore)}, Mood ${Math.round(emoScore)}.`
            : `这是您的三色环。音乐效力 ${Math.round(musicPower)} 分，生理放松 ${Math.round(relaxScore)} 分，情绪改善 ${Math.round(emoScore)} 分。`;

        const speakTab4 = isEn
            ? `Let's hear the AI analyzer. ${aiComment}`
            : `最后，AI 生理判官为您总结。${aiComment}`;

        const speakMap = { 1: speakTab1, 2: speakTab2, 3: speakTab3, 4: speakTab4 };

        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => {
                    t.style.background = 'transparent';
                    t.style.color = '#5A6B87';
                    t.style.boxShadow = 'none';
                });
                tab.style.background = '#fff';
                tab.style.color = '#2C7BE5';
                tab.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.03)';

                const targetTabNum = tab.dataset.tab;
                const targetId = 'qx2_report_pane_' + targetTabNum;
                panes.forEach(p => p.style.display = 'none');
                const activePane = document.getElementById(targetId);
                if (activePane) activePane.style.display = 'block';

                if (window.qxSpeak) {
                    window.qxSpeak(speakMap[targetTabNum], null);
                }
            };
        });

        setTimeout(() => {
            if (window.speechSynthesis) window.speechSynthesis.cancel(); 
            if (window.qxSpeak) {
                window.qxSpeak(speakTab1, null);
            }
        }, 666); 
    };

    function getEmoji(code) {
        const map = { 1:'😫', 2:'😟', 3:'😐', 4:'🙂', 5:'😌', 6:'😊', 7:'😄', 8:'🤩', 9:'😎' };
        return map[code] || '😐';
    }
    
    function drawRadar(canvasId, labels, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const R = Math.min(cx, cy) - 40;
        const N = labels.length;
        const angleStep = (Math.PI * 2) / N;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#E1E8F0';
        ctx.lineWidth = 1;
        for (let level = 1; level <= 4; level++) {
            const r = (R / 4) * level;
            ctx.beginPath();
            for (let i = 0; i < N; i++) {
                const x = cx + r * Math.cos(i * angleStep - Math.PI / 2);
                const y = cy + r * Math.sin(i * angleStep - Math.PI / 2);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath(); ctx.stroke();
        }

        ctx.fillStyle = '#5A6B87'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < N; i++) {
            const ang = i * angleStep - Math.PI / 2;
            const x = cx + R * Math.cos(ang);
            const y = cy + R * Math.sin(ang);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillText(labels[i], cx + (R + 20) * Math.cos(ang), cy + (R + 20) * Math.sin(ang));
        }

        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const r = R * 0.5;
            const x = cx + r * Math.cos(i * angleStep - Math.PI / 2);
            const y = cy + r * Math.sin(i * angleStep - Math.PI / 2);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 207, 216, 0.3)'; ctx.fill();
        ctx.strokeStyle = '#C8CFD8'; ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const val = Math.max(0, Math.min(100, data[i]));
            const r = R * (val / 100);
            const x = cx + r * Math.cos(i * angleStep - Math.PI / 2);
            const y = cy + r * Math.sin(i * angleStep - Math.PI / 2);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(44, 123, 229, 0.3)'; ctx.fill();
        ctx.strokeStyle = '#2C7BE5'; ctx.lineWidth = 2; ctx.stroke();
    }

    function drawTriColorRing(canvasId, musicPower, relaxScore, emoScore) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const R = Math.min(cx, cy) - 60; 
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const isEn = getLang() === 2;
        const values = [
            { name: isEn ? 'Music' : '音乐效力', val: musicPower, color: '#2C7BE5' },
            { name: isEn ? 'Relax' : '生理放松', val: relaxScore, color: '#2ECC71' },
            { name: isEn ? 'Mood' : '情绪改善', val: emoScore,   color: '#F39C12' }
        ];
        
        let startAngle = -Math.PI / 2;
        const gap = 0.2;
        
        values.forEach(item => {
            const angle = (item.val / 100) * (Math.PI * 2 / 3) - gap; 
            const endAngle = startAngle + angle;
            
            ctx.beginPath();
            ctx.arc(cx, cy, R, startAngle, endAngle);
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 18;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            const midAngle = startAngle + angle / 2;
            const textR = R + 30; 
            const lx = cx + Math.cos(midAngle) * textR;
            const ly = cy + Math.sin(midAngle) * textR;
            
            const lineStartR = R + 12;
            const lineEndR = R + 24;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(midAngle) * lineStartR, cy + Math.sin(midAngle) * lineStartR);
            ctx.lineTo(cx + Math.cos(midAngle) * lineEndR, cy + Math.sin(midAngle) * lineEndR);
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#5A6B87';
            ctx.font = 'bold 13px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.name, lx, ly - 8);
            
            ctx.fillStyle = item.color;
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(Math.round(item.val), lx, ly + 12);
            
            startAngle = endAngle + gap;
        });
    }

    window.qx2_init = qx2_init;
    window.qx2_destroy = qx2_destroy;

})();