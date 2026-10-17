/* =====================================================================
   contact.js  -  the Contact page
   Works with contact.html + contact.css.

   >>> Fill in the details in CONFIG below. Anything left empty shows
       "Not added yet" and its buttons stay switched off. <<<

   Keys:  Up / Down  pick Instagram, GitHub or Phone
          C          copy the picked one
          Ctrl+Enter send the message (while typing)
          Esc        back (or leave the field you are typing in)
   ===================================================================== */

(function () {
    'use strict';

    /* ---------------------------------------------------------------
       YOUR DETAILS  (all empty on purpose)
       --------------------------------------------------------------- */
    const CONFIG = {
        INSTAGRAM: 'https://www.instagram.com/yajnesh_fr/',      // your handle, e.g. 'yourname' (or the full profile link)
        GITHUB: 'Cheeseysofa',         // your username, e.g. 'octocat' (or the full profile link)
        PHONE: '+91 86374 51789',          // e.g. '+91 98765 43210'

        EMAIL: '',          // where messages go if there is no FORM_ENDPOINT:
                            // the visitor's own mail app opens with the message filled in
        FORM_ENDPOINT: 'https://formspree.io/f/mkjoygbb',  // optional: a form service URL (Formspree, Getform ...) that takes a JSON POST.
                            // With this set, messages are sent straight from the page.

        // Questions people ask first. An item is only shown when its answer is filled in.
        // If every answer is empty the whole "Before you write" box stays hidden.
        FAQ: [
            { q: 'What can I contact you about?', a: 'You can contact me about anything! Even about drum gigs or rare hotwheels!' },
            { q: 'How fast do you reply?',        a: 'I try to reply as soon as possible!' },
            { q: 'Do you take freelance work?',   a: 'Yes, I occasionally take on freelance projects.' }
        ]
    };

    /* ---------------------------------------------------------------
       helpers
       --------------------------------------------------------------- */
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const clean = (s) => String(s || '').trim();
    const isUrl = (s) => /^https?:\/\//i.test(s);
    const lastSegment = (u) => u.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop();

    // turn what you typed in CONFIG into: what to show, where to link, what to copy
    const BUILD = {
        instagram: (v) => {
            const handle = (isUrl(v) ? lastSegment(v) : v).replace(/^@/, '');
            const href = isUrl(v) ? v : 'https://instagram.com/' + encodeURIComponent(handle);
            return { text: '@' + handle, href: href, copy: href };
        },
        github: (v) => {
            const user = isUrl(v) ? lastSegment(v) : v.replace(/^@/, '');
            const href = isUrl(v) ? v : 'https://github.com/' + encodeURIComponent(user);
            return { text: 'github.com/' + user, href: href, copy: href };
        },
        phone: (v) => {
            const digits = v.replace(/[^\d+]/g, '');
            return { text: v, href: digits ? 'tel:' + digits : '', copy: v };
        }
    };

    const rows = Array.prototype.slice.call(document.querySelectorAll('.reach-row')).map((li) => {
        const key = li.getAttribute('data-key');
        const raw = clean(CONFIG[key.toUpperCase()]);
        const built = raw ? BUILD[key](raw) : null;
        return {
            key: key, li: li, data: built,
            value: li.querySelector('.r-value'),
            open: li.querySelector('[data-act="open"]'),
            copy: li.querySelector('[data-act="copy"]')
        };
    });

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------------------------------------------------------
       toast + copy
       --------------------------------------------------------------- */
    let toastTimer = 0;
    function toast(msg) {
        const t = $('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
            document.body.removeChild(ta);
        });
    }

    function copyRow(row) {
        if (!row.data) { toast(row.li.querySelector('.r-label').textContent + ' has not been added yet'); return; }
        copyText(row.data.copy).then(
            () => toast('Copied ' + row.li.querySelector('.r-label').textContent),
            () => toast('Could not copy. Select the text and copy it by hand.')
        );
    }

    /* ---------------------------------------------------------------
       the three rows
       --------------------------------------------------------------- */
    let current = 0;

    function select(i) {
        current = (i + rows.length) % rows.length;
        rows.forEach((r, n) => {
            if (n === current) r.li.setAttribute('aria-current', 'true');
            else r.li.removeAttribute('aria-current');
        });
    }

    function setupRows() {
        rows.forEach((r, n) => {
            const on = !!r.data;
            r.li.classList.toggle('ready', on);
            r.value.classList.toggle('empty', !on);
            r.value.textContent = on ? r.data.text : 'Not added yet';

            if (on) {
                r.open.href = r.data.href;
                r.open.removeAttribute('aria-disabled');
                r.open.removeAttribute('tabindex');
                if (r.key === 'phone') r.open.removeAttribute('target');
                r.copy.removeAttribute('aria-disabled');
            } else {
                r.open.setAttribute('href', '#');
                r.open.setAttribute('aria-disabled', 'true');
                r.open.setAttribute('tabindex', '-1');
                r.copy.setAttribute('aria-disabled', 'true');
            }

            r.li.addEventListener('click', () => select(n));
            r.open.addEventListener('click', (e) => { if (!on) e.preventDefault(); });
            r.copy.addEventListener('click', (e) => { e.stopPropagation(); select(n); copyRow(r); });
        });
        select(0);
    }

    /* ---------------------------------------------------------------
       FAQ (only the questions that have an answer)
       --------------------------------------------------------------- */
    function setupFaq() {
        const items = CONFIG.FAQ.filter((f) => clean(f.q) && clean(f.a));
        if (!items.length) return;
        $('faqList').innerHTML = items.map((f, i) =>
            '<details' + (i === 0 ? ' open' : '') + '><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>'
        ).join('');
        $('faqPanel').hidden = false;
    }

    /* ---------------------------------------------------------------
       the message form
       --------------------------------------------------------------- */
    const form = $('form');
    const f = {
        name: $('fName'), email: $('fEmail'), msg: $('fMsg'), hp: $('fHp'),
        eName: $('eName'), eEmail: $('eEmail'), eMsg: $('eMsg'),
        count: $('count'), send: $('sendBtn'), result: $('result')
    };
    const DRAFT_KEY = 'contact:draft';
    let sending = false;

    function topic() {
        const c = form.querySelector('input[name="topic"]:checked');
        return c ? c.value : '';
    }

    function setErr(input, el, msg) {
        el.textContent = msg || '';
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }

    function validate() {
        const name = clean(f.name.value), email = clean(f.email.value), msg = clean(f.msg.value);
        const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
        setErr(f.name, f.eName, name.length < 2 ? 'Please tell me your name.' : '');
        setErr(f.email, f.eEmail, !email ? 'Please add your email so I can reply.' : (okEmail ? '' : 'That email does not look right.'));
        setErr(f.msg, f.eMsg, msg.length < 10 ? 'Please write a little more (at least 10 characters).' : '');
        const firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) { firstBad.focus(); return false; }
        return true;
    }

    function updateCount() {
        const n = f.msg.value.length;
        f.count.textContent = n + ' / 1000';
        f.count.classList.toggle('near', n >= 900);
    }

    function saveDraft() {
        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: f.name.value, email: f.email.value, msg: f.msg.value, topic: topic() }));
        } catch (e) { /* storage blocked: fine */ }
    }

    function loadDraft() {
        try {
            const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (!d) return;
            f.name.value = d.name || '';
            f.email.value = d.email || '';
            f.msg.value = d.msg || '';
            if (d.topic) {
                const r = form.querySelector('input[name="topic"][value="' + d.topic + '"]');
                if (r) r.checked = true;
            }
        } catch (e) { /* ignore */ }
    }

    function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    }

    function showResult(kind, title, text, actionsHtml) {
        f.result.className = 'result ' + kind;
        f.result.innerHTML = '<strong>' + esc(title) + '</strong>' + esc(text) +
            (actionsHtml ? '<div class="result-actions">' + actionsHtml + '</div>' : '');
        f.result.hidden = false;
    }

    function hideResult() {
        f.result.hidden = true;
        form.classList.remove('sent');
    }

    function setSending(on) {
        sending = on;
        f.send.disabled = on;
    }

    function markSent(email) {
        form.classList.add('sent');
        showResult('ok', 'Message sent', 'Thank you. I will reply to ' + email + '.');
        form.reset();
        updateCount();
        clearDraft();
        toast('Message sent');
    }

    function mailtoHref(data) {
        const subject = 'Portfolio message from ' + data.name + (data.topic ? ' (' + data.topic + ')' : '');
        const body = data.message + '\n\n' + data.name + '\n' + data.email;
        return 'mailto:' + CONFIG.EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (sending || !validate()) return;

        const data = { name: clean(f.name.value), email: clean(f.email.value), topic: topic(), message: clean(f.msg.value) };

        if (f.hp.value) { markSent(data.email); return; }          // a bot filled the hidden field: pretend it worked

        if (CONFIG.FORM_ENDPOINT) {
            setSending(true);
            try {
                const res = await fetch(CONFIG.FORM_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('HTTP ' + res.status);
                markSent(data.email);
            } catch (err) {
                showResult('bad', 'Message not sent', 'Something went wrong on the way. Your text is still here, so you can try again.',
                    CONFIG.EMAIL ? '<a class="btn" href="' + esc(mailtoHref(data)) + '">Send by email instead</a>' : '');
            } finally {
                setSending(false);
            }
            return;
        }

        if (CONFIG.EMAIL) {
            window.location.href = mailtoHref(data);
            showResult('info', 'Your mail app should have opened', 'Press send there to finish. Nothing has been sent from this page yet.');
            return;
        }

        showResult('warn', 'Messages cannot be sent yet', 'Add an EMAIL or a FORM_ENDPOINT in contact.js so the message has somewhere to go.');
    }

    function setupForm() {
        loadDraft();
        updateCount();
        form.addEventListener('submit', onSubmit);
        form.addEventListener('input', (e) => {
            if (e.target === f.msg) updateCount();
            if (e.target === f.name) setErr(f.name, f.eName, '');
            if (e.target === f.email) setErr(f.email, f.eEmail, '');
            if (e.target === f.msg) setErr(f.msg, f.eMsg, '');
            if (!f.result.hidden) hideResult();
            saveDraft();
        });
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
        });
    }

    /* ---------------------------------------------------------------
       keys
       --------------------------------------------------------------- */
    function pulse(btn) {
        if (!btn || reduceMotion) return;
        btn.classList.add('pressed');
        setTimeout(() => btn.classList.remove('pressed'), 120);
    }

    function setupKeys() {
        $('keyUp').addEventListener('click', () => select(current - 1));
        $('keyDown').addEventListener('click', () => select(current + 1));
        $('keyCopy').addEventListener('click', () => copyRow(rows[current]));

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

            if (e.key === 'Escape') {
                if (typing) { e.target.blur(); return; }
                $('backBtn').click();
                return;
            }
            if (typing) return;

            switch (e.key) {
                case 'ArrowUp':   e.preventDefault(); pulse($('keyUp'));   select(current - 1); break;
                case 'ArrowDown': e.preventDefault(); pulse($('keyDown')); select(current + 1); break;
                case 'c': case 'C': pulse($('keyCopy')); copyRow(rows[current]); break;
                default: break;
            }
        });
    }

    /* ---------------------------------------------------------------
       start
       --------------------------------------------------------------- */
    setupRows();
    setupFaq();
    setupForm();
    setupKeys();
})();
