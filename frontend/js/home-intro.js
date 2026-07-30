/* home-intro.js — the landing page's opening.
 *
 * A single timeline, run once when the page loads:
 *
 *      0ms   the black curtain starts lifting (600ms)
 *    260ms   the logo begins drawing itself, stroke first, then its fill
 *    420ms   the greeting rises
 *    560ms   the date follows it
 *    700ms   the headline arrives a word at a time, 55ms apart
 *      +150  the subtitle rises behind the last word
 *      +150  the buttons grow from 92% to full size
 *   1360ms   the logo glows for a second and settles
 *
 * How the "before" state is handled matters more than the timings. Everything
 * is written in CSS in its *finished* form; this script adds `.hm-armed` to the
 * page, which is what puts the pieces back to their starting position, and
 * removes it a frame later to let them all transition forward. So if this file
 * fails to parse, never loads, or the machine asks for less motion, the hero is
 * simply the hero — there is no state in which the page is left blank waiting
 * for a script.
 *
 * The headline is split into words here rather than in the template, so the
 * markup stays readable and the <em> around "Only" survives the split.
 */
(function () {
    'use strict';

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var T = {
        curtain: 0,
        logo: 260,
        greeting: 420,
        date: 560,
        headline: 700,
        wordGap: 55,
        subAfter: 150,      // after the last word starts
        buttonsAfter: 150,  // after the subtitle
        glow: 1360
    };

    document.addEventListener('DOMContentLoaded', function () {
        var hero = document.querySelector('.lp-hero');
        if (!hero) return;

        var logo = inlineLogo();
        var greet = addGreeting();
        var date = document.querySelector('.lp-eyebrow');
        var title = document.querySelector('.lp-hero-title');
        var sub = document.querySelector('.lp-hero-sub');
        var actions = document.querySelector('.lp-hero-actions');

        setupButtonGlow();

        if (reduced) return;   // everything above is static and already correct

        var words = title ? splitWords(title) : [];

        // Arm: CSS moves every piece back to its starting position.
        document.documentElement.classList.add('hm-armed');

        var curtain = raiseCurtain();

        // Two frames, so the browser has certainly painted the armed state
        // before the delays that release it are applied.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (curtain) curtain.classList.add('hm-lift');

                if (logo) {
                    delay(logo.stroke, T.logo);
                    delay(logo.foot, T.logo);
                }
                delay(greet, T.greeting);
                delay(date, T.date);

                words.forEach(function (w, i) {
                    delay(w, T.headline + i * T.wordGap);
                });

                var lastWord = T.headline + Math.max(0, words.length - 1) * T.wordGap;
                delay(sub, lastWord + T.subAfter);
                delay(actions, lastWord + T.subAfter + T.buttonsAfter);

                // Disarm on the next frame: the delays are already on the
                // elements, so each one starts when its turn comes.
                requestAnimationFrame(function () {
                    document.documentElement.classList.remove('hm-armed');
                });
            });
        });

        if (logo) {
            setTimeout(function () {
                logo.svg.classList.add('hm-glow');
                logo.svg.addEventListener('animationend', function () {
                    logo.svg.classList.remove('hm-glow');
                }, { once: true });
            }, T.glow);
        }

        // Take the curtain out of the document once it has finished, rather
        // than leaving a full-screen element on top of the page forever.
        if (curtain) {
            setTimeout(function () { curtain.remove(); }, 900);
        }
    });

    function delay(el, ms) {
        if (el) el.style.transitionDelay = ms + 'ms';
    }

    // --- the curtain ---------------------------------------------------------
    function raiseCurtain() {
        var el = document.createElement('div');
        el.className = 'hm-curtain';
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
        return el;
    }

    // --- the logo ------------------------------------------------------------
    /* The brand mark is an <img>, which cannot be drawn stroke by stroke. Swap
     * it for the same shape inline, where the path is reachable. The geometry
     * matches utils/images/logo.svg; `currentColor` lets it take the theme's
     * ink instead of the file's fixed #1c1c1c. */
    function inlineLogo() {
        var img = document.querySelector('.brand img');
        if (!img) return null;

        var wrap = document.createElement('span');
        wrap.innerHTML =
            '<svg class="brand-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" ' +
            'role="img" aria-label="Ascen logo">' +
            '<path class="hm-stroke" fill-rule="evenodd" fill="currentColor" stroke="currentColor" ' +
            'stroke-width="4" stroke-linejoin="round" ' +
            'd="M49 19 L81 80 L17 80 Z M49 49 L63 75 L37 75 Z"/>' +
            '<rect class="hm-foot" x="57" y="57" width="31" height="15" rx="7.5" fill="currentColor" ' +
            'transform="rotate(30 72.5 64.5)"/>' +
            '</svg>';
        var svg = wrap.firstChild;
        img.parentNode.replaceChild(svg, img);

        var stroke = svg.querySelector('.hm-stroke');
        // The dash has to be exactly as long as the outline, or the draw either
        // finishes early or never arrives. Ask the path itself.
        var len = 400;
        try { len = Math.ceil(stroke.getTotalLength()); } catch (e) { /* keep the fallback */ }
        svg.style.setProperty('--hm-len', len);

        return { svg: svg, stroke: stroke, foot: svg.querySelector('.hm-foot') };
    }

    // --- the greeting --------------------------------------------------------
    /* The eyebrow carries the date; the greeting goes above it, in its own
     * line, and says the time of day — and the account's name when there is
     * one, which is the closest this page gets to knowing who is reading. */
    function addGreeting() {
        var eyebrow = document.querySelector('.lp-eyebrow');
        if (!eyebrow || document.querySelector('.lp-greet')) return null;

        var hour = new Date().getHours();
        var part = hour < 5 ? 'Good night'
            : hour < 12 ? 'Good morning'
                : hour < 18 ? 'Good afternoon' : 'Good evening';

        var name = '';
        try { name = localStorage.getItem('currentUser') || ''; } catch (e) { /* ignore */ }

        var el = document.createElement('span');
        el.className = 'lp-greet hm-rise';
        el.textContent = name ? part + ', ' + name : part;
        eyebrow.parentNode.insertBefore(el, eyebrow);

        eyebrow.classList.add('hm-rise');
        var sub = document.querySelector('.lp-hero-sub');
        var actions = document.querySelector('.lp-hero-actions');
        if (sub) sub.classList.add('hm-rise');
        if (actions) actions.classList.add('hm-pop');

        return el;
    }

    // --- splitting the headline into words -----------------------------------
    /* Walks the heading and wraps each word in its own span, in place, so the
     * <em> around "Only" keeps its element and its styling. The spaces stay as
     * real text nodes between the spans — wrap them too and the line would stop
     * breaking where it should. */
    function splitWords(root) {
        var words = [];

        function walk(node) {
            var children = Array.prototype.slice.call(node.childNodes);
            children.forEach(function (child) {
                if (child.nodeType === 1) { walk(child); return; }
                if (child.nodeType !== 3) return;

                var text = child.nodeValue;
                if (!text.trim()) return;

                var frag = document.createDocumentFragment();
                // Keep the separators: split on the spaces, not between them.
                text.split(/(\s+)/).forEach(function (piece) {
                    if (!piece) return;
                    if (/^\s+$/.test(piece)) {
                        frag.appendChild(document.createTextNode(piece));
                        return;
                    }
                    var span = document.createElement('span');
                    span.className = 'hm-word';
                    span.textContent = piece;
                    frag.appendChild(span);
                    words.push(span);
                });
                child.parentNode.replaceChild(frag, child);
            });
        }

        walk(root);
        return words;
    }

    // --- the button's cursor glow --------------------------------------------
    /* The light inside the primary buttons follows the pointer across them.
     * Two custom properties, read by .lp-btn-primary::after. */
    function setupButtonGlow() {
        document.querySelectorAll('.lp-btn-primary').forEach(function (btn) {
            btn.addEventListener('pointermove', function (event) {
                var box = btn.getBoundingClientRect();
                btn.style.setProperty('--hm-mx', ((event.clientX - box.left) / box.width * 100) + '%');
                btn.style.setProperty('--hm-my', ((event.clientY - box.top) / box.height * 100) + '%');
            }, { passive: true });
        });
    }
})();
