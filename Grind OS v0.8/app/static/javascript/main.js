// main.js - Handles main page features (slider, auth UI)

// Global state
let currentAuthMode = 'signup';
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
function openAuthModal(mode) {
    currentAuthMode = mode;
    const authModal = document.getElementById('authModal');
    const authTitle = document.getElementById('authTitle');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const authMessage = document.getElementById('authMessage');

    if (authModal) {
        authModal.classList.remove('hidden');
        if (authTitle) authTitle.textContent = mode === 'signup' ? 'Sign Up' : 'Log In';

        // Reset fields
        if (usernameInput) {
            usernameInput.value = '';
            usernameInput.classList.remove('error');
        }
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.classList.remove('error');
        }
        if (confirmPasswordInput) {
            confirmPasswordInput.value = '';
            confirmPasswordInput.classList.remove('error');
        }
        if (authMessage) authMessage.textContent = '';

        if (mode === 'login') {
            if (confirmPasswordInput) {
                confirmPasswordInput.classList.add('hidden');
                confirmPasswordInput.required = false;
            }
        } else {
            if (confirmPasswordInput) {
                confirmPasswordInput.classList.remove('hidden');
                confirmPasswordInput.required = true;
            }
        }
    }
}

function closeAuthModal() {
    const authModal = document.getElementById('authModal');
    const authMessage = document.getElementById('authMessage');

    if (authModal) {
        authModal.classList.add('hidden');
    }
    if (authMessage) {
        authMessage.textContent = '';
    }
}

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

    // No account signed in now: fall back to the guest (device) theme.
    if (window.applyTheme) {
        window.applyTheme(localStorage.getItem('guestTheme') || 'light');
    }
}

// --- Auth Handler ---
async function handleAuth(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const authMessage = document.getElementById('authMessage');

    const username = usernameInput ? usernameInput.value : '';
    const password = passwordInput ? passwordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    // Reset errors
    usernameInput.classList.remove('error');
    passwordInput.classList.remove('error');
    if (confirmPasswordInput) confirmPasswordInput.classList.remove('error');

    if (currentAuthMode === 'signup' && password !== confirmPassword) {
        if (authMessage) authMessage.textContent = "Passwords do not match.";
        passwordInput.classList.add('error');
        confirmPasswordInput.classList.add('error');
        return;
    }

    let result;
    if (currentAuthMode === 'signup') {
        result = await signupAPI(username, password);
    } else {
        result = await loginAPI(username, password);
    }

    if (authMessage) authMessage.textContent = result.message;

    if (result.success) {
        if (currentAuthMode === 'signup') {
            setTimeout(() => {
                openAuthModal('login');
                const msg = document.getElementById('authMessage');
                if (msg) msg.textContent = "Account created! Please log in.";
            }, 1500);
        } else if (currentAuthMode === 'login') {
            setTimeout(() => {
                closeAuthModal();
                localStorage.setItem('currentUser', result.user.username);
                // Adopt this account's saved theme (from users.json) immediately.
                if (window.applyTheme) window.applyTheme(result.user.theme || 'light');
                showGreeting(result.user.username);
            }, 1500);
        }
    } else {
        // Error handling: wiggle and red border
        usernameInput.classList.add('error');
        passwordInput.classList.add('error');
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
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', () => openAuthModal('login'));

    const signupBtn = document.getElementById('signupBtn');
    if (signupBtn) signupBtn.addEventListener('click', () => openAuthModal('signup'));

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeAuthModal);

    const authForm = document.getElementById('authForm');
    if (authForm) authForm.addEventListener('submit', handleAuth);

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

    // Modal Click Outside
    const authModal = document.getElementById('authModal');
    window.onclick = function(event) {
        if (event.target == authModal) {
            closeAuthModal();
        }
    }
});