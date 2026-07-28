// Enhanced keyboard support for sliders
function addSliderKeyboardSupport(sliderId) {
    const slider = document.getElementById(sliderId);
    if (!slider) return;

    // Enhanced keyboard event handling
    slider.addEventListener('keydown', function(e) {
        e.preventDefault(); // Prevent default scrolling behavior
        let val = parseInt(this.value);
        let newVal = val;
        const maxVal = parseInt(this.max);
        const minVal = parseInt(this.min);

        // Different increment sizes for different keys
        switch(e.key) {
            case 'ArrowRight':
            case 'ArrowUp':
                newVal = Math.min(val + 1, maxVal);
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                newVal = Math.max(val - 1, minVal);
                break;
            case 'PageUp':
                // Larger increment for faster adjustment
                if (sliderId === 'xpSlider') {
                    newVal = Math.min(val + 10, maxVal);
                } else {
                    newVal = Math.min(val + 5, maxVal);
                }
                break;
            case 'PageDown':
                // Larger decrement for faster adjustment
                if (sliderId === 'xpSlider') {
                    newVal = Math.max(val - 10, minVal);
                } else {
                    newVal = Math.max(val - 5, minVal);
                }
                break;
            case 'Home':
                // Jump to minimum
                newVal = minVal;
                break;
            case 'End':
                // Jump to maximum
                newVal = maxVal;
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                // Direct number input (0-9)
                const digit = parseInt(e.key);
                if (sliderId === 'xpSlider') {
                    newVal = Math.min(digit * 10, maxVal); // 0, 10, 20, ..., 90
                } else {
                    newVal = Math.min(digit, maxVal); // 0-9 for time sliders
                }
                break;
        }

        if (newVal !== val) {
            this.value = newVal;
            // Trigger oninput manually to update display
            this.dispatchEvent(new Event('input'));
        }
    });

    // Add visual feedback for focus
    slider.addEventListener('focus', function() {
        this.style.outline = '2px solid #007bff';
        this.style.outlineOffset = '2px';
    });

    slider.addEventListener('blur', function() {
        this.style.outline = '';
        this.style.outlineOffset = '';
    });

    // Make sliders focusable with tabindex
    if (!slider.hasAttribute('tabindex')) {
        slider.setAttribute('tabindex', '0');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Add enhanced keyboard support to all sliders
    addSliderKeyboardSupport('timerHours');
    addSliderKeyboardSupport('timerMinutes');
    addSliderKeyboardSupport('timerSeconds');
    addSliderKeyboardSupport('xpSlider');
});
