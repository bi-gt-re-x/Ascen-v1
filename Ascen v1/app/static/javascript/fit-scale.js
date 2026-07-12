/* fit-scale.js — proportional "zoom to fit" for fixed-design stages.
 *
 * An element marked with data-fit-width="N" is laid out at its native N-px
 * design width (its original desktop composition, untouched) and then zoomed
 * as a whole so it fits the viewport — shrinking on small screens, growing to
 * fill large ones — keeping identical proportions at every size.
 *
 * Add data-fit-height to also bound the zoom by the viewport height, so the
 * element shrinks to fit the whole screen (contain) instead of scaling up past
 * the bottom. Use it for one-screen panels (e.g. Goals); leave it off for tall,
 * scrolling content (e.g. the Growth ratings report).
 *
 * Below PHONE_MAX the zoom is removed so the page's own stacked/mobile CSS
 * takes over (a shrunk desktop layout is unreadable on a phone).
 *
 * Uses CSS `zoom`, which reflows layout (so document height and the elements
 * below stay correct) rather than `transform: scale`, which would leave a gap.
 */
(function () {
    'use strict';

    var PHONE_MAX = 900;   // px: below this, stack instead of zoom
    var MIN_SCALE = 0.5;
    var MAX_SCALE = 3;     // sanity cap so 5K/8K don't zoom to absurdity
    var V_RESERVE = 118;   // px reserved for top margin + floating bottom nav
    var V_FILL = 0.95;     // height-fit fills 95% of the free height, leaving a
                           // consistent ~5% gap at the bottom on every layout
    var V_RESERVE_SHRINK = 134; // px reserved for margins + the in-flow bottom nav
                                // (measured ~26px above + ~106px below) so the
                                // shrunk report and the nav both fit on screen

    function fitOne(el) {
        var design = parseFloat(el.getAttribute('data-fit-width'));
        if (!design) return;

        var vw = document.documentElement.clientWidth;
        if (vw < PHONE_MAX) {
            el.style.zoom = '';           // hand back to the mobile CSS
            return;
        }

        // Leave a little breathing room and account for a scrollbar.
        var available = Math.min(vw * 0.96, vw - 32);
        var scale = available / design;

        // Optionally also fit the viewport height, so a one-screen panel shrinks
        // to fit rather than growing past the bottom. Measure the natural height
        // with our own zoom cleared first.
        if (el.hasAttribute('data-fit-height')) {
            el.style.zoom = '';
            var naturalH = el.offsetHeight;
            if (naturalH > 0) {
                var availableH = (document.documentElement.clientHeight - V_RESERVE) * V_FILL;
                scale = Math.min(scale, availableH / naturalH);
            }
        }

        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        el.style.zoom = String(scale);
    }

    // Shrink-to-height only: keep the element's own (fluid) width, but if it's
    // taller than the viewport, zoom it down proportionally so it fits. Never
    // grows (scale capped at 1), so on tall/portrait screens it's left alone and
    // the page scrolls as normal. Used for the Growth ratings report on wide
    // landscape screens.
    function fitShrinkHeight(el) {
        var vw = document.documentElement.clientWidth;
        if (vw < PHONE_MAX) {
            el.style.zoom = '';        // stacked/mobile layout scrolls instead
            return;
        }
        el.style.zoom = '';            // measure the natural (unzoomed) height
        var naturalH = el.offsetHeight;
        if (!naturalH) return;         // hidden (display:none) — nothing to do
        var availableH = document.documentElement.clientHeight - V_RESERVE_SHRINK;
        var scale = availableH / naturalH;
        if (scale >= 1) return;        // already fits — only ever shrink
        el.style.zoom = String(Math.max(MIN_SCALE, scale));
    }

    function fitAll() {
        var els = document.querySelectorAll('[data-fit-width]');
        for (var i = 0; i < els.length; i++) fitOne(els[i]);
        var sh = document.querySelectorAll('[data-fit-shrink-height]');
        for (var k = 0; k < sh.length; k++) fitShrinkHeight(sh[k]);
    }

    // Expose so view toggles (e.g. growth's ratings/analytics swap) can re-fit.
    window.fitScaleRefresh = fitAll;

    window.addEventListener('resize', fitAll);
    window.addEventListener('orientationchange', fitAll);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fitAll);
    } else {
        fitAll();
    }
    fitAll();
})();
