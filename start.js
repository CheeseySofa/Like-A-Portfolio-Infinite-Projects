/* =====================================================================
   start.js - the title screen.
   1. SETTINGS : music file, loop section, timings, next page
   2. MUSIC    : play / fade / loop a section / mute
   3. TIMELINE : logo card -> title drop -> "press any button"
   4. INPUT    : any key, click, tap or gamepad button
   5. LEAVING  : flash, fade to black, go to index.html
   ===================================================================== */

// ---------------------------------------------------------------------
// 1. SETTINGS  (this is the part you edit)
// ---------------------------------------------------------------------
const NEXT_PAGE = 'homepage.html';

const MUSIC = {
    // PLACEHOLDER: replace with your own file, e.g. 'audio/title-theme.mp3'
    src: 'audio/title-theme-placeholder.wav',
    volume: 0.8,       // 0 to 1
    startAt: 0,        // seconds into the file where the music starts / the loop restarts
    loopEnd: null,     // seconds where it jumps back to startAt.
                       //   null  = play the whole file and loop it
                       //   60    = loop only the first minute (like the game's title screen)
    fadeIn: 1500,      // ms
    fadeOut: 900       // ms
};

// milliseconds
const TIMING = {
    logoCard: 2600,    // how long the "YOUR NAME PRESENTS" card lasts
    impactAt: 520,     // after the drop starts: when the kanji hits the screen
    dropToReady: 2900, // after the drop starts: when "PRESS ANY BUTTON" shows up
    leave: 1450        // after pressing: when index.html opens
};

// ---------------------------------------------------------------------
// 2. ELEMENTS + STATE
// ---------------------------------------------------------------------
const screenEl = document.getElementById('screen');
const flashEl = document.getElementById('flash');
const shockEl = document.getElementById('shockwave');
const promptEl = document.getElementById('prompt');
const soundBtn = document.getElementById('soundBtn');
const bgm = document.getElementById('bgm');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let stage = 'logo';          // logo | drop | ready | leaving
let timers = [];
let muted = false;
let musicPlaying = false;
let fadeFrame = 0;

function setStage(name) {
    stage = name;
    document.body.dataset.stage = name;
}

function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
}

