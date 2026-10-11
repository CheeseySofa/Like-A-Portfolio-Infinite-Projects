/* =====================================================================
   fx.js - small effects shared by start.js and nav.js
   ===================================================================== */

// Restart a CSS animation: remove the class, force a reflow, add it back.
function replay(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

// One glowing gold spark that flies by (dx, dy) and fades out.
function flySpark(x, y, dx, dy, size, duration) {
    const spark = document.createElement('div');
    spark.style.cssText =
        'position:fixed;z-index:100001;pointer-events:none;border-radius:50%;' +
        `left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
        'background:#FFD700;box-shadow:0 0 10px #FFD700,0 0 18px rgba(255,160,0,.8);';
    document.body.appendChild(spark);
    spark.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
    ], { duration: duration, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' }).onfinish = () => spark.remove();
}

// Sparks exploding outwards from one point (default: where the title lands).
function burstSparks(count, cx = window.innerWidth / 2, cy = window.innerHeight * 0.46) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * Math.min(window.innerWidth, 900) * 0.45 + 80;
        flySpark(cx, cy, Math.cos(angle) * dist, Math.sin(angle) * dist + 60,
                 Math.random() * 4 + 2, Math.random() * 700 + 700);
    }
}

// Sparks thrown off the diagonal seam of the wipe (bottom-left to top-right).
function burstAlongSeam(count) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (let i = 0; i < count; i++) {
        const t = Math.random();
        const side = Math.random() < 0.5 ? -1 : 1;           // away from the seam, to either side
        const push = Math.random() * 220 + 60;
        flySpark(t * w, h - t * h, side * push, side * push,
                 Math.random() * 4 + 2, Math.random() * 600 + 700);
    }
}
