// main.js - Handles main page features (slider, auth UI)

// Global state
let currentSlide = 1;
const totalSlides = 4;

// Theming (light/dark) is handled globally by theme.js — sourced from users.json
// for logged-in users, device-only for guests.

// --- Slider Logic ---
function changeSlide(direction) {
    const currentSlideEl = document.getElementById(`slide${currentSlide}`);
    if (currentSlideEl) {
        currentSlideEl.classList.remove('active');
    }

    currentSlide += direction;
    if (currentSlide > totalSlides) currentSlide = 1;
    if (currentSlide < 1) currentSlide = totalSlides;

    const newSlideEl = document.getElementById(`slide${currentSlide}`);
    if (newSlideEl) {
        newSlideEl.classList.add('active');
    }
}

// --- Auth UI Logic ---
// The account popup (choose → log in / create → verify → complete profile) is
// auth-flow.js's job; it owns #authModal and the header's Log In / Sign Up
// buttons. What stays here is the signed-in header state and logging out.

// --- User Session Logic ---
function showGreeting(username) {
    const authButtons = document.getElementById('authButtons');
    const greetingDiv = document.getElementById('userGreeting');
    const greetingText = document.getElementById('greetingText');

    if (authButtons) authButtons.classList.add('hidden');
    if (greetingDiv) greetingDiv.classList.remove('hidden');
    if (greetingText) greetingText.textContent = `Hello, ${username}`;
}

function logout() {
    localStorage.removeItem('currentUser');

    // Clear the server-side session so the root route stops redirecting to the dashboard.
    fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .catch(err => console.error('Error clearing session:', err));

    const authButtons = document.getElementById('authButtons');
    const greetingDiv = document.getElementById('userGreeting');

    if (authButtons) authButtons.classList.remove('hidden');
    if (greetingDiv) greetingDiv.classList.add('hidden');

    // No account signed in now: the server cleared the theme cookie, so fall back
    // to light (logged-out pages are light).
    if (window.applyTheme) {
        window.applyTheme('light');
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Theme is initialised by theme.js.

    // Date Init
    const dateElement = document.getElementById('dateDisplay');
    if (dateElement) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        dateElement.innerText = today.toLocaleDateString('en-US', options);
    }

    // User Session Init
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        showGreeting(currentUser);
    }

    // Event Listeners
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const dashboardBtn = document.getElementById('dashboardBtn');
    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            const urls = document.getElementById('urls');
            if (urls) window.location.href = urls.dataset.dashboard;
        });
    }

    const calendarBtn = document.getElementById('calendarBtn');
    if (calendarBtn) {
        calendarBtn.addEventListener('click', () => {
            const urls = document.getElementById('urls');
            if (urls) window.location.href = urls.dataset.calendar;
        });
    }

    const prevSlideBtn = document.getElementById('prevSlideBtn');
    if (prevSlideBtn) prevSlideBtn.addEventListener('click', () => changeSlide(-1));

    const nextSlideBtn = document.getElementById('nextSlideBtn');
    if (nextSlideBtn) nextSlideBtn.addEventListener('click', () => changeSlide(1));
});
