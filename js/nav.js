/* =====================================================================
   nav.js - the page transition for EVERY page, plus the home page buttons.

   Put this ONE line inside the <head> of every page (home, projects, contact,
   skills ...), after the stylesheet links:

        <script src="nav.js"></script>          (or js/nav.js, wherever it lives)

   It has to be in the <head> so the page is covered from the very first
   paint (otherwise you would see the page flash before it opens).

   How it looks
   One dark slanted panel with a thin gold edge.
   - Leaving: the panel slides in from the left and covers the page, then the
     next page loads.
   - Arriving: the next page starts on that same covered picture (so there is
     no jump) and the panel slides away to the right, revealing the page.
   Short and quick on purpose: about half a second each way.

   Also here
   - Home page diamonds open <data-page>.html (projects -> projects.html)
     when the page is in PAGES_READY, and shake when it is not built yet.
   - Coming from the start screen: a plain fade in from black instead.
   - People who prefer reduced motion get no animation at all.
   ===================================================================== */

(function () {
    'use strict';

    // Pages that actually exist. Add 'resume' here when you build it.
    // Diamond buttons for pages not in this list just shake.
    const PAGES_READY = ['skills', 'projects', 'contact'];

    const LEAVE_MS = 560;       // how long the panel takes to cover the screen before the next page loads

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------------------------------------------------------
       the overlay: built right away so the page is covered from the first paint
       --------------------------------------------------------------- */
    const CSS = `
.nav-wipe {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    overflow: hidden;
    pointer-events: none;
}
.nav-wipe.leaving { pointer-events: auto; }

.nav-wipe .nw-panel {
    position: absolute;
    top: -8%;
    bottom: -8%;
    left: -20%;
    width: 140%;
    background:
        repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.028) 0 2px, transparent 2px 9px),
        linear-gradient(180deg, #080a0f, #020304);
    border-left: 3px solid #f2c81c;
    border-right: 3px solid #f2c81c;
    box-shadow: 0 0 44px rgba(255, 170, 40, 0.45);
    transform: translateX(0) skewX(-14deg);
    animation: navOut 0.6s 0.1s cubic-bezier(0.7, 0, 0.3, 1) both;
}

/* a thin red line runs just outside each gold edge */
.nav-wipe .nw-panel::before,
.nav-wipe .nw-panel::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #ff3b4e;
    box-shadow: 0 0 12px rgba(255, 59, 78, 0.8);
}
.nav-wipe .nw-panel::before { left: -14px; }
.nav-wipe .nw-panel::after  { right: -14px; }

/* a very faint dragon kanji in the middle of the panel */
.nav-wipe .nw-mark {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Edo SZ', 'Yu Gothic', 'Meiryo', serif;
    font-size: min(46vh, 420px);
    font-weight: 900;
    line-height: 1;
    color: rgba(242, 200, 28, 0.05);
    user-select: none;
}

/* leaving: slide in from the left */
.nav-wipe.leaving .nw-panel { animation: navIn 0.5s cubic-bezier(0.7, 0, 0.3, 1) both; }

/* coming from the start screen: just a fade from black */
.nav-wipe.from-start { animation: navFade 0.9s ease both; }
.nav-wipe.from-start .nw-panel { animation: none; }
.nav-wipe.from-start.leaving { animation: none; }
.nav-wipe.from-start.leaving .nw-panel { animation: navIn 0.5s cubic-bezier(0.7, 0, 0.3, 1) both; }

@keyframes navIn   { from { transform: translateX(-105%) skewX(-14deg); } to { transform: translateX(0) skewX(-14deg); } }
@keyframes navOut  { from { transform: translateX(0) skewX(-14deg); }     to { transform: translateX(105%) skewX(-14deg); } }
@keyframes navFade { from { opacity: 1; } to { opacity: 0; } }

@media (prefers-reduced-motion: reduce) { .nav-wipe { display: none; } }
`;

    const style = document.createElement('style');
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);

    const wipe = document.createElement('div');
    wipe.className = 'nav-wipe';
    wipe.setAttribute('aria-hidden', 'true');
    wipe.innerHTML = '<div class="nw-panel"><span class="nw-mark">龍</span></div>';
    document.documentElement.appendChild(wipe);

    // coming from the start screen? fade in from black instead of the panel
    let fromStart = false;
    try {
        fromStart = !!sessionStorage.getItem('fromStart');
        if (fromStart) sessionStorage.removeItem('fromStart');
    } catch (e) { /* storage blocked: ignore */ }

    if (fromStart && !reduceMotion) {
        wipe.classList.add('from-start');
        wipe.addEventListener('animationend', function (e) {
            if (e.target === wipe) wipe.classList.remove('from-start');
        });
    }

    /* ---------------------------------------------------------------
       leaving a page
       --------------------------------------------------------------- */
    let leaving = false;

    function goTo(url) {
        if (leaving) return;
        leaving = true;
        if (reduceMotion) { window.location.href = url; return; }
        wipe.classList.add('leaving');
        setTimeout(function () { window.location.href = url; }, LEAVE_MS);
    }

    // the browser's Back / Forward can bring a page back exactly as it was left (panel closed): open it again
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        leaving = false;
        wipe.classList.remove('leaving', 'from-start');
    });

    /* ---------------------------------------------------------------
       clicks: home page diamonds, and every link to another page of this site
       --------------------------------------------------------------- */
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented) return;

        // 1) home page diamond buttons
        const button = e.target.closest && e.target.closest('.diamond-btn');
        if (button) {
            const page = button.dataset.page;

            if (PAGES_READY.indexOf(page) !== -1) {
                goTo(page + '.html');
            } else if (!reduceMotion && button.animate) {
                // not built yet: a quick shake so the click still feels acknowledged
                button.animate(
                    [
                        { transform: 'translateX(0)' },
                        { transform: 'translateX(-7px)' },
                        { transform: 'translateX(7px)' },
                        { transform: 'translateX(-4px)' },
                        { transform: 'translateX(4px)' },
                        { transform: 'translateX(0)' }
                    ],
                    { duration: 380 }
                );
            }
            return;
        }

        // 2) ordinary links (Back buttons etc.) to another page of this site
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const link = e.target.closest && e.target.closest('a[href]');
        if (!link) return;
        if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;

        let url;
        try { url = new URL(link.href, window.location.href); } catch (err) { return; }

        const samePlace = url.protocol === window.location.protocol && url.host === window.location.host;
        if (!samePlace) return;                                                   // other site, mailto:, tel: ...
        if (url.pathname === window.location.pathname) return;                    // same page / #anchor
        if (!/\.html?$/i.test(url.pathname) && !/\/$/.test(url.pathname)) return; // only pages, not files

        e.preventDefault();
        goTo(url.href);
    });
})();