/* pentagon-egg.js — the second clue in the chain.
 *
 * The mysterious quote (unlocked on the dashboard) hints at "a 2 dimensional
 * 5 sided shape on a certain page that is scrollable" — this pentagon in the
 * landing page's Growth Rating card. It only wakes up once that quote has been
 * revealed today. Click it three times: it pops on the first two, and on the
 * third it spins a full turn, after which the whole page shakes, all the cards
 * collapse in on themselves and vanish, and a lone clickable arrow is left.
 */
(function () {
    'use strict';

    function user() {
        return (window.localStorage && localStorage.getItem('currentUser')) || 'Default';
    }
    function todayStr() {
        var d = new Date();
        var p = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    // Gate: the mysterious quote must have shown up today (dashboard easter egg).
    function quoteUnlocked() {
        try { return localStorage.getItem('easterEgg:' + user() + ':' + todayStr()) === '1'; }
        catch (e) { return false; }
    }

    function init() {
        var pent = document.querySelector('.lp-preview-rating .lp-radar');
        if (!pent) return;
        if (!quoteUnlocked()) return;          // stays inert until the quote is found

        pent.style.cursor = 'pointer';
        pent.style.pointerEvents = 'auto';

        var clicks = 0;
        var busy = false;
        pent.addEventListener('click', function () {
            if (busy) return;
            clicks++;
            if (clicks < 3) {
                pent.classList.remove('pentagon-pop');
                void pent.offsetWidth;              // restart the pop
                pent.classList.add('pentagon-pop');
            } else {
                busy = true;
                pent.classList.remove('pentagon-pop');
                void pent.offsetWidth;
                pent.classList.add('pentagon-spin'); // full 360° turn
                setTimeout(collapsePage, 720);       // then the page comes apart
            }
        });
    }

    function collapsePage() {
        var main = document.querySelector('.home-main') || document.body;
        var lp = document.querySelector('.lp');
        if (!lp) return;

        // 1) The whole main page shakes.
        document.documentElement.classList.add('pent-clip');
        main.classList.add('page-quake');

        // 2) The shake settles into a collapse — every card implodes and fades,
        //    and the surrounding chrome (nav, account row, footer) dissolves too
        //    so the whole page empties out.
        setTimeout(function () {
            main.classList.remove('page-quake');
            lp.classList.add('page-collapse');
            document.body.classList.add('pent-void');
        }, 820);

        // 3) Once gone, the page is emptied and a lone arrow is left behind.
        setTimeout(function () {
            lp.style.display = 'none';
            document.documentElement.classList.remove('pent-clip');
            showArrow(lp);
        }, 820 + 900);
    }

    function showArrow(lp) {
        if (document.getElementById('pentArrow')) return;
        var btn = document.createElement('button');
        btn.id = 'pentArrow';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Continue');
        btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<line x1="4" y1="12" x2="18" y2="12"/><polyline points="12 6 18 12 12 18"/></svg>';
        document.body.appendChild(btn);
        requestAnimationFrame(function () { btn.classList.add('show'); });

        // Clickable: for now it gracefully reassembles the page it took apart.
        btn.addEventListener('click', function () {
            btn.classList.remove('show');
            setTimeout(function () {
                btn.remove();
                lp.style.display = '';
                lp.classList.remove('page-collapse');
                document.body.classList.remove('pent-void');
                lp.classList.add('page-restore');
                setTimeout(function () { lp.classList.remove('page-restore'); }, 820);
            }, 380);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
