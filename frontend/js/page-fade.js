// Smooth single-shot page transitions.
//
// The page starts hidden (CSS gates on <html class="js-fade">, set in the head
// before first paint) and fades in exactly once, fully populated, so nothing
// pops in or re-adjusts afterward. Internal navigation fades back out first, so
// moving between pages reads as one continuous motion.
//
// Two kinds of page use this:
//
//   pages that load data   set window.pageFadeWaitsForData in their head, then
//                          call window.revealPage() once their fetches resolve
//                          (dashboard.js, goal.js)
//   everything else        revealed automatically as soon as the DOM is parsed
//
// Getting that second case wrong is what makes a page hang: a page that never
// calls revealPage() would sit invisible until the safety net below fires.
//
// The durations live in styles/page-fade.css. The one number repeated here is
// the fade-out, because the navigation has to wait for it.
(function () {
    var root = document.documentElement;
    var revealed = false;

    // Keep in step with html.js-fade.page-leaving in styles/page-fade.css.
    var LEAVE_MS = 130;

    // A system-level request for less motion skips both halves.
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Actually show the page. Safe to call more than once — whichever path
    // reaches it first wins and the rest are no-ops.
    function show() {
        if (root.classList.contains('page-ready')) return;
        root.classList.add('page-ready');
        // Drop the compositor hint once the fade has finished, so a long-lived
        // page isn't holding a layer for nothing.
        setTimeout(function () {
            root.classList.add('page-settled');
        }, 260);
    }

    // Fade the whole page in exactly once, after content is already in place.
    window.revealPage = function revealPage() {
        if (revealed) return;
        revealed = true;
        if (still) {
            show();
            root.classList.add('page-settled');
            return;
        }
        // Wait two frames so freshly-inserted content is laid out before the
        // fade begins — the page appears as a single finished piece.
        requestAnimationFrame(function () {
            requestAnimationFrame(show);
        });
        // requestAnimationFrame does not run in a background tab, and the page
        // stays invisible until it does. This is the floor: the fade may begin
        // a frame early, which nobody can see, but it is never left blank.
        setTimeout(show, 250);
    };

    // A page that doesn't wait on data has nothing to wait for: reveal it as
    // soon as the markup is parsed.
    if (!window.pageFadeWaitsForData) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', window.revealPage);
        } else {
            window.revealPage();
        }
    }

    // Safety net: never leave the page invisible if init hangs or throws. It
    // calls show() rather than revealPage(), because a revealPage() whose
    // frames never arrived has already spent the `revealed` flag.
    setTimeout(show, 3000);

    // Fade out before following an internal link.
    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 ||
            e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        var a = e.target.closest ? e.target.closest('a[href]') : null;
        if (!a || a.target || a.hasAttribute('download')) return;

        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#' ||
            /^(mailto:|tel:|javascript:)/i.test(href)) return;
        if (a.origin !== location.origin) return;

        e.preventDefault();
        var url = a.href;

        if (still) {
            window.location.href = url;
            return;
        }

        // page-settled pinned transition: none to stop a finished page from
        // animating again; drop it so the leaving fade can run.
        root.classList.remove('page-settled');
        root.classList.add('page-leaving');
        setTimeout(function () { window.location.href = url; }, LEAVE_MS);
    });

    // Back/forward cache can restore the page mid-fade; force it visible again.
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        root.classList.remove('page-leaving');
        root.classList.add('page-ready', 'page-settled');
        document.body.style.opacity = '';
        document.body.style.transition = '';
    });
})();
