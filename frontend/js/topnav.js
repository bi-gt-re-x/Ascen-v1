// The account menu behind the top bar's avatar: the username, Log Out, and the
// picker holding all fifty profile pictures.
//
// The markup is rendered by partials/topnav.html, so this only wires it up.
// Loaded by that partial too, which keeps including the partial the whole
// integration — the same rule the bar's active pill follows.
(function () {
    'use strict';

    var button = document.getElementById('accountMenuBtn');
    var menu = document.getElementById('accountMenu');
    if (!button || !menu) return;

    var avatarImg = document.getElementById('topnavAvatar');
    var picker = document.getElementById('accountAvatars');
    var logout = document.getElementById('accountLogout');

    // --- open / close -------------------------------------------------------
    function setOpen(open) {
        menu.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) centreCurrent();
    }

    // Open the row on the picture the account is wearing, however far along the
    // fifty it sits, rather than always at the first. Measured off the two
    // rectangles and applied to scrollLeft — scrollIntoView only nudged the row
    // a few pixels here, and this says exactly what it means anyway.
    function centreCurrent() {
        var current = picker && picker.querySelector('.is-current');
        if (!current) return;
        var row = picker.getBoundingClientRect();
        var box = current.getBoundingClientRect();
        picker.scrollLeft += (box.left - row.left) - (picker.clientWidth - box.width) / 2;
    }

    button.addEventListener('click', function (event) {
        event.stopPropagation();
        setOpen(menu.hidden);
    });

    // A click anywhere else closes it; a click inside must not.
    menu.addEventListener('click', function (event) { event.stopPropagation(); });
    document.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !menu.hidden) {
            setOpen(false);
            button.focus();
        }
    });

    // --- picking a picture --------------------------------------------------
    if (picker) {
        picker.addEventListener('click', function (event) {
            var option = event.target.closest('.account-avatar-option');
            if (!option) return;

            var name = option.dataset.avatar;
            var previous = picker.querySelector('.is-current');
            if (previous === option) return;

            // Move the tick and the bar's own picture straight away; the
            // request only has to confirm it. A failure puts them back.
            mark(option);
            var was = avatarImg && avatarImg.src;
            if (avatarImg) avatarImg.src = '/static/images/avatars/' + name + '.svg';

            fetch('/api/avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: name })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data && data.success) return;
                    throw new Error((data && data.message) || 'Could not save');
                })
                .catch(function (err) {
                    console.error('Could not save the profile picture:', err);
                    if (previous) mark(previous);
                    if (avatarImg && was) avatarImg.src = was;
                });
        });
    }

    function mark(option) {
        picker.querySelectorAll('.account-avatar-option').forEach(function (el) {
            var on = el === option;
            el.classList.toggle('is-current', on);
            el.setAttribute('aria-checked', on ? 'true' : 'false');
        });
    }

    // --- logging out --------------------------------------------------------
    if (logout) {
        logout.addEventListener('click', function () {
            logout.disabled = true;
            fetch('/api/logout', { method: 'POST' })
                .catch(function (err) { console.error('Error clearing session:', err); })
                .then(function () {
                    // Every page reads the account out of localStorage; leaving
                    // it behind would sign the next visitor back in locally.
                    try { localStorage.removeItem('currentUser'); } catch (e) { /* ignore */ }
                    window.location.href = '/home';
                });
        });
    }
})();
