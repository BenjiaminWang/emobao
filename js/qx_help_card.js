/* ================================================================
   js/qx_help_card.js   v4
   日期：2026-09-26
   情绪宝 - 通用弧形卡片（说明 / 问答 / 测评 / 报告 / 帮助）
   - 依赖：picture/qx_card_frame.png
   - 依赖：style.css 里的 .qx-card-overlay / .qx-card-frame* / .qx-card-frame-pager
   - 对外 API（向后兼容 v2）：
       qxHelpCard.show({ title, body, onClose })
       qxHelpCard.show({ title, pages:[{title, body}, ...] })
       qxHelpCard.hide()
       qxHelpCard.setContent({ title, body })
   ================================================================ */

   (function () {
    'use strict';

    const OVERLAY_ID = 'qx_card_overlay';
    const FRAME_ID   = 'qx_card_frame';
    const TITLE_ID   = 'qx_card_title';
    const BODY_ID    = 'qx_card_body';
    const PAGER_ID   = 'qx_card_pager';

    let _onClose = null;
    let _pages = null;
    let _pageIndex = 0;

    function ensureDom() {
        let overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'qx-card-overlay';

        const frame = document.createElement('div');
        frame.id = FRAME_ID;
        frame.className = 'qx-card-frame';

        const inner = document.createElement('div');
        inner.className = 'qx-card-frame-inner';

        const head = document.createElement('div');
        head.className = 'qx-card-frame-head';

        const title = document.createElement('div');
        title.id = TITLE_ID;
        title.className = 'qx-card-frame-title';
        title.innerText = '说明';

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'qx-card-frame-close';
        close.innerText = '✕';
        close.addEventListener('click', function () { hide(); });

        head.appendChild(title);
        head.appendChild(close);

        const body = document.createElement('div');
        body.id = BODY_ID;
        body.className = 'qx-card-frame-body';

        const pager = document.createElement('div');
        pager.id = PAGER_ID;
        pager.className = 'qx-card-frame-pager';
        pager.innerHTML =
            '<button type="button" class="qx-card-pager-btn" id="qx_card_prev">←</button>' +
            '<span class="qx-card-pager-info" id="qx_card_pageinfo"></span>' +
            '<button type="button" class="qx-card-pager-btn" id="qx_card_next">→</button>';

        inner.appendChild(head);
        inner.appendChild(body);
        inner.appendChild(pager);
        frame.appendChild(inner);
        overlay.appendChild(frame);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) hide();
        });

        const prev = document.getElementById('qx_card_prev');
        const next = document.getElementById('qx_card_next');
        if (prev) prev.addEventListener('click', function () { goPage(-1); });
        if (next) next.addEventListener('click', function () { goPage(1); });

        return overlay;
    }

    function renderPage() {
        const titleEl = document.getElementById(TITLE_ID);
        const bodyEl  = document.getElementById(BODY_ID);
        const pager   = document.getElementById(PAGER_ID);
        const infoEl  = document.getElementById('qx_card_pageinfo');
        const prevEl  = document.getElementById('qx_card_prev');
        const nextEl  = document.getElementById('qx_card_next');

        if (!_pages || _pages.length === 0) {
            if (titleEl) titleEl.innerText = '说明';
            if (bodyEl)  bodyEl.innerText  = '';
            if (pager)   pager.style.display = 'none';
            return;
        }

        if (_pages.length <= 1) {
            if (pager) pager.style.display = 'none';
            const p = _pages[0] || {};
            if (titleEl) titleEl.innerText = p.title || '';
            if (bodyEl)  bodyEl.innerText  = p.body  || '';
            return;
        }

        if (pager) pager.style.display = 'flex';

        const p = _pages[_pageIndex] || {};
        if (titleEl) titleEl.innerText = p.title || '';
        if (bodyEl)  bodyEl.innerText  = p.body  || '';
        if (infoEl)  infoEl.innerText  = (_pageIndex + 1) + ' / ' + _pages.length;
        if (prevEl)  prevEl.disabled   = (_pageIndex <= 0);
        if (nextEl)  nextEl.disabled   = (_pageIndex >= _pages.length - 1);
    }

    function goPage(delta) {
        if (!_pages || _pages.length <= 1) return;
        const n = _pageIndex + delta;
        if (n < 0 || n >= _pages.length) return;
        _pageIndex = n;
        renderPage();
    }

    function show(options) {
        options = options || {};
        const overlay = ensureDom();

        if (Array.isArray(options.pages) && options.pages.length > 0) {
            _pages = options.pages;
        } else {
            _pages = [{ title: options.title || '', body: options.body || '' }];
        }
        _pageIndex = 0;
        _onClose = options.onClose || null;

        renderPage();
        overlay.classList.add('show');
    }

    function hide() {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.classList.remove('show');
        if (typeof _onClose === 'function') {
            try { _onClose(); } catch (e) {}
            _onClose = null;
        }
        _pages = null;
        _pageIndex = 0;
    }

    function setContent(options) {
        options = options || {};
        const titleEl = document.getElementById(TITLE_ID);
        const bodyEl  = document.getElementById(BODY_ID);
        if (titleEl && options.title != null) titleEl.innerText = options.title;
        if (bodyEl  && options.body  != null) bodyEl.innerText  = options.body;
    }

    window.qxHelpCard = {
        show: show,
        hide: hide,
        setContent: setContent,
    };

})();