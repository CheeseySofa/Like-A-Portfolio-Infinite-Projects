/* =====================================================================
   money-rain.js  -  yen notes and gold coins drifting down the background

   Needs one element on the page:   <canvas id="moneyRain" class="money-rain"></canvas>
   (projects.css already styles it: fixed, full screen, behind the page, click-through)

   Tweak the look in SETTINGS. Nothing is drawn when the visitor has
   "reduce motion" switched on in their system.
   ===================================================================== */
(function () {
    'use strict';

    /* ---------------------------------------------------------------
       SETTINGS
       --------------------------------------------------------------- */
    const SETTINGS = {
        DENSITY: 8 / 36000,      // pieces per pixel of screen area (a 1600x900 screen gets ~40)
        MAX: 60,                 // never more than this many pieces
        COIN_SHARE: 0.45,        // share of coins; the rest are notes
        SPEED: [80, 200],        // fall speed in px/second (smallest / biggest piece)
        SIZE: [0.14, 0.28],     // size range: notes come out ~21-42px wide, coins ~10-20px
        ALPHA: [0.4, 0.92]       // far pieces are fainter than near ones
    };

    const canvas = document.getElementById('moneyRain');
    if (!canvas || !canvas.getContext) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;

    /* ---------- sprites, drawn once: yen notes (10000 / 5000 / 1000) and coins (500 / 100 / 10) ---------- */
    // Generic yen-style notes in the real denominations' colours (brown, purple, blue) - not copies of real notes.
    const NOTES = [
        { amount: '10000', a: '#d9c9a0', b: '#bda775', edge: '#6b4f22', ink: '#4a3412' },
        { amount: '5000',  a: '#cdbfd6', b: '#a995b9', edge: '#5a3f78', ink: '#3b2652' },
        { amount: '1000',  a: '#c4d3de', b: '#9db4c6', edge: '#35566f', ink: '#1f3a4f' }
    ];

    function makeNote(d) {
        const w = 150, h = 72, c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        const bg = g.createLinearGradient(0, 0, w, h);
        bg.addColorStop(0, d.a); bg.addColorStop(1, d.b);
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.strokeStyle = d.edge; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
        g.globalAlpha = 0.55; g.lineWidth = 1; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha = 1;
        // portrait oval + faint rings
        g.strokeStyle = d.edge; g.globalAlpha = 0.22;
        for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(w * 0.28, h / 2, 10 + i * 7, 8 + i * 4, 0, 0, Math.PI * 2); g.stroke(); }
        g.globalAlpha = 0.3; g.fillStyle = d.edge; g.beginPath(); g.ellipse(w * 0.28, h / 2, 16, 21, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        // big yen sign + amount
        g.fillStyle = d.ink; g.textBaseline = 'middle';
        g.textAlign = 'left';  g.font = 'bold 40px Georgia, serif'; g.fillText('¥', w * 0.5, h * 0.38);
        g.textAlign = 'right'; g.font = 'bold 30px Georgia, serif'; g.fillText(d.amount, w - 12, h * 0.72);
        g.textAlign = 'left';  g.font = 'bold 12px Georgia, serif'; g.fillText('¥' + d.amount, 14, 17);
        return c;
    }

    // 500 = brass, 100 = silver, 10 = copper
    const COINS = [
        { amount: '500', hi: '#fff0a6', mid: '#d9ae3a', lo: '#8f6a14', ink: '#5a3f08' },
        { amount: '100', hi: '#ffffff', mid: '#c9d0d8', lo: '#7f8994', ink: '#4a525c' },
        { amount: '10',  hi: '#ffd2a0', mid: '#c67a45', lo: '#7a4020', ink: '#4e2810' }
    ];

    function makeCoin(d) {
        const s = 80, c = document.createElement('canvas');
        c.width = s; c.height = s;
        const g = c.getContext('2d');
        const rim = g.createLinearGradient(0, 0, s, s);
        rim.addColorStop(0, d.hi); rim.addColorStop(0.5, d.mid); rim.addColorStop(1, d.lo);
        g.fillStyle = rim; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2); g.fill();
        const face = g.createRadialGradient(s * 0.38, s * 0.34, 4, s / 2, s / 2, s / 2);
        face.addColorStop(0, d.hi); face.addColorStop(0.7, d.mid); face.addColorStop(1, d.lo);
        g.fillStyle = face; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2); g.fill();
        g.strokeStyle = d.ink; g.globalAlpha = 0.6; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1;
        g.fillStyle = d.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold ' + (d.amount.length > 2 ? 26 : 32) + 'px Georgia, serif'; g.fillText(d.amount, s / 2, s / 2 + 3);
        g.font = 'bold 13px Georgia, serif'; g.fillText('¥', s / 2, s * 0.26);
        return c;
    }

    const NOTE_SPRITES = NOTES.map(makeNote), COIN_SPRITES = COINS.map(makeCoin);

    /* ---------- the falling pieces ---------- */
    const rand = (a, b) => a + Math.random() * (b - a);
    let pieces = [];

    function spawn(p, anywhere) {
        const coin = Math.random() < SETTINGS.COIN_SHARE;
        const depth = Math.random();                       // 0 = far, 1 = near
        const size = SETTINGS.SIZE[0] + depth * (SETTINGS.SIZE[1] - SETTINGS.SIZE[0]);
        p.coin = coin;
        p.sprite = coin ? COIN_SPRITES[Math.floor(Math.random() * COIN_SPRITES.length)] : NOTE_SPRITES[Math.floor(Math.random() * NOTE_SPRITES.length)];
        p.size = size;
        p.x = rand(-40, W + 40);
        p.y = anywhere ? rand(-100, H) : rand(-160, -40);
        p.vy = SETTINGS.SPEED[0] + depth * (SETTINGS.SPEED[1] - SETTINGS.SPEED[0]);
        p.sway = rand(10, 38);                              // side-to-side drift
        p.swaySpeed = rand(0.5, 1.4);
        p.phase = rand(0, Math.PI * 2);
        p.rot = rand(0, Math.PI * 2);
        p.spin = rand(-0.9, 0.9);
        p.flip = rand(0, Math.PI * 2);                      // 3D flutter
        p.flipSpeed = rand(1.2, 3.2);
        p.alpha = SETTINGS.ALPHA[0] + depth * (SETTINGS.ALPHA[1] - SETTINGS.ALPHA[0]);
        return p;
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        const want = Math.min(SETTINGS.MAX, Math.max(8, Math.round(W * H * SETTINGS.DENSITY)));
        while (pieces.length < want) pieces.push(spawn({}, true));
        pieces.length = want;
    }

    let last = performance.now();
    function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        for (const p of pieces) {
            p.y += p.vy * dt;
            p.phase += p.swaySpeed * dt;
            p.rot += p.spin * dt * 0.5;
            p.flip += p.flipSpeed * dt;
            if (p.y > H + 120) spawn(p, false);

            const x = p.x + Math.sin(p.phase) * p.sway;
            const sprite = p.sprite;
            const w = p.coin ? 70 * p.size : 150 * p.size;
            const h = w * (sprite.height / sprite.width);
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(x, p.y);
            ctx.rotate(p.coin ? 0 : Math.sin(p.rot) * 0.9);
            ctx.scale(1, Math.max(0.12, Math.abs(Math.cos(p.flip))));   // tumbling
            ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
            ctx.restore();
        }
        requestAnimationFrame(frame);
    }

    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
})();
