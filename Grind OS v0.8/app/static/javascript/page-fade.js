// Smooth single-shot page transitions.
//
// The page starts hidden (CSS gates on <html class="js-fade">, set in the head
// before first paint). Each page calls window.revealPage() once its data has
// finished loading, so the whole page fades in one time — fully populated — with
// no elements popping in or re-adjusting afterward. Internal navigation fades the
// page back out first, so moving between pages reads as one continuous fade.
(function () {
    var root = document.documentElement;
    var revealed = false;

    // Fade the whole page in exactly once, after content is already in place.
    window.revealPage = function revealPage() {
        if (revealed) return;
        revealed = true;
        // Wait two frames so freshly-inserted content is laid out before the
        // fade begins — the page appears as a single finished piece.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                root.classList.add('page-ready');
            });
        });
    };

    // Safety net: never leave the page invisible if init hangs or throws.
    setTimeout(window.revealPage, 3000);

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
        root.classList.add('page-leaving');
        // Drive the fade-out inline so it wins regardless of any other opacity
        // styles a page may set on <body> (e.g. the goals theme switcher).
        document.body.style.transition = 'opacity 0.3s ease';
        document.body.style.opacity = '0';
        setTimeout(function () { window.location.href = url; }, 300);
    });

    // Back/forward cache can restore the page mid-fade; force it visible again.
    window.addEventListener('pageshow', function (e) {
        if (!e.persisted) return;
        root.classList.remove('page-leaving');
        root.classList.add('page-ready');
        document.body.style.opacity = '';
        document.body.style.transition = '';
    });
})();