// Restart a CSS animation: remove the class, force a reflow, add it back.
function replay(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

// ---------------------------------------------------------------------
// 3. MUSIC
// ---------------------------------------------------------------------
bgm.src = MUSIC.src;
bgm.loop = !MUSIC.loopEnd;         // with a loopEnd we do the looping ourselves (see tick)
bgm.volume = 0;

bgm.addEventListener('loadedmetadata', () => {
    if (MUSIC.startAt) bgm.currentTime = MUSIC.startAt;
});

bgm.addEventListener('error', () => {
    console.warn('start.js: could not load the music file "' + MUSIC.src + '". Check MUSIC.src.');
});

function fadeTo(target, ms) {
    cancelAnimationFrame(fadeFrame);
    const from = bgm.volume;
    const t0 = performance.now();
    (function step(now) {
        const p = Math.min((now - t0) / ms, 1);
        bgm.volume = Math.max(0, Math.min(1, from + (target - from) * p));
        if (p < 1) fadeFrame = requestAnimationFrame(step);
    })(t0);
}

// Browsers only allow sound after the person has pressed something, so this can be refused.
function startMusic(fadeMs = MUSIC.fadeIn) {
    if (musicPlaying) return Promise.resolve(true);
    bgm.muted = muted;
    return bgm.play().then(() => {
        musicPlaying = true;
        fadeTo(MUSIC.volume, fadeMs);
        updateSoundButton();
        return true;
    }).catch(() => false);   // refused (no press yet) or file missing: stay silent
}

function updateSoundButton() {
    const on = musicPlaying && !muted;
    soundBtn.textContent = on ? '\u266A SOUND ON' : '\u266A SOUND OFF';
    soundBtn.setAttribute('aria-pressed', String(on));
}

function toggleSound() {
    if (!musicPlaying) {
        muted = false;
        startMusic();
        return;
    }
    muted = !muted;
    bgm.muted = muted;
    updateSoundButton();
}

// pressing the sound button must not count as "any button"
soundBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
soundBtn.addEventListener('click', toggleSound);

// ---------------------------------------------------------------------
// 4. TIMELINE
// ---------------------------------------------------------------------
// The moment the kanji lands: flash, ring, shake and a burst of sparks.
function impact() {
    replay(flashEl, 'go');
    replay(shockEl, 'go');
    replay(screenEl, 'shake');
    burstSparks(40);
}

function burstSparks(count) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.46;
    for (let i = 0; i < count; i++) {
        const size = Math.random() * 4 + 2;
        const spark = document.createElement('div');
        spark.style.cssText =
            'position:fixed;z-index:26;pointer-events:none;border-radius:50%;' +
            `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;` +
            'background:#FFD700;box-shadow:0 0 10px #FFD700,0 0 18px rgba(255,160,0,.8);';
        document.body.appendChild(spark);

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * Math.min(window.innerWidth, 900) * 0.45 + 80;
        spark.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 60}px) scale(0)`, opacity: 0 }
        ], {
            duration: Math.random() * 700 + 700,
            easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)'
        }).onfinish = () => spark.remove();
    }
}

function runIntro() {
    if (reduceMotion) {
        setStage('ready');
        return;
    }
    setStage('logo');
    later(() => {
        setStage('drop');
        later(impact, TIMING.impactAt);
        later(() => setStage('ready'), TIMING.dropToReady);
    }, TIMING.logoCard);
}

// Pressing during the intro skips straight to "press any button" (like a game).
function skipToReady() {
    timers.forEach(clearTimeout);
    timers = [];
    setStage('ready');
}

// ---------------------------------------------------------------------
// 5. INPUT + LEAVING
// ---------------------------------------------------------------------
function leave() {
    setStage('leaving');
    sessionStorage.setItem('fromStart', '1');      // lets index.html fade in from black

    startMusic(250);                                // if the browser blocked it earlier, this press unlocks it
    later(() => fadeTo(0, MUSIC.fadeOut), 450);

    if (!reduceMotion) {
        flashEl.classList.remove('go');
        replay(flashEl, 'big');
        burstSparks(24);
    }

    later(() => { window.location.href = NEXT_PAGE; }, reduceMotion ? 200 : TIMING.leave);
}

function press() {
    if (stage === 'leaving') return;
    if (stage !== 'ready') {
        skipToReady();
        startMusic();
        return;
    }
    leave();
}

// any key (not modifiers / Tab / M, which toggles the sound)
document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;
    if (document.activeElement === soundBtn && (e.key === 'Enter' || e.key === ' ')) return;   // let the sound button work from the keyboard

    if (e.key.toLowerCase() === 'm') {
        toggleSound();
        return;
    }
    press();
});

// click / tap anywhere
document.addEventListener('pointerdown', press);

// gamepad: any button, detected on its way down
let padWasDown = false;
function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let down = false;
    for (const pad of pads) {
        if (pad && pad.buttons.some((b) => b.pressed)) down = true;
    }
    if (down && !padWasDown) press();
    padWasDown = down;
}

// one small loop: loop-section for the music + gamepad polling
function tick() {
    if (MUSIC.loopEnd && !bgm.paused && bgm.currentTime >= MUSIC.loopEnd) {
        bgm.currentTime = MUSIC.startAt;
    }
    pollGamepad();
    requestAnimationFrame(tick);
}

// coming back with the browser's back button: reset to a fresh start screen
window.addEventListener('pageshow', (e) => {
    if (e.persisted) location.reload();
});

// ---------------------------------------------------------------------
// START
// ---------------------------------------------------------------------
updateSoundButton();
startMusic();          // works if the browser allows it; otherwise the first press starts it
runIntro();
tick();
