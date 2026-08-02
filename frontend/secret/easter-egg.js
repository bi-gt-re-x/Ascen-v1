/* easter-egg.js — the hidden quote.
 *
 * Click the app icon (the nav logo) 10 times in the dark and the day's quote
 * slips away, replaced — for the rest of the day — by a cryptic clue. In dark
 * mode the icon stops behaving like the link home it is: the click goes
 * nowhere, the icon pops, and the tenth reveals the clue. In the light, or once
 * the clue is out, it is a plain link again. The
 * swap is sleek: the old quote glides out, the new one rises in with an
 * ominous glow while the whole screen shakes. The unlock is remembered per
 * user per day (localStorage), so a reload keeps the mysterious quote (and
 * dashboard.js is told to stop overwriting it via window.__mysteriousQuoteActive).
 *
 * It ends where the chain does: once the ADMIN ROOM has handed out a title,
 * the clue is retired and the daily quote goes back to normal — the title badge
 * beside the username is what's left of the secret.
 */
(function () {
    'use strict';

    var QUOTE = '"The pentagon is the key, find it" -Mysterious,,';
    var NEEDED = 10;        // clicks to unlock

    function user() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function todayStr() {
        var d = new Date();
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function key() { return 'easterEgg:' + user() + ':' + todayStr(); }
    function isUnlocked() {
        try { return localStorage.getItem(key()) === '1'; } catch (e) { return false; }
    }
    // The whole hidden chain only lives in the dark.
    function isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    function markUnlocked() {
        try { localStorage.setItem(key(), '1'); } catch (e) {}
    }

    // Does this account hold a title from the hidden ADMIN ROOM?
    function earnedTitle() {
        try { return localStorage.getItem('ascenTitle:' + user()); } catch (e) { return null; }
    }

    // The Admin title earned in the hidden ADMIN ROOM sits before the username
    // on the dashboard as a badge: a dark rounded plate with a green rim that
    // glows inside and out, and glowing green text on it.
    function applyAdminTitle() {
        var t = earnedTitle();
        if (!t) return;   // no earned title
        var nameEl = document.getElementById('userNameDisplay');
        if (!nameEl || document.querySelector('.admin-tag')) return;
        if (!document.getElementById('adminTagStyle')) {
            var st = document.createElement('style');
            st.id = 'adminTagStyle';
            st.textContent =
                '.admin-tag{display:inline-flex;align-items:center;justify-content:center;' +
                'padding:4px 16px;margin-right:9px;vertical-align:middle;' +
                'color:#7dffbe;font-family:"Courier New",monospace;font-weight:700;' +
                'font-size:0.86em;letter-spacing:0.5px;line-height:1.25;' +
                'background:radial-gradient(ellipse at center,#123a28 0%,#050b08 100%);' +
                'border:1.5px solid #3ff59a;border-radius:9px;' +
                'text-shadow:0 0 9px rgba(93,255,178,.9),0 0 20px rgba(43,255,136,.5);' +
                'box-shadow:0 0 12px rgba(43,255,136,.55),0 0 26px rgba(43,255,136,.25),' +
                'inset 0 0 14px rgba(43,255,136,.35);' +
                'animation:adminTagFlicker 3.2s infinite;}' +
                '@keyframes adminTagFlicker{0%,100%{opacity:1}92%{opacity:1}94%{opacity:.55}96%{opacity:1}}';
            document.head.appendChild(st);
        }
        var tag = document.createElement('span');
        tag.className = 'admin-tag';
        tag.textContent = t;   // 'Admin' or any custom title set in the ASCEN CORE
        tag.style.cursor = 'pointer';
        tag.title = '';
        // Clicking your title drops you straight back into the Ascen Engine.
        tag.addEventListener('click', function () { window.location.href = '/engine'; });
        nameEl.parentNode.insertBefore(tag, nameEl);
    }

    function init() {
        applyAdminTitle();

        var quoteEl = document.getElementById('dailyQuote');
        if (!quoteEl) return;
        var container = quoteEl.closest('.quote-container') || quoteEl.parentElement;

        // The clue's job is done once the title has been earned. Hand the line
        // back to the daily quote — no ominous styling, no replacement text, and
        // no further reveals — so the dashboard reads normally from here on.
        if (earnedTitle()) {
            window.__mysteriousQuoteActive = false;
            if (container) container.classList.remove('quote-ominous', 'quote-spotlight');
            return;
        }

        // Already unlocked today: show it straight away, no theatrics, and claim
        // the quote line so the async daily-quote fetch leaves it alone.
        if (isUnlocked()) {
            window.__mysteriousQuoteActive = true;
            quoteEl.textContent = QUOTE;
            if (container) container.classList.add('quote-ominous');
        }

        // The app icon in the top bar — .topnav-brand-mark, which is the mark
        // on its own and no longer part of a link. The wordmark beside it is
        // the link home, and it is deliberately not this element: binding to
        // the whole .topnav-brand would have counted clicks on the wordmark
        // too and then cancelled the navigation they asked for.
        //
        // The older names are still accepted, so a page that has not been
        // rebuilt yet keeps its chain: .topnav-brand (the single-link bar) and
        // .logo (the pre-topnav dashboard).
        var icon = document.querySelector('.topnav-brand-mark')
                || document.querySelector('.topnav-brand')
                || document.querySelector('.logo');
        if (!icon) return;
        icon.style.cursor = 'pointer';
        icon.setAttribute('title', '');   // no tooltip hint — it's a secret

        // No streak: ten clicks, at whatever pace suits. They used to have to
        // land within RESET_MS of each other, which is a rate nobody clicks a
        // logo at on purpose — every pause put the count back to nothing.
        var clicks = 0;

        icon.addEventListener('click', function (e) {
            // In the light, or once today's clue is out, the icon is just the
            // link home it appears to be.
            if (isUnlocked() || !isDark()) { clicks = 0; return; }
            // In the dark it stops being a link and starts counting: the click
            // goes nowhere, the icon pops, and the tenth brings the quote.
            e.preventDefault();
            clicks++;
            if (clicks >= NEEDED) {
                clicks = 0;
                reveal(quoteEl, container);
            } else {
                pop(icon, clicks);   // the icon bounces…
                wobble(clicks);      // …and the screen shakes harder each time
            }
        });
    }

    // The icon's own answer to a click: a bounce that grows with the count, so
    // the tenth is plainly the end of something that has been building.
    function pop(icon, n) {
        icon.style.setProperty('--pop', (1.06 + n * 0.02).toFixed(2));
        icon.classList.remove('easter-pop');
        void icon.offsetWidth;               // restart the animation
        icon.classList.add('easter-pop');
    }

    // A per-click wobble whose amplitude climbs with the streak (click 1 = a
    // faint nudge, click 9 = a hard shake), building tension toward the reveal.
    var wobbleClipTimer = null;
    function wobble(n) {
        var root = document.documentElement;
        root.style.setProperty('--wob', (n * 2.5) + 'px');
        root.style.setProperty('--wob-rot', (n * 0.28) + 'deg');
        root.classList.add('easter-shake-clip');
        document.body.classList.remove('easter-wobble');
        void document.body.offsetWidth;               // restart animation
        document.body.classList.add('easter-wobble');
        if (wobbleClipTimer) clearTimeout(wobbleClipTimer);
        wobbleClipTimer = setTimeout(function () {
            document.body.classList.remove('easter-wobble');
            root.classList.remove('easter-shake-clip');
        }, 340);
    }

    function reveal(quoteEl, container) {
        markUnlocked();
        window.__mysteriousQuoteActive = true;

        // A full-viewport scrim, spotlighting the quote when the rest goes dark.
        var dark = document.getElementById('easterDark');
        if (!dark) {
            dark = document.createElement('div');
            dark.id = 'easterDark';
            dark.setAttribute('aria-hidden', 'true');
            document.body.appendChild(dark);
        }

        // 1) Sleek slide-out of the current quote.
        if (wobbleClipTimer) clearTimeout(wobbleClipTimer);
        document.body.classList.remove('easter-wobble');
        quoteEl.classList.add('quote-slide-out');

        setTimeout(function () {
            // 2) Swap in the mysterious text, dressed ominously.
            quoteEl.textContent = QUOTE;
            if (container) {
                container.classList.add('quote-ominous');
                container.classList.add('quote-spotlight');   // lift above the scrim
            }
            quoteEl.classList.remove('quote-slide-out');

            // 3) The rest of the screen turns dark.
            void dark.offsetWidth;
            dark.classList.add('show');

            // 4) The biggest shake yet + the ominous rise-in.
            void quoteEl.offsetWidth;                 // restart animation
            quoteEl.classList.add('quote-slide-in');
            document.documentElement.classList.add('easter-shake-clip');
            document.body.classList.remove('easter-wobble');
            void document.body.offsetWidth;
            document.body.classList.add('easter-shake');

            setTimeout(function () {
                document.body.classList.remove('easter-shake');
                document.documentElement.classList.remove('easter-shake-clip');
            }, 900);
            setTimeout(function () {
                quoteEl.classList.remove('quote-slide-in');
            }, 1050);

            // 5) Hold the darkness a beat, then lift it — leaving the ominous
            //    quote glowing in the restored dashboard.
            setTimeout(function () { dark.classList.remove('show'); }, 2400);
            setTimeout(function () {
                if (container) container.classList.remove('quote-spotlight');
            }, 3350);
        }, 560);   // matches the slide-out transition
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
