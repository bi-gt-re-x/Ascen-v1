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

// Add keyboard shortcuts help tooltip
function addKeyboardShortcutsHelp() {
    const timerSection = document.querySelector('.timer-section');
    if (!timerSection) return;

    const helpDiv = document.createElement('div');
    helpDiv.className = 'keyboard-shortcuts-help';
    helpDiv.innerHTML = `
        <div class="help-title">Keyboard Shortcuts:</div>
        <div class="help-item">↑/↓/←/→: Adjust by 1</div>
        <div class="help-item">Page Up/Down: Adjust by 5-10</div>
        <div class="help-item">Home/End: Min/Max values</div>
        <div class="help-item">0-9: Direct input</div>
    `;
    
    // Style the help section
    helpDiv.style.cssText = `
        margin-top: 10px;
        padding: 8px;
        background: #f8f9fa;
        border-radius: 4px;
        font-size: 11px;
        color: #6c757d;
    `;
    
    timerSection.appendChild(helpDiv);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Add enhanced keyboard support to all sliders
    addSliderKeyboardSupport('timerHours');
    addSliderKeyboardSupport('timerMinutes');
    addSliderKeyboardSupport('timerSeconds');
    addSliderKeyboardSupport('xpSlider');
});
