/* =====================================================================
   script.js  -  home page
   (nav.js still handles opening the pages; this file only adds feel.)

   What it does
   - fullscreen: tries at load (browsers only allow it after a click or key press,
     so it tries again on your first click / key). F toggles it.
   - arrow keys pick a diamond (Up = Projects, Left = Contact, Right = Skills,
     Down = Resume); Enter opens the picked one through its normal click.
   - click on a diamond: it dips and a ring flies out of it
   - HP / MP numbers count up when the page opens
   - clock in the top-right HUD
   - dragons and light drift slightly with the mouse
   - gold particles fall (paused while the tab is hidden)
   ===================================================================== */

(function () {
    'use strict';

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;

    /* ---------------------------------------------------------------
       fullscreen
       --------------------------------------------------------------- */
    function enterFullscreen() {
        if (document.fullscreenElement || !root.requestFullscreen) return;
        try {
            const p = root.requestFullscreen();
            if (p && p.catch) p.catch(function () { /* not allowed yet: fine */ });
        } catch (e) { /* ignore */ }
    }

    function toggleFullscreen() {
        if (document.fullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen();
        } else {
            enterFullscreen();
        }
    }

    enterFullscreen();                                    // works if the browser allows it right away
    window.addEventListener('pointerdown', enterFullscreen, { once: true });
    window.addEventListener('keydown', function (e) {     // first key press (but not F, which toggles)
        if (e.key !== 'f' && e.key !== 'F') enterFullscreen();
    }, { once: true });

    /* ---------------------------------------------------------------
       diamonds: click feedback
       --------------------------------------------------------------- */
    const diamonds = Array.prototype.slice.call(document.querySelectorAll('.diamond-btn'));

    diamonds.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (reduceMotion) return;

            const shape = btn.querySelector('.diamond-shape');
            if (shape) {
                shape.style.transform = 'translate(-50%, -50%) rotate(45deg) scale(0.94)';
                setTimeout(function () { shape.style.transform = ''; }, 150);
            }

            const ring = document.createElement('span');
            ring.className = 'ring-pulse';
            btn.appendChild(ring);
            ring.addEventListener('animationend', function () { ring.remove(); });
            setTimeout(function () { ring.remove(); }, 800);
        });
    });

    /* ---------------------------------------------------------------
       keyboard: arrows pick a diamond, F = fullscreen
       (Enter on a picked diamond is a normal button click, so nav.js opens the page)
       --------------------------------------------------------------- */
    const KEY_TO_PAGE = { ArrowUp: 'projects', ArrowLeft: 'contact', ArrowRight: 'skills', ArrowDown: 'resume' };

    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
            return;
        }

        const page = KEY_TO_PAGE[e.key];
        if (!page) return;

        const target = document.querySelector('.diamond-btn[data-page="' + page + '"]');
        if (target) {
            e.preventDefault();
            target.focus();
        }
    });

    /* ---------------------------------------------------------------
       help line: pointing at a diamond describes it
       --------------------------------------------------------------- */
    const HELP = {
        projects: 'PROJECTS  -  Browse everything I have built.',
        contact:  'CONTACT  -  Send a message or find me online.',
        skills:   'SKILLS  -  See what I can do.',
        resume:   'RESUME  -  Read about my background.'
    };
    const HELP_DEFAULT = 'Select a destination.';
    const helpEl = document.getElementById('helpText');

    function pointAt(page) {
        if (helpEl) helpEl.textContent = page ? (HELP[page] || HELP_DEFAULT) : HELP_DEFAULT;
    }

    diamonds.forEach(function (btn) {
        const page = btn.getAttribute('data-page');
        btn.addEventListener('mouseover', function () { pointAt(page); });
        btn.addEventListener('mouseout', function (e) {
            if (!e.relatedTarget || !btn.contains(e.relatedTarget)) pointAt(document.activeElement && document.activeElement.classList.contains('diamond-btn') ? document.activeElement.getAttribute('data-page') : null);
        });
        btn.addEventListener('focus', function () { pointAt(page); });
        btn.addEventListener('blur', function () { pointAt(null); });
    });

    /* ---------------------------------------------------------------
       HP / MP: the numbers count up while the bars fill
       --------------------------------------------------------------- */
    function countUp(node, ms, delay) {
        if (!node) return;
        const to = parseInt(node.textContent, 10);
        if (!isFinite(to) || reduceMotion) return;

        node.textContent = '0';
        setTimeout(function () {
            const t0 = performance.now();
            (function step(now) {
                const p = Math.min((now - t0) / ms, 1);
                node.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
                if (p < 1) requestAnimationFrame(step);
            })(t0);
        }, delay);
    }

    countUp(document.querySelector('.hp-value'), 1300, 900);
    countUp(document.querySelector('.mp-value'), 1300, 1100);

    /* ---------------------------------------------------------------
       HUD clock
       --------------------------------------------------------------- */
    const clock = document.getElementById('hudTime');

    function tickClock() {
        if (!clock) return;
        const d = new Date();
        const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        clock.textContent = day + '  ' + hh + ':' + mm;
    }

    tickClock();
    setInterval(tickClock, 15000);

    /* ---------------------------------------------------------------
       parallax: light and dragons follow the mouse a little
       --------------------------------------------------------------- */
    if (!reduceMotion) {
        let mouseX = 0, mouseY = 0, currentX = 0, currentY = 0;
        const bgRays = document.querySelector('.bg-rays');

        document.addEventListener('mousemove', function (e) {
            mouseX = (e.clientX - window.innerWidth / 2) * 0.008;
            mouseY = (e.clientY - window.innerHeight / 2) * 0.008;
        });

        (function animateParallax() {
            currentX += (mouseX - currentX) * 0.1;
            currentY += (mouseY - currentY) * 0.1;

            if (bgRays) bgRays.style.transform = 'translate(' + currentX + 'px, ' + currentY + 'px)';
            root.style.setProperty('--px', (currentX * -1.6).toFixed(2) + 'px');   // the dragons move the other way, slowly
            root.style.setProperty('--py', (currentY * -1.6).toFixed(2) + 'px');

            requestAnimationFrame(animateParallax);
        })();
    }

    /* ---------------------------------------------------------------
       gold particles
       --------------------------------------------------------------- */
    function createParticle() {
        if (document.hidden) return;

        const size = Math.random() * 2 + 1;
        const particle = document.createElement('div');
        particle.style.cssText =
            'position:fixed;border-radius:50%;pointer-events:none;z-index:1;top:-10px;' +
            'width:' + size + 'px;height:' + size + 'px;' +
            'left:' + (Math.random() * window.innerWidth) + 'px;' +
            'background:rgba(255,215,0,0.6);box-shadow:0 0 8px rgba(255,215,0,0.8);';
        document.body.appendChild(particle);

        const drift = Math.random() * 60 - 30;
        const anim = particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 0 },
            { transform: 'translate(' + drift + 'px, ' + (window.innerHeight * 0.3) + 'px) scale(1)', opacity: 0.8, offset: 0.3 },
            { transform: 'translate(' + (drift * 1.5) + 'px, ' + (window.innerHeight + 10) + 'px) scale(0)', opacity: 0 }
        ], {
            duration: Math.random() * 4000 + 3000,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });

        anim.onfinish = function () { particle.remove(); };
    }

    if (!reduceMotion) setInterval(createParticle, 600);
})();
