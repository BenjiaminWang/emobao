/* ================================================================
   情绪宝 - qx6-8 音乐库管理面板
   路径：js/qx6/qx6_8_music_lib.js
   日期：2026-10-13
   说明：
   - 仅系统管理员 / 音乐管理可访问
   - 树形显示音乐类型 + 曲目
   - 点曲目展开详情：试听 / 改名 / 删除
   - 增加音乐：上传文件 + 填资料
   - 补齐时长：批量读取缺失 duration 的曲目
   ================================================================ */

   (function () {
    'use strict';

    const U = window.qx6Utils;
    if (!U) {
        console.error('[qx6_8_music_lib] 缺少 qx6Utils');
        return;
    }
    const t = U.t;

    const UPLOAD_WORKER_URL = '';

    function render(bodyEl) {
        if (!U.isAdmin() && !U.isMusician()) {
            bodyEl.innerHTML = `<div class="qx6-empty">${t('仅系统管理员/音乐管理可访问。', 'Admin/Music Admin only.')}</div>`;
            return;
        }

        bodyEl.innerHTML = `
            <div class="qx6-card">
                <div class="qx6-ml-toolbar">
                    <button class="qx6-btn qx6-btn-primary" id="qx6_ml_refresh">${t('刷新', 'Refresh')}</button>
                    <button class="qx6-btn qx6-btn-secondary" id="qx6_ml_fill_dur">${t('补齐时长', 'Fill Durations')}</button>
                    <button class="qx6-btn qx6-btn-primary" id="qx6_ml_add">${t('增加音乐', 'Add Music')}</button>
                </div>
                <div class="qx6-status" id="qx6_ml_status"></div>
                <div class="qx6-ml-tree" id="qx6_ml_tree">
                    <div class="qx6-empty">${t('加载中…', 'Loading…')}</div>
                </div>
            </div>

            <div class="qx6-ml-modal" id="qx6_ml_modal" style="display:none;">
                <div class="qx6-ml-modal-inner">
                    <div class="qx6-ml-modal-title" id="qx6_ml_modal_title">${t('音乐资料', 'Music Info')}</div>

                    <div class="qx6-ml-field" id="qx6_ml_field_cat">
                        <label>${t('大类', 'Category')}</label>
                        <select class="qx6-input" id="qx6_ml_cat_select"></select>
                    </div>

                    <div class="qx6-ml-field" id="qx6_ml_field_file">
                        <label>${t('选择文件', 'Choose File')}</label>
                        <input type="file" class="qx6-input" id="qx6_ml_file" accept="audio/*">
                        <div class="qx6-ml-fileinfo" id="qx6_ml_fileinfo"></div>
                    </div>

                    <div class="qx6-ml-field">
                        <label>${t('中文名', 'Name CN')}</label>
                        <input type="text" class="qx6-input" id="qx6_ml_name_cn">
                    </div>
                    <div class="qx6-ml-field">
                        <label>${t('英文名', 'Name EN')}</label>
                        <input type="text" class="qx6-input" id="qx6_ml_name_en">
                    </div>

                    <div class="qx6-status" id="qx6_ml_modal_status"></div>

                    <div class="qx6-ml-modal-actions">
                        <button class="qx6-btn qx6-btn-secondary" id="qx6_ml_cancel">${t('取消', 'Cancel')}</button>
                        <button class="qx6-btn qx6-btn-primary" id="qx6_ml_save">${t('保存', 'Save')}</button>
                    </div>
                </div>
            </div>
        `;

        const refreshBtn = bodyEl.querySelector('#qx6_ml_refresh');
        const fillDurBtn = bodyEl.querySelector('#qx6_ml_fill_dur');
        const addBtn     = bodyEl.querySelector('#qx6_ml_add');
        const statusEl   = bodyEl.querySelector('#qx6_ml_status');
        const treeEl     = bodyEl.querySelector('#qx6_ml_tree');
        const modal      = bodyEl.querySelector('#qx6_ml_modal');
        const modalTitle = bodyEl.querySelector('#qx6_ml_modal_title');
        const fieldCat   = bodyEl.querySelector('#qx6_ml_field_cat');
        const catSelect  = bodyEl.querySelector('#qx6_ml_cat_select');
        const fieldFile  = bodyEl.querySelector('#qx6_ml_field_file');
        const fileInput  = bodyEl.querySelector('#qx6_ml_file');
        const fileInfo   = bodyEl.querySelector('#qx6_ml_fileinfo');
        const nameCnEl   = bodyEl.querySelector('#qx6_ml_name_cn');
        const nameEnEl   = bodyEl.querySelector('#qx6_ml_name_en');
        const modalStatus = bodyEl.querySelector('#qx6_ml_modal_status');
        const cancelBtn  = bodyEl.querySelector('#qx6_ml_cancel');
        const saveBtn    = bodyEl.querySelector('#qx6_ml_save');

        let editingTrack = null;
        let cachedTypes = [];
        let cachedTracks = [];
        let selectedDuration = null;

        function showStatus(el, text, type) {
            el.innerText = text || '';
            el.className = 'qx6-status' + (text ? ' qx6-status-' + type : '');
        }

        async function loadTree() {
            showStatus(statusEl, t('加载中…', 'Loading…'), 'info');
            try {
                const [types, tracks] = await Promise.all([
                    U.restGet('emobao_musictype?select=*&order=sortorder.asc'),
                    U.restGet('emobao_musictrack?select=trackid,musictypecode,title_cn,title_en,duration,fileurl,createdat,createdby&order=createdat.desc&limit=2000'),
                ]);

                cachedTypes = types || [];
                cachedTracks = tracks || [];

                showStatus(statusEl, t(`共 ${cachedTracks.length} 首`, `${cachedTracks.length} tracks`), 'success');
                renderTree();
            } catch (e) {
                console.error(e);
                showStatus(statusEl, t('加载失败：', 'Load failed: ') + e.message, 'error');
                treeEl.innerHTML = `<div class="qx6-empty">${t('加载失败', 'Load failed')}</div>`;
            }
        }

        function renderTree() {
            treeEl.innerHTML = '';

            cachedTypes.forEach(ty => {
                const tracks = cachedTracks.filter(t => t.musictypecode === ty.musictypecode);

                const catEl = document.createElement('div');
                catEl.className = 'qx6-ml-cat';
                catEl.dataset.catcode = ty.musictypecode;

                const titleRow = document.createElement('div');
                titleRow.className = 'qx6-ml-cat-title';
                titleRow.innerHTML = `
                    <span class="qx6-ml-arrow">▶</span>
                    <span>📁 ${ty.musictypecode} ${ty.typename_cn} / ${ty.typename_en}</span>
                    <span class="qx6-ml-count">(${tracks.length})</span>
                `;

                const bodyRow = document.createElement('div');
                bodyRow.className = 'qx6-ml-cat-body';
                bodyRow.style.display = 'none';

                tracks.forEach(tr => {
                    const trEl = document.createElement('div');
                    trEl.className = 'qx6-ml-track';
                    trEl.innerHTML = `
                        <span class="qx6-ml-track-title">🎵 ${tr.title_cn}</span>
                        <span class="qx6-ml-track-dur">${U.formatDuration(tr.duration)}</span>
                        <span class="qx6-ml-track-date">${(tr.createdat || '').slice(0,10)}</span>
                    `;
                    trEl.onclick = (e) => {
                        e.stopPropagation();
                        openTrackDetail(trEl, tr);
                    };
                    bodyRow.appendChild(trEl);
                });

                if (!tracks.length) {
                    const empty = document.createElement('div');
                    empty.className = 'qx6-ml-empty';
                    empty.innerText = t('（该类暂无音乐）', '(no tracks)');
                    bodyRow.appendChild(empty);
                }

                titleRow.onclick = () => {
                    const isOpen = bodyRow.style.display !== 'none';
                    bodyRow.style.display = isOpen ? 'none' : 'block';
                    titleRow.querySelector('.qx6-ml-arrow').innerText = isOpen ? '▶' : '▼';
                };

                catEl.appendChild(titleRow);
                catEl.appendChild(bodyRow);
                treeEl.appendChild(catEl);
            });
        }

        async function openTrackDetail(trEl, tr) {
            const next = trEl.nextSibling;
            if (next && next.classList && next.classList.contains('qx6-ml-detail')) {
                next.remove();
                return;
            }
            treeEl.querySelectorAll('.qx6-ml-detail').forEach(el => el.remove());

            const detail = document.createElement('div');
            detail.className = 'qx6-ml-detail';
            detail.innerHTML = `
                <div class="qx6-ml-detail-row"><b>${t('中文名','CN')}:</b> ${tr.title_cn}</div>
                <div class="qx6-ml-detail-row"><b>${t('英文名','EN')}:</b> ${tr.title_en}</div>
                <div class="qx6-ml-detail-row"><b>${t('时长','Duration')}:</b> ${U.formatDuration(tr.duration)}</div>
                <div class="qx6-ml-detail-row"><b>${t('大小','Size')}:</b> <span class="qx6-ml-size">${t('查询中…','Loading…')}</span></div>
                <div class="qx6-ml-detail-row"><b>${t('入库','Created')}:</b> ${(tr.createdat || '').slice(0,19)}</div>
                <div class="qx6-ml-detail-row"><b>${t('操作者','By')}:</b> <span class="qx6-ml-by">${tr.createdby || '—'}</span></div>
                <div class="qx6-ml-detail-actions">
                    <button class="qx6-btn qx6-btn-primary qx6-btn-small" data-act="play">${t('试听','Play')}</button>
                    <button class="qx6-btn qx6-btn-primary qx6-btn-small" data-act="rename">${t('改名','Rename')}</button>
                    <button class="qx6-btn qx6-btn-danger qx6-btn-small" data-act="delete">${t('删除','Delete')}</button>
                </div>
                <div class="qx6-ml-audio-host"></div>
            `;
            trEl.parentNode.insertBefore(detail, trEl.nextSibling);

            if (tr.fileurl) {
                U.fetchFileSize(tr.fileurl).then(size => {
                    const sizeEl = detail.querySelector('.qx6-ml-size');
                    if (sizeEl) sizeEl.innerText = U.formatSize(size);
                });
            } else {
                detail.querySelector('.qx6-ml-size').innerText = '—';
            }

            detail.querySelector('[data-act="play"]').onclick = () => {
                const host = detail.querySelector('.qx6-ml-audio-host');
                if (host.dataset.playing === '1') {
                    host.innerHTML = '';
                    host.dataset.playing = '0';
                    return;
                }
                if (!tr.fileurl) {
                    alert(t('此曲目无文件', 'No file'));
                    return;
                }
                host.innerHTML = `<audio controls autoplay src="${tr.fileurl}" style="width:100%;margin-top:6px;"></audio>`;
                host.dataset.playing = '1';
            };
            detail.querySelector('[data-act="rename"]').onclick = () => openRenameModal(tr);
            detail.querySelector('[data-act="delete"]').onclick = () => deleteTrack(tr);
        }

        function openRenameModal(tr) {
            editingTrack = tr;
            modalTitle.innerText = t('改名', 'Rename') + '：' + tr.title_cn;
            fieldCat.style.display = 'none';
            fieldFile.style.display = 'none';
            fileInfo.innerText = '';
            nameCnEl.value = tr.title_cn || '';
            nameEnEl.value = tr.title_en || '';
            showStatus(modalStatus, '', '');
            modal.style.display = 'flex';
        }

        async function deleteTrack(tr) {
            if (!confirm(t('确定删除「' + tr.title_cn + '」？', 'Delete "' + tr.title_cn + '"?'))) return;
            if (!confirm(t('此操作不可恢复！再次确认？', 'This cannot be undone! Confirm again?'))) return;
            const typed = prompt(t('请输入音乐名以确认删除：', 'Type the music name to confirm:'), '');
            if (typed !== tr.title_cn) {
                alert(t('名称不匹配，已取消', 'Name mismatch, cancelled'));
                return;
            }

            try {
                const res = await fetch(
                    `${U.SUPABASE_URL}/rest/v1/emobao_musictrack?trackid=eq.${encodeURIComponent(tr.trackid)}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'apikey': U.SUPABASE_KEY,
                            'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                        },
                    }
                );
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt);
                }
                loadTree();
            } catch (e) {
                console.error(e);
                alert(t('删除失败：', 'Delete failed: ') + e.message);
            }
        }

        function openAddModal() {
            editingTrack = null;
            modalTitle.innerText = t('增加音乐', 'Add Music');
            fieldCat.style.display = '';
            fieldFile.style.display = '';

            catSelect.innerHTML = cachedTypes.map(ty =>
                `<option value="${ty.musictypecode}">${ty.musictypecode} ${ty.typename_cn} / ${ty.typename_en}</option>`
            ).join('');

            fileInput.value = '';
            fileInfo.innerText = '';
            nameCnEl.value = '';
            nameEnEl.value = '';
            selectedDuration = null;
            showStatus(modalStatus, '', '');
            modal.style.display = 'flex';
        }

        fileInput.onchange = async () => {
            const f = fileInput.files[0];
            if (!f) return;

            fileInfo.innerText = `${f.name} (${U.formatSize(f.size)}) ${t('读取时长中…','Reading duration…')}`;
            selectedDuration = null;

            try {
                const url = URL.createObjectURL(f);
                const dur = await U.readAudioDuration(url);
                URL.revokeObjectURL(url);
                selectedDuration = dur;
                if (dur) {
                    fileInfo.innerText = `${f.name} (${U.formatSize(f.size)}, ${U.formatDuration(dur)})`;
                } else {
                    fileInfo.innerText = `${f.name} (${U.formatSize(f.size)}) ${t('⚠ 无法读取时长','⚠ Cannot read duration')}`;
                }
            } catch (e) {
                fileInfo.innerText = `${f.name} (${U.formatSize(f.size)}) ${t('⚠ 读取失败','⚠ Read failed')}`;
            }
        };

        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            editingTrack = null;
            selectedDuration = null;
        };

        saveBtn.onclick = async () => {
            const nameCn = nameCnEl.value.trim();
            const nameEn = nameEnEl.value.trim();

            if (!nameCn && !nameEn) {
                showStatus(modalStatus, t('至少填一个名字', 'At least one name'), 'error');
                return;
            }

            if (editingTrack) {
                showStatus(modalStatus, t('保存中…', 'Saving…'), 'info');
                saveBtn.disabled = true;
                try {
                    const res = await fetch(
                        `${U.SUPABASE_URL}/rest/v1/emobao_musictrack?trackid=eq.${encodeURIComponent(editingTrack.trackid)}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'apikey': U.SUPABASE_KEY,
                                'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=minimal',
                            },
                            body: JSON.stringify({
                                title_cn: nameCn || nameEn,
                                title_en: nameEn || nameCn,
                                updatedat: new Date().toISOString(),
                            }),
                        }
                    );
                    if (!res.ok) {
                        const txt = await res.text();
                        throw new Error(txt);
                    }
                    showStatus(modalStatus, t('已保存', 'Saved'), 'success');
                    setTimeout(() => {
                        modal.style.display = 'none';
                        editingTrack = null;
                        loadTree();
                    }, 500);
                } catch (e) {
                    console.error(e);
                    showStatus(modalStatus, t('保存失败：', 'Save failed: ') + e.message, 'error');
                    saveBtn.disabled = false;
                }
                return;
            }

            const file = fileInput.files[0];
            if (!file) {
                showStatus(modalStatus, t('请选择文件', 'Choose file'), 'error');
                return;
            }
            if (!selectedDuration) {
                showStatus(modalStatus, t('无法读取时长，请检查文件', 'Cannot read duration'), 'error');
                return;
            }

            const musictypecode = parseInt(catSelect.value);
            const ty = cachedTypes.find(x => x.musictypecode === musictypecode);
            const typenameCn = ty ? ty.typename_cn : '';

            let finalCn = nameCn || nameEn;
            let finalEn = nameEn || nameCn;
            let suffix = 0;
            while (cachedTracks.some(t => t.title_cn === finalCn || t.title_en === finalEn)) {
                suffix++;
                finalCn = (nameCn || nameEn) + `(${suffix})`;
                finalEn = (nameEn || nameCn) + `(${suffix})`;
            }

            if (suffix > 0) {
                const ok = confirm(t(
                    `名称重复，将自动改为「${finalCn}」，是否继续？`,
                    `Name duplicated, will use "${finalCn}". Continue?`
                ));
                if (!ok) return;
            }

            showStatus(modalStatus, t('上传中…', 'Uploading…'), 'info');
            saveBtn.disabled = true;

            try {
                let fileurl;
                try {
                    fileurl = await uploadMusicToR2(file, musictypecode, typenameCn, file.name);
                } catch (e) {
                    throw new Error(t(
                        '上传功能待 R2 配置（' + e.message + '）',
                        'Upload pending R2 config: ' + e.message
                    ));
                }

                const res = await fetch(`${U.SUPABASE_URL}/rest/v1/emobao_musictrack`, {
                    method: 'POST',
                    headers: {
                        'apikey': U.SUPABASE_KEY,
                        'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal',
                    },
                    body: JSON.stringify({
                        musictypecode,
                        title_cn: finalCn,
                        title_en: finalEn,
                        duration: selectedDuration,
                        fileurl,
                        createdby: U.getUserId(),
                        isactive: true,
                    }),
                });

                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt);
                }

                showStatus(modalStatus, t('已保存', 'Saved'), 'success');
                setTimeout(() => {
                    modal.style.display = 'none';
                    selectedDuration = null;
                    loadTree();
                }, 500);

            } catch (e) {
                console.error(e);
                showStatus(modalStatus, t('保存失败：', 'Save failed: ') + e.message, 'error');
                saveBtn.disabled = false;
            }
        };

        fillDurBtn.onclick = async () => {
            if (!confirm(t('将逐首读取时长并写入数据库，可能耗时几分钟。继续？', 'Will read and update durations. Continue?'))) return;

            try {
                const rows = await U.restGet(
                    'emobao_musictrack?duration=is.null&select=trackid,fileurl,title_cn'
                );
                if (!rows.length) {
                    showStatus(statusEl, t('所有曲目时长已齐全', 'All durations present'), 'success');
                    return;
                }

                fillDurBtn.disabled = true;
                let done = 0, ok = 0, failed = 0;

                for (const r of rows) {
                    done++;
                    showStatus(statusEl, t(`补齐中 ${done}/${rows.length}：${r.title_cn}`,
                        `Filling ${done}/${rows.length}: ${r.title_cn}`), 'info');

                    if (!r.fileurl) { failed++; continue; }

                    const dur = await U.readAudioDuration(r.fileurl);
                    if (!dur) { failed++; continue; }

                    try {
                        const res = await fetch(
                            `${U.SUPABASE_URL}/rest/v1/emobao_musictrack?trackid=eq.${encodeURIComponent(r.trackid)}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'apikey': U.SUPABASE_KEY,
                                    'Authorization': `Bearer ${U.SUPABASE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'Prefer': 'return=minimal',
                                },
                                body: JSON.stringify({ duration: dur }),
                            }
                        );
                        if (res.ok) ok++;
                        else failed++;
                    } catch (e) {
                        failed++;
                    }
                }

                showStatus(statusEl, t(`补齐完成：成功 ${ok}，失败 ${failed}`,
                    `Done: ${ok} ok, ${failed} failed`), failed ? 'warning' : 'success');
                fillDurBtn.disabled = false;
                loadTree();

            } catch (e) {
                console.error(e);
                showStatus(statusEl, t('补齐失败：', 'Fill failed: ') + e.message, 'error');
                fillDurBtn.disabled = false;
            }
        };

        async function uploadMusicToR2(file, musictypecode, typenameCn, filename) {
            if (!UPLOAD_WORKER_URL) {
                throw new Error(t('Worker 未配置', 'Worker not configured'));
            }

            const path = `${musictypecode}${typenameCn}/${filename}`;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('userid', U.getUserId());
            fd.append('path', path);

            const res = await fetch(UPLOAD_WORKER_URL, {
                method: 'POST',
                body: fd,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (!data.url) throw new Error(t('返回无 URL', 'No URL returned'));
            return data.url;
        }

        refreshBtn.onclick = loadTree;
        addBtn.onclick = openAddModal;

        loadTree();
    }

    window.qx6Register('music_lib', render);
})();