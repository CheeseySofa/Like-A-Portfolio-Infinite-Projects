/* =====================================================================
   projects.js  -  the Projects page logic
   Works with: projects.html + projects.css (+ style.css for the shared look)

   What it does
   1. Loads a GitHub profile and its public repositories (GitHub REST API).
   2. Puts every repository on the skill-tree wheel as a gem
      (newest push = inner ring, colour = main language).
   3. Reads every repository's README.md in the background.
      - the first real picture in a README becomes the preview image
        (badges / shields are skipped)
      - the first real paragraph becomes the short excerpt
   4. Click / arrow keys select a gem -> the right-hand panel shows
      image, name, description, language, last push and star count.
   5. "Details" shows the whole README inside the panel.

   Controls
   Left / Right  previous / next gem      Up / Down  inner / outer ring
   Enter         open on GitHub           D          Details (README)
   Esc / Q       back to the home page

   >>> To change the profile, edit CONFIG below. <<<
   ===================================================================== */

(function () {
    'use strict';

    /* ---------------------------------------------------------------
       SETTINGS
       --------------------------------------------------------------- */
    const CONFIG = {
        USER: 'Cheeseysofa',
       // <<< put the GitHub username here, e.g. 'octocat'. Empty = page shows nothing.
        HUB_IMAGE: '',            // picture in the middle of the wheel, e.g. 'images/me.png'.
                                  // Leave '' to use the GitHub avatar for now.
        MAX_REPOS: 36,            // the wheel has room for 6 + 12 + 18 gems
        INCLUDE_FORKS: false,     // show forked repositories too?
        SORT: 'pushed',           // 'pushed' = most recently updated first, 'stars' = most starred first
        CACHE_MINUTES: 30,        // repo list is cached so refreshing does not burn the API limit
        SFX: true,                // tiny UI blips when you move around (starts after your first key/click)
        README_WORKERS: 4,        // how many READMEs are fetched at the same time
        TOKEN: ''                 // optional GitHub token (only raises the 60 requests/hour limit).
                                  // Never put a token with write access in a public site!
    };

    // ring layout of the wheel (viewBox is 600 x 600, centre 300,300)
    const RINGS = [
        { r: 104, cap: 6,  size: 16 },   // inner ring
        { r: 182, cap: 12, size: 14 },
        { r: 244, cap: 18, size: 12 }    // outer ring
    ];
    const CX = 300, CY = 300;

    const LANG_COLORS = {
        'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572a5', 'HTML': '#e34c26',
        'CSS': '#7a5bc4', 'SCSS': '#c6538c', 'Java': '#b07219', 'C': '#8a8a8a', 'C++': '#f34b7d',
        'C#': '#2fa02a', 'Go': '#00add8', 'Rust': '#dea584', 'Ruby': '#cc342d', 'PHP': '#7a86b8',
        'Shell': '#89e051', 'Kotlin': '#a97bff', 'Swift': '#f05138', 'Dart': '#00b4ab',
        'Vue': '#41b883', 'Jupyter Notebook': '#da5b0b', 'Lua': '#3a3a9c', 'Dockerfile': '#4a7a99',
        'Makefile': '#6c9a3c', 'Svelte': '#ff3e00', 'Astro': '#ff5d01', 'R': '#198ce7',
        'Scala': '#dc322f', 'Haskell': '#7d6a9e', 'Elixir': '#6e4a7e', 'Batchfile': '#8ec04a'
    };
    const NO_LANG_COLOR = '#6f8aab';

    /* ===============================================================
       PURE HELPERS  (no page access - these can be tested in Node)
       =============================================================== */

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function hashColor(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        return 'hsl(' + (h % 360) + ' 55% 55%)';
    }

    function langColor(lang) {
        if (!lang) return NO_LANG_COLOR;
        return LANG_COLORS[lang] || hashColor(lang);
    }

    // is a colour light? (decides dark or white letter on a gem)
    function isLight(color) {
        let r, g, b, m;
        if ((m = /^#([0-9a-f]{6})$/i.exec(color))) {
            r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16);
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
        }
        return false;
    }

    function langShort(lang) {
        if (!lang) return '?';
        const map = { 'JavaScript': 'JS', 'TypeScript': 'TS', 'Python': 'PY', 'Jupyter Notebook': 'NB', 'Dockerfile': 'DK', 'Shell': 'SH' };
        return map[lang] || (lang.length <= 3 ? lang : lang.slice(0, 2).toUpperCase());
    }

    function timeAgo(iso) {
        if (!iso) return 'unknown';
        const s = (Date.now() - new Date(iso).getTime()) / 1000;
        if (!isFinite(s)) return 'unknown';
        if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
        if (s < 86400) return Math.round(s / 3600) + ' h ago';
        const d = s / 86400;
        if (d < 30) return Math.round(d) + (Math.round(d) === 1 ? ' day ago' : ' days ago');
        if (d < 365) { const m = Math.round(d / 30); return m + (m === 1 ? ' month ago' : ' months ago'); }
        const y = Math.round(d / 365 * 10) / 10;
        return y + (y === 1 ? ' year ago' : ' years ago');
    }

    // 0-100: how recently the repo was pushed to (100 = this week, ~8 = two years or older)
    function activityPct(iso) {
        const d = (Date.now() - new Date(iso).getTime()) / 86400000;
        if (!isFinite(d)) return 8;
        if (d <= 7) return 100;
        return Math.max(8, Math.min(100, Math.round(100 * (1 - d / 730))));
    }

    function angDiff(a, b) {
        return Math.abs(((a - b + 540) % 360) - 180);
    }

    /* ---------- URL handling for README content ---------- */

    // ctx = { user, repo, branch }
    function resolveUrl(url, ctx, kind) {
        url = String(url || '').trim().replace(/^<|>$/g, '');
        if (!url) return null;
        if (/^(javascript|data|vbscript|file):/i.test(url)) return null;
        if (/^mailto:/i.test(url)) return kind === 'link' ? url : null;
        if (/^https?:\/\//i.test(url)) {
            if (kind === 'image') {
                // github.com/o/r/blob/branch/path.png  ->  raw file
                const m = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+?)(?:\?.*)?$/i.exec(url);
                if (m) return 'https://raw.githubusercontent.com/' + m[1] + '/' + m[2] + '/' + m[3];
            }
            return url;
        }
        if (url.indexOf('//') === 0) return 'https:' + url;
        if (url.charAt(0) === '#') return null;                       // in-page anchors do not work here
        if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null;            // any other scheme
        // relative path inside the repository
        const path = url.replace(/^\.\//, '').replace(/^\//, '').split('?')[0];
        if (!ctx || !ctx.user || !ctx.repo) return null;
        const branch = ctx.branch || 'main';
        if (kind === 'image') {
            return 'https://raw.githubusercontent.com/' + ctx.user + '/' + ctx.repo + '/' + branch + '/' + path;
        }
        return 'https://github.com/' + ctx.user + '/' + ctx.repo + '/blob/' + branch + '/' + path;
    }

    // badges, shields, stats cards, banners: never useful as a preview picture
    const BADGE_RE = new RegExp([
        'shields\\.io', 'badgen\\.net', 'badge', 'travis-ci', 'codecov', 'coveralls', 'circleci',
        'github\\.com/[^/]+/[^/]+/(?:actions|workflows)', 'codacy', 'snyk\\.io', 'sonarcloud',
        'vercel\\.com/button', 'netlify\\.com/api', 'buymeacoffee', 'ko-fi', 'komarev', 'seeyoufarm',
        'forthebadge', 'capsule-render', 'readme-typing-svg', 'github-readme-stats', 'streak-stats',
        'skillicons', 'profile-views', 'trophy', 'wakatime', 'opencollective\\.com/[^/]+/(?:backers|sponsors)'
    ].join('|'), 'i');

    function isBadge(url, alt) {
        return BADGE_RE.test(url) || /\b(badge|build status|coverage|license)\b/i.test(alt || '');
    }

    function stripFences(md) {
        return String(md || '').replace(/\r\n?/g, '\n')
            .replace(/<!--[\s\S]*?-->/g, '')
            .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '');
    }

    // first real picture in a README (markdown image or <img>)
    function findImage(md, ctx) {
        const text = stripFences(md);
        const re = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)|<img\b[^>]*?>/gi;
        let m;
        while ((m = re.exec(text))) {
            let alt = '', src = '';
            if (m[2]) {
                alt = m[1]; src = m[2];
            } else {
                const s = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(m[0]);
                const a = /\balt\s*=\s*["']([^"']*)["']/i.exec(m[0]);
                if (!s) continue;
                src = s[1]; alt = a ? a[1] : '';
            }
            const url = resolveUrl(src, ctx, 'image');
            if (!url || isBadge(url, alt)) continue;
            if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) continue;
            return url;
        }
        return '';
    }

    // first real sentence/paragraph in a README
    function findExcerpt(md, skipText) {
        let text = stripFences(md);
        text = text.replace(/<img\b[^>]*>/gi, '').replace(/<\/?[a-zA-Z][^>]*>/g, '');
        const skip = String(skipText || '').trim().toLowerCase();
        const blocks = text.split(/\n\s*\n/);
        for (let raw of blocks) {
            raw = raw.trim();
            if (!raw) continue;
            if (/^(#|\||>|[-*+]\s|\d+\.\s|---|===|\*\*\*|___)/.test(raw)) continue;
            let t = raw
                .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // images
                .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')         // links -> text
                .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
                .replace(/https?:\/\/\S+/g, '')
                .replace(/[*_`~]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            if (t.length < 25 || !/[a-z]{3}/i.test(t)) continue;
            if (/^table of contents/i.test(t)) continue;
            if (skip && (t.toLowerCase() === skip || skip.indexOf(t.toLowerCase().slice(0, 40)) === 0)) continue;
            return t.length > 260 ? t.slice(0, 257).replace(/\s+\S*$/, '') + '\u2026' : t;
        }
        return '';
    }

    /* ---------- small Markdown -> HTML renderer (for the Details view) ---------- */

    function mdToHtml(md, ctx) {
        const stash = [];
        const keep = (html) => '\u0000' + (stash.push(html) - 1) + '\u0000';
        const unstash = (s) => {
            let guard = 0;
            while (/\u0000\d+\u0000/.test(s) && guard++ < 10) {
                s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
            }
            return s;
        };

        let text = String(md || '').replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');

        // fenced code blocks
        text = text.replace(/^(```|~~~)[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm, (m, f, code) =>
            '\n\n' + keep('<pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre>') + '\n\n');
        // inline code
        text = text.replace(/`([^`\n]+)`/g, (m, c) => keep('<code>' + esc(c) + '</code>'));

        // raw HTML we understand
        const imgTag = (url, alt) => {
            const u = resolveUrl(url, ctx, 'image');
            if (!u) return '';
            return keep('<img src="' + esc(u) + '" alt="' + esc(alt || '') + '" loading="lazy" referrerpolicy="no-referrer">');
        };
        text = text.replace(/<img\b[^>]*>/gi, (tag) => {
            const s = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag);
            const a = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag);
            return s ? imgTag(s[1], a ? a[1] : '') : '';
        });
        text = text.replace(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi, (tag, href) => {
            const u = resolveUrl(href, ctx, 'link');
            return u ? keep('<a href="' + esc(u) + '" target="_blank" rel="noopener">') : keep('<a>');
        });
        text = text.replace(/<\/a>/gi, () => keep('</a>'));
        text = text.replace(/<br\s*\/?>/gi, () => keep('<br>'));
        text = text.replace(/<(https?:\/\/[^>\s]+)>/g, (m, u) => keep('<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>'));
        text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');       // drop every other tag (div, p, details, ...)

        function inline(s) {
            s = esc(s);
            // images
            s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\s*\)/g,
                (m, alt, url) => imgTag(url.replace(/&amp;/g, '&'), alt));
            // links
            s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\s*\)/g, (m, label, url) => {
                const u = resolveUrl(url.replace(/&amp;/g, '&'), ctx, 'link');
                return u ? keep('<a href="' + esc(u) + '" target="_blank" rel="noopener">') + label + keep('</a>') : label;
            });
            // emphasis
            s = s.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (m, a, b) => '<strong>' + (a || b) + '</strong>');
            s = s.replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
            s = s.replace(/(^|[\s(])_([^_\s][^_\n]*?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
            s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
            // bare links
            s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => {
                const tail = /[.,;:!?]+$/.exec(url);
                const clean = tail ? url.slice(0, -tail[0].length) : url;
                return pre + keep('<a href="' + clean + '" target="_blank" rel="noopener">' + clean + '</a>') + (tail ? tail[0] : '');
            });
            // line breaks
            s = s.replace(/(?: {2,}|\\)\n/g, () => keep('<br>')).replace(/\n/g, ' ');
            return s;
        }

        const lines = text.split('\n');
        const out = [];
        let para = [];
        const flush = () => { if (para.length) { out.push('<p>' + inline(para.join('\n')) + '</p>'); para = []; } };
        const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || '');
        const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (/^\s*$/.test(line)) { flush(); continue; }

            // a stashed block (code fence)
            const only = /^\u0000(\d+)\u0000$/.exec(line.trim());
            if (only && stash[+only[1]].indexOf('<pre') === 0) { flush(); out.push(line.trim()); continue; }

            // headings
            let m = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
            if (m) {
                flush();
                const lvl = Math.min(6, Math.max(3, m[1].length + 2)) ;     // h1->h3, h2->h4 ...
                out.push('<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>');
                continue;
            }

            // horizontal rule
            if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }

            // table
            if (line.indexOf('|') !== -1 && isTableSep(lines[i + 1])) {
                flush();
                const head = cells(line);
                let html = '<table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
                i += 2;
                while (i < lines.length && lines[i].indexOf('|') !== -1 && !/^\s*$/.test(lines[i])) {
                    html += '<tr>' + cells(lines[i]).map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>';
                    i++;
                }
                i--;
                out.push(html + '</tbody></table>');
                continue;
            }

            // blockquote
            if (/^\s{0,3}>/.test(line)) {
                flush();
                const q = [];
                while (i < lines.length && /^\s{0,3}>/.test(lines[i])) { q.push(lines[i].replace(/^\s{0,3}>\s?/, '')); i++; }
                i--;
                out.push('<blockquote>' + inline(q.join('\n')) + '</blockquote>');
                continue;
            }

            // list
            m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
            if (m) {
                flush();
                const ordered = /\d/.test(m[2]);
                let html = '<' + (ordered ? 'ol' : 'ul') + '>';
                while (i < lines.length) {
                    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
                    if (li) {
                        let item = li[3].replace(/^\[ \]\s*/, '\u2610 ').replace(/^\[[xX]\]\s*/, '\u2611 ');
                        html += '<li' + (li[1].length >= 2 ? ' class="sub"' : '') + '>' + inline(item) + '</li>';
                    } else if (/^\s+\S/.test(lines[i]) && html.slice(-5) === '</li>') {
                        // continuation line of the previous item
                        html = html.slice(0, -5) + ' ' + inline(lines[i].trim()) + '</li>';
                    } else {
                        break;
                    }
                    i++;
                }
                i--;
                out.push(html + '</' + (ordered ? 'ol' : 'ul') + '>');
                continue;
            }

            para.push(line);
        }
        flush();
        return unstash(out.join('\n'));
    }

    /* ---------- exports for testing in Node, then stop (no page there) ---------- */
    if (typeof document === 'undefined') {
        if (typeof module !== 'undefined') {
            module.exports = { mdToHtml, findImage, findExcerpt, resolveUrl, timeAgo, activityPct, isBadge };
        }
        return;
    }

    /* ===============================================================
       PAGE CODE
       =============================================================== */

    const $ = (id) => document.getElementById(id);
    const NS = 'http://www.w3.org/2000/svg';

    const el = {
        wheelWrap: document.querySelector('.wheel-wrap'),
        rails: $('rails'), links: $('links'), nodes: $('nodes'), 
        hub: $('hub'), hubImage: $('hubImage'), tip: $('wheelTip'),
        statRepos: $('statRepos'), statSub: $('statSub'),
        detail: $('detail'), detailBody: $('detailBody'),
        shotImg: $('shotImg'), shotFallback: $('shotFallback'), shotInitial: $('shotInitial'),
        activity: $('activityFill'), chips: $('chips'), shotNote: $('shotNote'),
        title: $('detailTitle'), text: $('detailText'), meta: $('detailMeta'),
        readme: $('readme'), readmeScroll: $('readmeScroll'),
        openBtn: $('openBtn'), price: $('price'),
        btnDetails: $('btnDetails'), crumbUser: $('crumbUser'), backBtn: $('backBtn'),
        keyLeft: $('keyLeft'), keyRight: $('keyRight'), keyUp: $('keyUp'), keyDown: $('keyDown')
    };

    const state = {
        user: null,
        repos: [],          // repo objects (from the API) + .rm (readme state)
        nodes: [],          // wheel items for repos
        hubItem: null,
        items: [],          // [hubItem, ...nodes] - order used by Left/Right
        sel: null,
        scanned: 0,
        withImage: 0,
        detailsOpen: false,
        priceKey: '',
        ready: false
    };

    function svg(tag, attrs, parent) {
        const n = document.createElementNS(NS, tag);
        if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
    }

    const fmt = (n) => Number(n || 0).toLocaleString('en-US');

    /* ---------- juice: count-up numbers + tiny UI sounds ---------- */
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function countUp(node, to, ms) {
        cancelAnimationFrame(node._raf);
        if (reduceMotion || !(to > 0)) { node.textContent = fmt(to); return; }
        const t0 = performance.now();
        (function step(now) {
            const p = Math.min((now - t0) / ms, 1);
            node.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
            if (p < 1) node._raf = requestAnimationFrame(step);
        })(t0);
    }

    let audioCtx = null, userActed = false;
    ['keydown', 'pointerdown'].forEach((ev) => window.addEventListener(ev, () => { userActed = true; }, { once: true, capture: true }));

    function blip(freq, dur, vol) {
        if (!CONFIG.SFX || !userActed || reduceMotion) return;
        try {
            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const t = audioCtx.currentTime, d = dur || 0.06;
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'triangle';
            o.frequency.setValueAtTime(freq || 660, t);
            o.frequency.exponentialRampToValueAtTime((freq || 660) * 1.6, t + d);
            g.gain.setValueAtTime(vol || 0.03, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + d);
            o.connect(g); g.connect(audioCtx.destination);
            o.start(t); o.stop(t + d + 0.02);
        } catch (e) { /* no audio: fine */ }
    }

    // the "price" (star count): counts up when you switch gems, but not when the README arrives
    function setPrice(n, key) {
        el.price.innerHTML = '<span class="star">\u2605</span><span class="num"></span>';
        const num = el.price.querySelector('.num');
        if (state.priceKey === key) num.textContent = fmt(n);
        else countUp(num, n, 650);
        state.priceKey = key;
    }

    /* ---------- tiny cache (localStorage, always wrapped) ---------- */
    function cacheGet(key, maxAgeMs) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const o = JSON.parse(raw);
            if (maxAgeMs && Date.now() - o.t > maxAgeMs) return null;
            return o.v;
        } catch (e) { return null; }
    }
    function cacheSet(key, value) {
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); } catch (e) { /* full or blocked: ignore */ }
    }

    /* ---------- GitHub ---------- */
    async function ghJson(path) {
        const headers = { 'Accept': 'application/vnd.github+json' };
        if (CONFIG.TOKEN) headers['Authorization'] = 'Bearer ' + CONFIG.TOKEN;
        const res = await fetch('https://api.github.com/' + path, { headers });
        if (!res.ok) {
            const err = new Error('GitHub answered ' + res.status);
            err.status = res.status;
            err.rateLimited = (res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0';
            throw err;
        }
        return res.json();
    }

    async function loadProfile() {
        const user = CONFIG.USER;
        const key = 'proj:v1:' + user.toLowerCase();
        const cached = cacheGet(key, CONFIG.CACHE_MINUTES * 60000);
        if (cached) return cached;

        const profile = await ghJson('users/' + encodeURIComponent(user));
        let repos = [];
        for (let page = 1; page <= 3; page++) {
            const chunk = await ghJson('users/' + encodeURIComponent(user) + '/repos?per_page=100&sort=pushed&type=owner&page=' + page);
            repos = repos.concat(chunk);
            if (chunk.length < 100) break;
        }
        // keep only what the page uses, so the cache stays small
        const slim = repos.map((r) => ({
            name: r.name, full_name: r.full_name, html_url: r.html_url, description: r.description,
            language: r.language, stargazers_count: r.stargazers_count, forks_count: r.forks_count,
            pushed_at: r.pushed_at, updated_at: r.updated_at, fork: r.fork, archived: r.archived,
            default_branch: r.default_branch, homepage: r.homepage, size: r.size, topics: r.topics || []
        }));
        const data = {
            profile: {
                login: profile.login, name: profile.name, bio: profile.bio, avatar_url: profile.avatar_url,
                html_url: profile.html_url, public_repos: profile.public_repos, followers: profile.followers,
                following: profile.following, created_at: profile.created_at, location: profile.location
            },
            repos: slim
        };
        cacheSet(key, data);
        return data;
    }

    // README: raw.githubusercontent first (no API limit), the API as a last resort
    async function fetchReadmeText(repo) {
        const user = CONFIG.USER;
        const branch = repo.default_branch || 'main';
        const base = 'https://raw.githubusercontent.com/' + encodeURIComponent(user) + '/' + encodeURIComponent(repo.name) + '/' + encodeURIComponent(branch) + '/';
        for (const name of ['README.md', 'readme.md', 'Readme.md']) {
            try {
                const res = await fetch(base + name);
                if (res.ok) return await res.text();
            } catch (e) { throw e; }
        }
        try {
            const headers = { 'Accept': 'application/vnd.github.raw+json' };
            if (CONFIG.TOKEN) headers['Authorization'] = 'Bearer ' + CONFIG.TOKEN;
            const res = await fetch('https://api.github.com/repos/' + encodeURIComponent(user) + '/' + encodeURIComponent(repo.name) + '/readme', { headers });
            if (res.ok) return await res.text();
            if (res.status === 404) return null;
        } catch (e) { throw e; }
        return null;
    }

    function readmeCtx(repo) {
        return { user: CONFIG.USER, repo: repo.name, branch: repo.default_branch || 'main' };
    }

    function loadReadme(repo) {
        if (repo._p) return repo._p;
        const rm = repo.rm;
        rm.status = 'loading';

        repo._p = (async () => {
            const key = 'proj:rm:' + CONFIG.USER.toLowerCase() + '/' + repo.name + ':' + repo.pushed_at;
            let md = cacheGet(key, 0);       // valid as long as the repo has not been pushed to
            try {
                if (md === null || md === undefined) {
                    if (repo.size === 0) {
                        md = '';                                      // empty repository
                    } else {
                        const text = await fetchReadmeText(repo);
                        md = text === null ? '' : text.slice(0, 40000);
                        cacheSet(key, md);
                    }
                }
                rm.md = md;
                rm.status = md ? 'ok' : 'none';
                rm.image = md ? findImage(md, readmeCtx(repo)) : '';
                rm.excerpt = md ? findExcerpt(md, repo.description) : '';
            } catch (e) {
                rm.status = 'error';
                repo._p = null;                                       // allow a retry
            }
            if (rm.status !== 'error') {
                state.scanned++;
                if (rm.image) state.withImage++;
                const item = state.nodes.find((n) => n.repo === repo);
                if (item && rm.image) item.el.setAttribute('data-image', '1');
            }
            if (state.sel && state.sel.repo === repo) renderDetail(state.sel);
        })();
        return repo._p;
    }

    function startScan() {
        const queue = state.repos.slice();
        const worker = async () => {
            while (queue.length) {
                const repo = queue.shift();
                if (repo.rm.status === 'idle') await loadReadme(repo);
            }
        };
        const n = Math.max(1, CONFIG.README_WORKERS);
        for (let i = 0; i < n; i++) worker();
    }

    /* ---------- building the wheel ---------- */
    function polar(r, deg) {
        const a = deg * Math.PI / 180;
        return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
    }

    function buildRails() {
        el.rails.innerHTML = '';
        RINGS.forEach((ring) => svg('circle', { class: 'rail', cx: CX, cy: CY, r: ring.r }, el.rails));

        // the pachinko ring: marquee bulbs on the brass bezel (they take turns lighting, slowly)
        const old = document.getElementById('deco');
        if (old) old.remove();
        const deco = svg('g', { id: 'deco' });

        const bulbs = svg('g', { class: 'bulbs' }, deco);
        const N = 40;
        for (let i = 0; i < N; i++) {
            const p = polar(284, i * 360 / N - 90);
            const b = svg('g', { class: 'bulb ' + (i % 2 ? 'b' : 'a'), transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')' }, bulbs);
            svg('circle', { r: 7.2, fill: '#1a1204', stroke: '#000', 'stroke-opacity': 0.6, 'stroke-width': 1 }, b);
            svg('circle', { r: 5.2, fill: '#6b4d10' }, b);                       // bulb, switched off
            const on = svg('g', { class: 'bulb-on' }, b);                        // bulb, switched on
            svg('circle', { r: 8.6, fill: '#ffcf40', opacity: 0.28 }, on);
            svg('circle', { r: 5.2, fill: '#fff1a8' }, on);
            svg('circle', { cx: -1.5, cy: -1.7, r: 1.5, fill: '#ffffff', opacity: 0.9 }, on);
        }
        el.rails.parentNode.insertBefore(deco, el.rails);
    }

    // skill-tree link: straight out from the parent to this gem's ring, then along the ring
    function linkPath(parent, item) {
        const r = RINGS[item.ring].r;
        const pa = parent.kind === 'hub' ? item.ang : parent.ang;
        const start = parent.kind === 'hub' ? { x: CX, y: CY } : { x: parent.x, y: parent.y };
        const corner = polar(r, pa);
        let d = 'M' + start.x.toFixed(1) + ' ' + start.y.toFixed(1) + ' L' + corner.x.toFixed(1) + ' ' + corner.y.toFixed(1);
        let delta = ((item.ang - pa) % 360 + 540) % 360 - 180;          // shortest way round, -180..180
        if (Math.abs(delta) > 0.5) {
            d += ' A' + r + ' ' + r + ' 0 0 ' + (delta > 0 ? 1 : 0) + ' ' + item.x.toFixed(1) + ' ' + item.y.toFixed(1);
        }
        return d;
    }

    function buildNodes() {
        el.links.innerHTML = '';
        el.nodes.innerHTML = '';
        state.nodes = [];

        // split repos over the rings (inner ring first)
        let cursor = 0;
        const byRing = RINGS.map((ring) => {
            const slice = state.repos.slice(cursor, cursor + ring.cap);
            cursor += slice.length;
            return slice;
        });

        let counter = 0;
        byRing.forEach((slice, ringIdx) => {
            const ring = RINGS[ringIdx];
            const n = slice.length;
            const offset = ringIdx === 1 ? 360 / (Math.max(n, 1) * 2) : (ringIdx === 2 ? 360 / (Math.max(n, 1) * 4) : 0);
            slice.forEach((repo, idx) => {
                const ang = -90 + offset + idx * 360 / n;
                const p = polar(ring.r, ang);
                const color = langColor(repo.language);
                const R = ring.size;

                const node = svg('g', {
                    class: 'node', tabindex: 0, role: 'option', 'aria-label': repo.name, 'aria-selected': 'false',
                    transform: 'translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ')',
                    style: '--d:' + (150 + counter * 22) + 'ms'
                }, el.nodes);
                counter++;

                svg('circle', { r: R + 8, fill: 'transparent' }, node);                         // bigger hit area
                svg('circle', { class: 'halo', r: R + 8 }, node);
                const gem = svg('g', { class: 'gem' }, node);
                svg('circle', { class: 'gem-rim', r: R + 2.5, fill: '#04060a', stroke: '#c9d3e0', 'stroke-opacity': 0.4, 'stroke-width': 1 }, gem);
                svg('circle', { r: R, fill: color }, gem);
                svg('circle', { r: R, fill: 'url(#gloss)', opacity: 0.62 }, gem);
                const t = svg('text', {
                    'text-anchor': 'middle', dy: '0.35em', 'font-size': Math.round(R * 0.95), 'font-weight': 700,
                    'font-family': "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", fill: isLight(color) ? '#101418' : '#ffffff', 'pointer-events': 'none'
                }, gem);
                t.textContent = (repo.name.charAt(0) || '?').toUpperCase();
                svg('circle', { class: 'glint', cx: -R * 0.38, cy: -R * 0.42, r: 2.4, style: '--tw:' + ((counter * 0.37) % 4.5).toFixed(2) + 's' }, gem);
                svg('circle', { class: 'orbit', r: R + 12 }, node);
                svg('circle', { class: 'badge', cx: R * 0.78, cy: -R * 0.78, r: 4.5, fill: '#4fd6ff', stroke: '#ffffff', 'stroke-width': 1.2 }, node);

                const item = { kind: 'repo', repo, el: node, ring: ringIdx, idx, ang, x: p.x, y: p.y, parent: null, link: null };
                state.nodes.push(item);
                wireNode(item);
            });
        });

        // links: ring 0 -> hub, ring k -> nearest node in ring k-1
        state.nodes.forEach((item) => {
            let parent = state.hubItem;
            if (item.ring > 0) {
                const candidates = state.nodes.filter((n) => n.ring === item.ring - 1);
                parent = candidates.reduce((best, c) => (angDiff(c.ang, item.ang) < angDiff(best.ang, item.ang) ? c : best), candidates[0]);
            }
            item.parent = parent;
            item.link = svg('path', { class: 'link', d: linkPath(parent, item) }, el.links);
        });
    }

    function wireNode(item) {
        const node = item.el;
        node.addEventListener('click', () => select(item));
        node.addEventListener('focus', () => select(item));
        node.addEventListener('dblclick', () => openItem(item));
        node.addEventListener('mouseenter', () => showTip(item));
        node.addEventListener('mouseleave', hideTip);
        node.addEventListener('blur', hideTip);
    }

    function setupHub() {
        const hub = el.hub;
        // the CSS expects these classes; the markup does not carry them
        hub.querySelectorAll('circle, image').forEach((n) => n.classList.add('hub-art'));
        svg('circle', { class: 'hub-halo', cx: CX, cy: CY, r: 50 }, hub);
        svg('circle', { class: 'hub-pulse', cx: CX, cy: CY, r: 46 }, hub);
        state.hubItem = { kind: 'hub', el: hub };
        hub.addEventListener('click', () => select(state.hubItem));
        hub.addEventListener('focus', () => select(state.hubItem));
        hub.addEventListener('dblclick', () => openItem(state.hubItem));
        hub.addEventListener('mouseenter', () => showTip(state.hubItem));
        hub.addEventListener('mouseleave', hideTip);
    }

    /* ---------- tooltip ---------- */
    function showTip(item) {
        const label = item.kind === 'hub' ? (state.user ? state.user.login : 'Profile') : item.repo.name;
        el.tip.textContent = label;
        const r = item.el.getBoundingClientRect();
        const w = el.wheelWrap.getBoundingClientRect();
        el.tip.style.left = (r.left + r.width / 2 - w.left) + 'px';
        el.tip.style.top = (r.top - w.top) + 'px';
        el.tip.classList.add('show');
    }
    function hideTip() { el.tip.classList.remove('show'); }

    /* ---------- selection ---------- */
    function select(item) {
        if (!item || state.sel === item) return;
        if (state.sel) {
            state.sel.el.classList.remove('selected');
            state.sel.el.setAttribute('aria-selected', 'false');
        }
        state.sel = item;
        item.el.classList.add('selected');
        item.el.setAttribute('aria-selected', 'true');

        // light up the chain of links from this gem down to the hub
        el.links.querySelectorAll('.link.active').forEach((l) => l.classList.remove('active'));
        let cur = item;
        while (cur && cur.kind === 'repo') {
            cur.link.classList.add('active');
            el.links.appendChild(cur.link);          // bring to front
            cur = cur.parent;
        }

        // ripple on the gem + a tiny tick
        const px = item.kind === 'hub' ? CX : item.x, py = item.kind === 'hub' ? CY : item.y;
        if (!reduceMotion && state.ready) {
            const ring = svg('circle', { class: 'ping', cx: Number(px).toFixed(1), cy: Number(py).toFixed(1), r: item.kind === 'hub' ? 44 : 18 }, el.nodes);
            ring.addEventListener('animationend', () => ring.remove());
            setTimeout(() => ring.remove(), 1000);
        }
        blip(item.kind === 'hub' ? 520 : 640 + (item.ring || 0) * 90, 0.06, 0.03);

        // swap animation on the panel
        el.detailBody.classList.remove('swap');
        void el.detailBody.offsetWidth;
        el.detailBody.classList.add('swap');

        renderDetail(item);
        if (item.kind === 'repo') loadReadme(item.repo);
    }

    function openItem(item) {
        const url = item.kind === 'hub' ? (state.user && state.user.html_url) : item.repo.html_url;
        if (url) window.open(url, '_blank', 'noopener');
    }

    function moveSeq(dir) {
        if (!state.items.length) return;
        const i = state.items.indexOf(state.sel);
        const next = (i + dir + state.items.length) % state.items.length;
        select(state.items[next]);
    }

    function moveRing(dir) {
        const cur = state.sel;
        if (!cur) return;
        const ringList = (r) => state.nodes.filter((n) => n.ring === r);
        if (cur.kind === 'hub') {
            if (dir > 0 && ringList(0).length) select(ringList(0)[0]);
            return;
        }
        const target = cur.ring + dir;
        if (target < 0) { select(state.hubItem); return; }
        const list = ringList(target);
        if (!list.length) return;
        select(list.reduce((best, c) => (angDiff(c.ang, cur.ang) < angDiff(best.ang, cur.ang) ? c : best), list[0]));
    }

    /* ---------- the detail panel ---------- */
    function setShot(opts) {
        el.shotFallback.style.setProperty('--lang', opts.color);
        el.shotInitial.textContent = opts.initial;
        el.shotNote.textContent = opts.note || '';
        if (opts.src) {
            el.shotImg.referrerPolicy = 'no-referrer';
            el.shotImg.onerror = () => { el.shotImg.hidden = true; el.shotNote.textContent = 'Image could not be loaded'; };
            el.shotImg.onload = () => { el.shotImg.hidden = false; };
            if (el.shotImg.getAttribute('src') !== opts.src) { el.shotImg.hidden = true; el.shotImg.src = opts.src; }
            else el.shotImg.hidden = false;
        } else {
            el.shotImg.onerror = el.shotImg.onload = null;
            el.shotImg.hidden = true;
            el.shotImg.removeAttribute('src');
        }
    }

    function setChips(list) {
        el.chips.innerHTML = list.join('');
    }

    function renderDetail(item) {
        if (!item || item !== state.sel) return;
        return item.kind === 'hub' ? renderHub() : renderRepo(item.repo);
    }

    function renderRepo(repo) {
        const rm = repo.rm;
        const color = langColor(repo.language);

        el.title.textContent = repo.name;
        setShot({
            src: rm.image, color, initial: (repo.name.charAt(0) || '?').toUpperCase(),
            note: rm.image ? 'Preview from README'
                : rm.status === 'loading' || rm.status === 'idle' ? 'Reading README\u2026'
                : rm.status === 'error' ? 'README failed to load' : 'No picture in README'
        });
        el.activity.style.setProperty('--v', activityPct(repo.pushed_at) + '%');

        const chips = [];
        chips.push('<span class="chip gold" title="' + esc(repo.language || 'No language') + '">' + esc(langShort(repo.language)) + '</span>');
        if (repo.forks_count > 0) chips.push('<span class="chip" title="Forks">\u2442' + fmt(repo.forks_count) + '</span>');
        if (repo.homepage && /^https?:\/\//i.test(repo.homepage)) {
            chips.push('<a class="chip" style="text-decoration:none" href="' + esc(repo.homepage) + '" target="_blank" rel="noopener" title="Website">' +
                '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg></a>');
        }
        setChips(chips);

        let html = '<div class="desc">' + esc(repo.description || 'No description yet.') + '</div>';
        if (rm.status === 'ok' && rm.excerpt) {
            html += '<div class="excerpt">' + esc(rm.excerpt) + '</div>';
        } else if (rm.status === 'idle' || rm.status === 'loading') {
            html += '<div class="state" style="margin-top:8px">Reading README\u2026</div>';
        } else if (rm.status === 'none') {
            html += '<div class="state" style="margin-top:8px">This repository has no README.</div>';
        } else if (rm.status === 'error') {
            html += '<div class="state" style="margin-top:8px">Could not load the README.<br><button type="button" data-retry="1">RETRY</button></div>';
        }
        el.text.innerHTML = html;

        el.meta.innerHTML = '<span><span class="dot" style="--lang:' + esc(color) + '"></span>' + esc(repo.language || 'No language') + '</span>' +
            '<span>\u00b7 pushed ' + esc(timeAgo(repo.pushed_at)) + '</span>' +
            (repo.archived ? '<span>\u00b7 archived</span>' : '');

        setPrice(repo.stargazers_count, 'r:' + repo.name);
        el.price.title = 'Stars';
        el.openBtn.href = repo.html_url;
        el.openBtn.textContent = 'Open on GitHub \u25b8';
        el.openBtn.removeAttribute('aria-disabled');

        renderReadmeView(repo);
    }

    function profileReadmeRepo() {
        const login = CONFIG.USER.toLowerCase();
        return state.repos.find((r) => r.name.toLowerCase() === login) || null;
    }

    function renderHub() {
        const u = state.user;
        if (!u) return;
        const color = '#3a7bd5';
        el.title.textContent = u.name || u.login;
        setShot({
            src: CONFIG.HUB_IMAGE || u.avatar_url, color, initial: (u.login.charAt(0) || '?').toUpperCase(),
            note: 'GitHub profile'
        });
        const lastPush = state.repos.reduce((best, r) => (!best || r.pushed_at > best ? r.pushed_at : best), '');
        el.activity.style.setProperty('--v', activityPct(lastPush) + '%');
        setChips(['<span class="chip gold" title="Followers">' + esc(fmt(u.followers)) + '</span>']);

        el.text.innerHTML = '<div class="desc">' + esc(u.bio || 'No bio on this profile.') + '</div>' +
            '<div class="excerpt">' + esc(fmt(u.public_repos) + ' public repositories' + (u.location ? ' \u00b7 ' + u.location : '')) + '</div>';
        el.meta.innerHTML = '<span><span class="dot" style="--lang:' + color + '"></span>@' + esc(u.login) + '</span>' +
            '<span>\u00b7 joined ' + esc(new Date(u.created_at).getFullYear()) + '</span>' +
            '<span>\u00b7 following ' + esc(fmt(u.following)) + '</span>';

        const totalStars = state.repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
        setPrice(totalStars, 'hub');
        el.price.title = 'Total stars';
        el.openBtn.href = u.html_url;
        el.openBtn.textContent = 'Open profile \u25b8';
        el.openBtn.removeAttribute('aria-disabled');

        const pr = profileReadmeRepo();
        if (pr) { renderReadmeView(pr); }
        else el.readmeScroll.innerHTML = '<div class="md"><p>' + esc(u.bio || '') + '</p><p class="empty">No profile README found.</p></div>';
    }

    function renderReadmeView(repo) {
        if (!state.detailsOpen) return;
        const rm = repo.rm;
        let html;
        if (rm.status === 'ok') html = mdToHtml(rm.md, readmeCtx(repo));
        else if (rm.status === 'none') html = '<p class="empty">This repository has no README.</p>';
        else if (rm.status === 'error') html = '<p class="empty">Could not load the README.</p>';
        else html = '<p class="empty">Reading README\u2026</p>';
        el.readmeScroll.innerHTML = '<div class="md">' + html + '</div>';
        el.readmeScroll.scrollTop = 0;
    }

    function setDetails(open) {
        blip(open ? 820 : 480, 0.07, 0.03);
        state.detailsOpen = open;
        el.readme.hidden = !open;
        el.detail.classList.toggle('details-open', open);
        el.btnDetails.setAttribute('aria-pressed', String(open));
        if (open && state.sel) {
            if (state.sel.kind === 'repo') renderReadmeView(state.sel.repo);
            else renderHub();
        }
    }

    /* ---------- top-right numbers ---------- */
    function renderTopRight(total, shown) {
        const u = state.user;
        countUp(el.statRepos, u.public_repos != null ? u.public_repos : total, 900);
        const stars = state.repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
        let sub = '\u2605 ' + fmt(stars) + ' stars \u00b7 ' + fmt(u.followers) + ' followers';
        if (total > shown) sub += ' \u00b7 showing ' + shown;
        el.statSub.textContent = sub;
    }

    /* ---------- errors ---------- */
    function showFatal(err) {
        let msg;
        if (err && err.rateLimited) msg = 'GitHub\u2019s request limit was reached. Wait a few minutes and try again (or add a TOKEN in CONFIG).';
        else if (err && err.status === 404) msg = 'The GitHub user \u201c' + esc(CONFIG.USER) + '\u201d was not found. Check CONFIG.USER at the top of projects.js.';
        else msg = 'Could not reach GitHub. Check your connection and try again.';
        el.title.textContent = 'Could not load projects';
        setShot({ src: '', color: NO_LANG_COLOR, initial: '!', note: '' });
        el.text.innerHTML = '<div class="state">' + msg + '<br><button type="button" data-reload="1">TRY AGAIN</button></div>';
        el.meta.textContent = '';
        el.price.textContent = '';
        el.statRepos.textContent = '\u2013';
        el.statSub.innerHTML = '&nbsp;';
        el.openBtn.setAttribute('aria-disabled', 'true');
    }

    /* ---------- controls ---------- */
    function pulse(btn) {
        if (!btn) return;
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
    }

    function bindControls() {
        el.keyLeft.addEventListener('click', () => moveSeq(-1));
        el.keyRight.addEventListener('click', () => moveSeq(1));
        el.keyUp.addEventListener('click', () => moveRing(-1));
        el.keyDown.addEventListener('click', () => moveRing(1));
        el.btnDetails.addEventListener('click', () => setDetails(!state.detailsOpen));

        el.text.addEventListener('click', (e) => {
            const t = e.target.closest('button');
            if (!t) return;
            if (t.dataset.reload) { location.reload(); }
            if (t.dataset.retry && state.sel && state.sel.kind === 'repo') {
                const repo = state.sel.repo;
                repo.rm.status = 'idle';
                repo._p = null;
                renderDetail(state.sel);
                loadReadme(repo);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const key = e.key;

            // Enter / Space on a real button or link keeps its normal behaviour
            if ((key === 'Enter' || key === ' ') && e.target.closest && e.target.closest('button, a')) return;

            switch (key) {
                case 'ArrowLeft':  e.preventDefault(); pulse(el.keyLeft);  moveSeq(-1); break;
                case 'ArrowRight': e.preventDefault(); pulse(el.keyRight); moveSeq(1);  break;
                case 'ArrowUp':    e.preventDefault(); pulse(el.keyUp);    moveRing(-1); break;
                case 'ArrowDown':  e.preventDefault(); pulse(el.keyDown);  moveRing(1);  break;
                case 'Enter':      if (state.sel) { e.preventDefault(); openItem(state.sel); } break;
                case 'd': case 'D': pulse(el.btnDetails.querySelector('.key')); setDetails(!state.detailsOpen); break;
                case 'Escape': case 'q': case 'Q': case 'Backspace':
                    e.preventDefault();
                    pulse(el.backBtn.querySelector('.key'));
                    el.backBtn.click();            // lets any page-transition script on the link do its job
                    break;
                default: break;
            }
        });
    }

    /* ---------- start ---------- */
    async function init() {
        buildRails();
        setupHub();
        bindControls();
        if (!CONFIG.USER) {
            el.title.textContent = 'No GitHub set';
            setShot({ src: '', color: NO_LANG_COLOR, initial: '?', note: '' });
            el.text.innerHTML = '<div class="state">Open <b>projects.js</b> and put your GitHub username in <b>CONFIG.USER</b>. Nothing is loaded until then.</div>';
            el.meta.textContent = '';
            el.price.textContent = '';
            el.statRepos.textContent = '\u2013';
            el.openBtn.setAttribute('aria-disabled', 'true');
            return;
        }
        el.crumbUser.textContent = 'github.com/' + CONFIG.USER;
        el.crumbUser.href = 'https://github.com/' + encodeURIComponent(CONFIG.USER);
        if (CONFIG.HUB_IMAGE) el.hubImage.setAttribute('href', CONFIG.HUB_IMAGE);

        el.title.textContent = 'Loading\u2026';
        el.text.innerHTML = '<div class="state">Calling GitHub for <b>' + esc(CONFIG.USER) + '</b>\u2026</div>';

        let data;
        try {
            data = await loadProfile();
        } catch (err) {
            console.warn('projects.js: could not load GitHub data for "' + CONFIG.USER + '"', err);
            showFatal(err);
            return;
        }

        state.user = data.profile;
        let repos = data.repos.filter((r) => CONFIG.INCLUDE_FORKS || !r.fork);
        repos.sort(CONFIG.SORT === 'stars'
            ? (a, b) => (b.stargazers_count - a.stargazers_count) || (b.pushed_at > a.pushed_at ? 1 : -1)
            : (a, b) => (b.pushed_at > a.pushed_at ? 1 : -1));
        const total = repos.length;
        repos = repos.slice(0, Math.min(CONFIG.MAX_REPOS, RINGS.reduce((s, r) => s + r.cap, 0)));
        repos.forEach((r) => { r.rm = { status: 'idle', md: '', image: '', excerpt: '' }; });
        state.repos = repos;

        el.crumbUser.textContent = 'github.com/' + state.user.login;
        el.crumbUser.href = state.user.html_url;
        if (!CONFIG.HUB_IMAGE && state.user.avatar_url) el.hubImage.setAttribute('href', state.user.avatar_url);

        renderTopRight(total, repos.length);
        buildNodes();
        state.items = [state.hubItem].concat(state.nodes);
        state.ready = true;

        select(state.hubItem);
        startScan();
    }

    init();

})();
document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'escape') {
        document.body.style.transition = 'opacity 0.35s ease';
        document.body.style.opacity = '1'; // Ensure baseline

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.style.opacity = '0';
            });
        });

        setTimeout(() => { 
            window.location.href = 'homepage.html'; 
        }, reduceMotion ? 0 : 350);
    }
});
