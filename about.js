/* =====================================================================
   about.js - everything that makes the About page interactive.
   1. DATA      : edit the ROLES object to change what each role shows
   2. HELPERS   : small utilities
   3. SELECTING : what happens when a role is picked
   4. CONTROLS  : mouse, keyboard, arrow buttons, back button
   5. MOTION    : count-up numbers and mouse parallax
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. DATA
// ---------------------------------------------------------------------
const MAX_SEGMENTS = 5;                              // every stat is out of 5
const PLACEHOLDER_IMAGE = 'placeholder-character.jpg';

// Each role has:
//   label  - name shown in the status panel
//   title  - heading of the blue box
//   image  - this role's picture. Leave '' to use the placeholder.
//            When you have art, put the path here, e.g. 'images/developer.png'
//   desc   - the little description in the blue box
//   stats  - [name, value out of 5]. Keep the same names + order in every role
//            so you can compare them. A 5 gets highlighted as the "defining" stat.
//   status - rows for the right-hand panel. A number counts up; text just appears.
//
// NOTE: the stat values and the non-developer status rows are placeholders -
// change them to whatever is true for you.
const ROLES = {
    developer: {
        label: 'Developer',
        title: 'Self-Taught Builder',
        image: '',
        desc: 'All brain. Tinkering with microcontrollers since age 12, building games and gadgets, and working the logic out from scratch.',
        stats: [['Brain', 5], ['Strength', 1], ['Stamina', 3], ['Focus', 5], ['Rhythm', 2], ['Speed', 3]],
        status: [['Level', 19], ['Started at', 'Age 12'], ['Awards', 'Science (multiple)'], ['Weapons', 'Python / C# / ESP32']]
    },
    drummer: {
        label: 'Drummer',
        title: 'Rhythm Keeper',
        image: '',
        desc: 'All rhythm. Loves jamming to favourite songs and can identify beats on the go!',
        stats: [['Brain', 3], ['Strength', 3], ['Stamina', 4], ['Focus', 4], ['Rhythm', 5], ['Speed', 4]],
        status: [['Level', 19], ['Class', 'Percussionist'], ['Weapon', 'Drum sticks'], ['Special', 'Tight fills']]
    },
    lifter: {
        label: 'Lifter',
        title: 'Gym Regular',
        image: '',
        desc: 'All strength. Trains with discipline and fun in the gym, loves going for more weights!',
        stats: [['Brain', 2], ['Strength', 5], ['Stamina', 4], ['Focus', 4], ['Rhythm', 2], ['Speed', 2]],
        status: [['Level', 19], ['Class', 'Gym regular'], ['Weapon', 'Barbell'], ['Special', 'Progressive overload']]
    },
    hotwheels: {
        label: 'Hot Wheels',
        title: 'Car Collector / Car Lover',
        image: '',
        desc: 'All speed. Hunts down die-cast cars, loves the details, and knows what makes a good one fast.',
        stats: [['Brain', 3], ['Strength', 1], ['Stamina', 2], ['Focus', 4], ['Rhythm', 1], ['Speed', 5]],
        status: [['Level', 19], ['Class', 'Collector'], ['Weapon', 'Die-cast cars'], ['Special', 'Track builder']]
    }
};

// ---------------------------------------------------------------------
// 2. ELEMENTS + HELPERS
// ---------------------------------------------------------------------
const stage = document.getElementById('stage');
const heroSwap = document.getElementById('heroSwap');
const heroImg = document.getElementById('heroImg');
const nameThumb = document.getElementById('nameThumb');
const flash = document.getElementById('flash');
const infoPanel = document.getElementById('infoPanel');
const infoTitle = document.getElementById('infoTitle');
const infoStats = document.getElementById('infoStats');
const infoDesc = document.getElementById('infoDesc');
const statusList = document.getElementById('statusList');
const statusClass = document.getElementById('statusClass');
const keyUp = document.getElementById('keyUp');
const keyDown = document.getElementById('keyDown');
const backBtn = document.getElementById('backBtn');

const rows = Array.from(document.querySelectorAll('.role-row:not(.locked)'));
const lockedRows = document.querySelectorAll('.role-row.locked');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Restart a CSS animation: remove the class, force a reflow, add it back.
function replay(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

// Fade the page out, then go to another page.
function goTo(url) {
    document.body.style.transition = 'opacity 0.35s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { window.location.href = url; }, reduceMotion ? 0 : 350);
}

// If you come back with the browser's back button, make sure the page is visible again.
window.addEventListener('pageshow', () => { document.body.style.opacity = '1'; });

// Count a number up from 0 (used for "Level").
function countUp(el, target, duration = 700) {
    if (reduceMotion) { el.textContent = target; return; }
    const start = performance.now();
    function step(now) {
        const p = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));   // ease-out
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ---------------------------------------------------------------------
// 3. SELECTING A ROLE
// ---------------------------------------------------------------------
let current = 0;
let imageToken = 0;   // so a slow image can't overwrite a newer pick

function renderStats(role) {
    infoStats.replaceChildren();
    role.stats.forEach(([name, value], s) => {
        const stat = document.createElement('div');
        stat.className = 'stat' + (value === MAX_SEGMENTS ? ' max' : '');

        const label = document.createElement('span');
        label.className = 'stat-name';
        label.textContent = name;

        const bar = document.createElement('span');
        bar.className = 'stat-bar';
        for (let i = 0; i < MAX_SEGMENTS; i++) {
            const seg = document.createElement('i');
            seg.className = 'seg' + (i < value ? ' on' : '');
            seg.style.setProperty('--d', `${(s * MAX_SEGMENTS + i) * 25}ms`);   // segments fill in one by one
            bar.appendChild(seg);
        }

        stat.append(label, bar);
        infoStats.appendChild(stat);
    });
}

function renderStatus(role) {
    statusClass.textContent = role.label;
    statusList.replaceChildren();
    role.status.forEach(([name, value], i) => {
        const li = document.createElement('li');
        li.style.setProperty('--i', i);

        const label = document.createElement('span');
        label.className = 's-label';
        label.textContent = name;

        const val = document.createElement('span');
        val.className = 's-value';
        if (typeof value === 'number') {
            countUp(val, value);
        } else {
            val.classList.add('s-small');
            val.textContent = value;
        }

        li.append(label, val);
        statusList.appendChild(li);
    });
}

// Show this role's image. If it has none (or the file is missing), use the placeholder.
function showImage(role) {
    const token = ++imageToken;

    function apply(src, isPlaceholder) {
        if (token !== imageToken) return;
        heroImg.src = src;
        nameThumb.src = src;
        heroImg.alt = role.label;
        heroImg.classList.toggle('is-placeholder', isPlaceholder);
    }

    if (!role.image) {
        apply(PLACEHOLDER_IMAGE, true);
        return;
    }
    const test = new Image();
    test.onload = () => apply(role.image, false);
    test.onerror = () => apply(PLACEHOLDER_IMAGE, true);
    test.src = role.image;
}

function selectRole(index, animate = true) {
    current = index;
    const key = rows[index].dataset.role;
    const role = ROLES[key];

    // highlight the row
    rows.forEach((row, i) => {
        const on = i === index;
        row.classList.toggle('selected', on);
        row.setAttribute('aria-selected', String(on));
    });

    // the page reads data-role to change the aura colour
    stage.dataset.role = key;

    // blue box
    infoTitle.textContent = role.title;
    infoDesc.textContent = role.desc;
    renderStats(role);

    // right panel + picture
    renderStatus(role);
    showImage(role);

    if (animate) {
        replay(heroSwap, 'punch');
        replay(flash, 'go');
        replay(infoPanel, 'ping');
    }
}

// move up (-1) or down (+1), wrapping around at the ends
function stepRole(direction) {
    selectRole((current + direction + rows.length) % rows.length);
}

// ---------------------------------------------------------------------
// 4. CONTROLS
// ---------------------------------------------------------------------
// click / Enter / Space on a role row
rows.forEach((row, i) => {
    row.addEventListener('click', () => { if (i !== current) selectRole(i); });
    row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (i !== current) selectRole(i);
        }
    });
});

// locked rows just shake
lockedRows.forEach((row) => {
    row.addEventListener('click', () => replay(row, 'shake'));
});

// the on-screen arrow buttons
keyUp.addEventListener('click', () => stepRole(-1));
keyDown.addEventListener('click', () => stepRole(1));

// back button (the link also works without JS)
function goBack() { goTo('homepage.html'); }
backBtn.addEventListener('click', (e) => {
    e.preventDefault();
    goBack();
});

// flash a key button when its keyboard key is pressed
function pressed(el) {
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 130);
}

// keyboard: Up/W = previous, Down/S = next, Q/Esc = back
document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();

    if (k === 'arrowup' || k === 'w') {
        e.preventDefault();
        stepRole(-1);
        pressed(keyUp);
    } else if (k === 'arrowdown' || k === 's') {
        e.preventDefault();
        stepRole(1);
        pressed(keyDown);
    } else if (k === 'q' || k === 'escape') {
        pressed(backBtn);
        goBack();
    }
});

// ---------------------------------------------------------------------
// 5. MOTION: mouse parallax
// ---------------------------------------------------------------------
// --px / --py (-0.5 .. 0.5) are CSS variables on the stage. about.css uses them
// to nudge the character, glow, dots and slash by different amounts.
let targetX = 0, targetY = 0, currentX = 0, currentY = 0;

if (!reduceMotion) {
    document.addEventListener('mousemove', (e) => {
        targetX = e.clientX / window.innerWidth - 0.5;
        targetY = e.clientY / window.innerHeight - 0.5;
    });
    document.addEventListener('mouseleave', () => { targetX = 0; targetY = 0; });

    (function parallax() {
        currentX += (targetX - currentX) * 0.08;   // ease toward the mouse
        currentY += (targetY - currentY) * 0.08;
        stage.style.setProperty('--px', currentX.toFixed(4));
        stage.style.setProperty('--py', currentY.toFixed(4));
        requestAnimationFrame(parallax);
    })();
}

// ---------------------------------------------------------------------
// START: show the first role (no punch animation on load)
// ---------------------------------------------------------------------
selectRole(0, false);
