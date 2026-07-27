/* auth-flow.js — the account popup on the home page.
 *
 * One white card, five panels, walked in this order:
 *
 *              ┌──────────── choose ────────────┐
 *           Log In                       Create Account
 *              │                    name / e-mail / password
 *              │                       (password strength)
 *              │                                │
 *              │                     verification e-mail sent
 *              │                        "check your inbox"
 *              │                          verify e-mail
 *              └──────────────┬─────────────────┘
 *                      Complete Profile
 *            (username optional · theme · daily goal)
 *                             │
 *                         Dashboard
 *
 * The server decides everything that matters (who exists, what's verified,
 * which account the session holds); this file only moves between panels and
 * reports what came back.
 *
 * The page can be opened straight onto a panel: a gated page bounces a
 * signed-out visitor to /home?auth=login&next=/dashboard, and the verification
 * link lands on /home?auth=profile. `next` is where the flow finishes.
 */
(function () {
    'use strict';

    var modal, card, message, heading, sub;
    var pendingEmail = '';
    var pollTimer = null;
    var chosenTheme = 'light';
    var chosenGoal = 100;

    // Where to go once the flow completes — the page they were trying to reach.
    function nextUrl() {
        var params = new URLSearchParams(window.location.search);
        var n = params.get('next') || '';
        return (n.charAt(0) === '/' && n.indexOf('//') !== 0) ? n : '/dashboard';
    }

    var COPY = {
        choose:  ['Welcome', 'Log in or create an account to continue.'],
        login:   ['Log in', 'Good to see you again.'],
        create:  ['Create account', 'A name, an e-mail and a password is all it takes.'],
        inbox:   ['Check your inbox', 'One click and the account is yours.'],
        profile: ['Complete profile', 'Three quick choices and you are in.']
    };

    function show(step) {
        if (!modal) return;
        modal.querySelectorAll('.auth-step').forEach(function (panel) {
            panel.classList.toggle('hidden', panel.getAttribute('data-step') !== step);
        });
        var copy = COPY[step] || COPY.choose;
        heading.textContent = copy[0];
        sub.textContent = copy[1];
        say('');
        // The inbox panel watches for the link being opened in another tab.
        if (step === 'inbox') startPolling(); else stopPolling();
        var first = modal.querySelector('.auth-step:not(.hidden) input, .auth-step:not(.hidden) button');
        if (first) setTimeout(function () { first.focus(); }, 60);
    }

    function open(step) {
        if (!modal) return;
        modal.classList.remove('hidden');
        document.body.classList.add('auth-open');
        show(step || 'choose');
    }

    function close() {
        if (!modal) return;
        modal.classList.add('hidden');
        document.body.classList.remove('auth-open');
        stopPolling();
    }

    function say(text, kind) {
        if (!message) return;
        message.textContent = text || '';
        message.className = 'auth-message' + (text ? ' is-' + (kind || 'error') : '');
    }

    function post(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function (r) { return r.json(); });
    }

    // --- Password strength -------------------------------------------------
    // Length does most of the work, with a point each for mixed case, digits and
    // symbols — enough to steer someone away from "password1" without pretending
    // to be a real strength estimator.
    function strengthOf(pw) {
        if (!pw) return { score: 0, label: 'Password strength' };
        var score = 0;
        if (pw.length >= 8) score++;
        if (pw.length >= 12) score++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
        if (/\d/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (pw.length < 8) score = Math.min(score, 1);
        var labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
        return { score: score, label: labels[Math.min(score, 5)] };
    }

    function paintStrength() {
        var input = document.getElementById('createPassword');
        var fill = document.getElementById('pwStrengthFill');
        var label = document.getElementById('pwStrengthLabel');
        if (!input || !fill || !label) return;
        var s = strengthOf(input.value);
        fill.style.width = (s.score / 5 * 100) + '%';
        fill.className = 'lvl-' + s.score;
        label.textContent = s.label;
    }

    // --- Steps -------------------------------------------------------------
    function doLogin(e) {
        e.preventDefault();
        var id = document.getElementById('loginId').value.trim();
        var pw = document.getElementById('loginPassword').value;
        if (!id || !pw) { say('Enter your details to continue.'); return; }
        say('Signing in…', 'info');
        post('/api/login', { username: id, password: pw }).then(function (res) {
            if (!res.success) {
                if (res.unverified) {
                    pendingEmail = res.email || '';
                    document.getElementById('inboxEmail').textContent = pendingEmail;
                    show('inbox');
                }
                say(res.message || 'That did not work.');
                return;
            }
            localStorage.setItem('currentUser', res.user.username);
            if (window.applyTheme) window.applyTheme(res.user.theme || 'light');
            if (res.profile_complete === false) { show('profile'); return; }
            window.location.href = nextUrl();
        }).catch(function () { say('Could not reach the server.'); });
    }

    function doCreate(e) {
        e.preventDefault();
        var name = document.getElementById('createName').value.trim();
        var email = document.getElementById('createEmail').value.trim();
        var pw = document.getElementById('createPassword').value;
        say('Creating your account…', 'info');
        post('/api/auth/signup', { name: name, email: email, password: pw }).then(function (res) {
            if (!res.success) { say(res.message || 'That did not work.'); return; }
            pendingEmail = res.email || email;
            document.getElementById('inboxEmail').textContent = pendingEmail;
            showDevLink(res.dev_link);
            show('inbox');
        }).catch(function () { say('Could not reach the server.'); });
    }

    // With no mail server configured the link has nowhere to go, so the popup
    // shows it directly — the flow stays walkable end to end on a laptop.
    function showDevLink(link) {
        var wrap = document.getElementById('devLinkWrap');
        var anchor = document.getElementById('devLink');
        if (!wrap || !anchor) return;
        if (link) { anchor.setAttribute('href', link); wrap.hidden = false; }
        else { wrap.hidden = true; }
    }

    function doResend() {
        say('Sending…', 'info');
        post('/api/auth/resend', { email: pendingEmail }).then(function (res) {
            showDevLink(res.dev_link);
            say(res.message || '', res.success ? 'info' : 'error');
        }).catch(function () { say('Could not reach the server.'); });
    }

    // Opening the link in another tab verifies the account server-side; this
    // poll is how the popup notices and moves on by itself.
    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function () {
            fetch('/api/auth/verify_status', { cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    if (res && res.verified) {
                        stopPolling();
                        if (res.profile_complete) window.location.href = nextUrl();
                        else show('profile');
                    }
                }).catch(function () { /* keep waiting */ });
        }, 3000);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function doProfile(e) {
        e.preventDefault();
        var username = document.getElementById('profileUsername').value.trim();
        say('Saving…', 'info');
        post('/api/auth/complete_profile', {
            username: username, theme: chosenTheme, daily_goal: chosenGoal
        }).then(function (res) {
            if (!res.success) { say(res.message || 'That did not work.'); return; }
            localStorage.setItem('currentUser', res.user.username);
            if (window.applyTheme) window.applyTheme(res.user.theme || 'light');
            window.location.href = nextUrl();
        }).catch(function () { say('Could not reach the server.'); });
    }

    // --- Wiring ------------------------------------------------------------
    function pickInGroup(group, el) {
        group.querySelectorAll('.auth-choice').forEach(function (b) { b.classList.remove('is-on'); });
        el.classList.add('is-on');
    }

    function init() {
        modal = document.getElementById('authModal');
        if (!modal) return;
        card = modal.querySelector('.auth-card');
        message = document.getElementById('authMessage');
        heading = document.getElementById('authHeading');
        sub = document.getElementById('authSub');

        // Panel-to-panel buttons.
        modal.querySelectorAll('[data-goto]').forEach(function (btn) {
            btn.addEventListener('click', function () { show(btn.getAttribute('data-goto')); });
        });

        var loginForm = document.getElementById('loginForm');
        if (loginForm) loginForm.addEventListener('submit', doLogin);
        var createForm = document.getElementById('createForm');
        if (createForm) createForm.addEventListener('submit', doCreate);
        var profileForm = document.getElementById('profileForm');
        if (profileForm) profileForm.addEventListener('submit', doProfile);

        var pw = document.getElementById('createPassword');
        if (pw) pw.addEventListener('input', paintStrength);

        var resend = document.getElementById('resendBtn');
        if (resend) resend.addEventListener('click', doResend);

        var themes = document.getElementById('themeChoices');
        if (themes) themes.addEventListener('click', function (e) {
            var btn = e.target.closest('.auth-choice');
            if (!btn) return;
            chosenTheme = btn.getAttribute('data-theme');
            pickInGroup(themes, btn);
            // Show the choice immediately — it is the theme they are picking.
            if (window.applyTheme) window.applyTheme(chosenTheme);
        });

        var goals = document.getElementById('goalChoices');
        if (goals) goals.addEventListener('click', function (e) {
            var btn = e.target.closest('.auth-choice');
            if (!btn) return;
            chosenGoal = parseInt(btn.getAttribute('data-goal'), 10) || 100;
            pickInGroup(goals, btn);
        });

        var closeBtn = document.getElementById('closeModalBtn');
        if (closeBtn) closeBtn.addEventListener('click', close);
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
        });

        // The header buttons open the popup at the matching panel.
        var loginBtn = document.getElementById('loginBtn');
        if (loginBtn) loginBtn.addEventListener('click', function (e) { e.stopPropagation(); open('login'); });
        var signupBtn = document.getElementById('signupBtn');
        if (signupBtn) signupBtn.addEventListener('click', function (e) { e.stopPropagation(); open('create'); });

        // Anything on the page that heads for a gated area opens the popup
        // instead when nobody is signed in — the redirect would do it anyway,
        // this just skips the round trip.
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a[href], [data-requires-account]');
            if (!link) return;
            var href = link.getAttribute('href') || '';
            if (!/^\/(dashboard|calendar|goals|growth)\b/.test(href)) return;
            if (document.body.getAttribute('data-signed-in') === '1') return;
            e.preventDefault();
            open('login');
        }, true);

        // Google only when the server says it is configured.
        fetch('/api/auth/providers').then(function (r) { return r.json(); }).then(function (res) {
            if (res && res.google) {
                modal.querySelectorAll('.auth-google-only').forEach(function (el) { el.hidden = false; });
            }
        }).catch(function () { /* leave it hidden */ });

        // Deep links: ?auth=login|create|profile opens straight onto that panel.
        var params = new URLSearchParams(window.location.search);
        var wanted = params.get('auth');
        if (wanted === 'login' || wanted === 'create' || wanted === 'profile') {
            open(wanted);
            if (params.get('next')) {
                sub.textContent = 'You need an account to open that page.';
            }
        }
        if (params.get('verify') === 'invalid') {
            open('login');
            say('That verification link has already been used or expired.');
        }
        var oauth = params.get('oauth');
        if (oauth) {
            open('login');
            say(oauth === 'unconfigured'
                ? 'Google sign-in is not configured on this server yet.'
                : 'Google sign-in did not complete. Try again.');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.AuthFlow = { open: open, close: close };
})();
