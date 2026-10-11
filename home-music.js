/* =====================================================================
   home-music.js - carries the title-screen music onto the home page.
   Only runs when you arrive from the start screen (it left a saved
   position in sessionStorage). Settings: music-config.js
   ===================================================================== */
(function () {
    if (typeof MUSIC === 'undefined' || !MUSIC.continueOnHome) return;

    const saved = sessionStorage.getItem('bgmTime');
    if (saved === null) return;
    sessionStorage.removeItem('bgmTime');

    let muted = sessionStorage.getItem('bgmMuted') === '1';
    sessionStorage.removeItem('bgmMuted');

    const audio = new Audio(MUSIC.src);
    audio.preload = 'auto';
    audio.loop = true;          // here the whole file plays on, so you hear the rest of the song
    audio.volume = 0;
    audio.muted = muted;

    audio.addEventListener('loadedmetadata', () => {
        const t = parseFloat(saved) || 0;
        audio.currentTime = isFinite(audio.duration) && audio.duration > 0 ? t % audio.duration : t;
    });
    audio.addEventListener('error', () => {
        console.warn('home-music.js: could not load "' + MUSIC.src + '". Check MUSIC.src in music-config.js.');
    });

    let playing = false;
    let fadeFrame = 0;

    function fadeTo(target, ms) {
        cancelAnimationFrame(fadeFrame);
        const from = audio.volume;
        const t0 = performance.now();
        (function step(now) {
            const p = Math.min((now - t0) / ms, 1);
            audio.volume = Math.max(0, Math.min(1, from + (target - from) * p));
            if (p < 1) fadeFrame = requestAnimationFrame(step);
        })(t0);
    }

    // small toggle in the top-right corner
    const button = document.createElement('button');
    button.className = 'sound-toggle';
    button.type = 'button';
    document.body.appendChild(button);

    function updateButton() {
        const on = playing && !muted;
        button.textContent = on ? '\u266A SOUND ON' : '\u266A SOUND OFF';
        button.setAttribute('aria-pressed', String(on));
    }

    // resolves true if it is playing afterwards
    function start() {
        if (playing) return Promise.resolve(true);
        return audio.play().then(() => {
            playing = true;
            fadeTo(MUSIC.volume, 1600);
            updateButton();
            return true;
        }).catch(() => false);
    }

    function toggle() {
        if (!playing) {
            muted = false;
            audio.muted = false;
            start();
            return;
        }
        muted = !muted;
        audio.muted = muted;
        updateButton();
    }

    button.addEventListener('click', toggle);
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) toggle();
    });

    // the browser may still want a press before it allows sound: start on the first one
    function startOnFirstPress() {
        const go = () => {
            document.removeEventListener('pointerdown', go);
            document.removeEventListener('keydown', go);
            start();
        };
        document.addEventListener('pointerdown', go);
        document.addEventListener('keydown', go);
    }

    updateButton();
    setTimeout(() => {
        start().then((ok) => { if (!ok) startOnFirstPress(); });
    }, 350);

    // nav.js calls this when you leave for another page
    window.HomeMusic = {
        audio: audio,
        fadeOut: (ms) => fadeTo(0, ms)
    };
})();
