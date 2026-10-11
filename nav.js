/* =====================================================================
   nav.js - makes the diamond buttons on the home page open their pages.
   Each button has data-page="about" / "projects" / ... in index.html,
   and the page it opens is <data-page>.html  (about -> about.html).
   ===================================================================== */

// Pages that actually exist. Add 'projects', 'skills', 'contact' here
// as you build them. Buttons for pages not in this list just shake.
const PAGES_READY = ['about',"projects"];

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Coming from the start screen? Fade in from black so the hand-off is smooth.
if (sessionStorage.getItem('fromStart')) {
    sessionStorage.removeItem('fromStart');
    if (!reduceMotion) {
        document.body.style.opacity = '0';
        requestAnimationFrame(() => {
            document.body.style.transition = 'opacity 0.9s ease';
            document.body.style.opacity = '1';
        });
    }
}

// Fade the page out, then go to the new page.
function goTo(url) {
    document.body.style.transition = 'opacity 0.35s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = url; }, reduceMotion ? 0 : 350);
}

// If you come back with the browser's back button, make the page visible again.
window.addEventListener('pageshow', () => { document.body.style.opacity = '1'; });

document.querySelectorAll('.diamond-btn').forEach((button) => {
    button.addEventListener('click', () => {
        const page = button.dataset.page;

        if (PAGES_READY.includes(page)) {
            goTo(`${page}.html`);
        } else if (!reduceMotion) {
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
    });
});
