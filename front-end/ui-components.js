// ui-components.js
// This file contains functions for displaying UI messages and prompts.

let overlay;
let messageBox;
let messageText;
let messageBoxOkButton; // Renamed to match the ID in HTML

let promptBox;
let promptText;
let promptInput;
let promptOkBtn;
let promptCancelBtn;

let resolvePrompt; // To store the resolve function for the prompt promise

// Ensure DOM elements are available before trying to get them
document.addEventListener('DOMContentLoaded', () => {
    overlay = document.getElementById('overlay');
    messageBox = document.getElementById('messageBox');
    messageText = document.getElementById('messageText');
    messageBoxOkButton = document.getElementById('messageBoxOkButton'); // Get the button by its new ID

    promptBox = document.getElementById('promptBox');
    promptText = document.getElementById('promptText');
    promptInput = document.getElementById('promptInput');
    promptOkBtn = document.getElementById('promptOkBtn');
    promptCancelBtn = document.getElementById('promptCancelBtn');

    // Attach event listener for the main message box OK button here
    if (messageBoxOkButton) {
        messageBoxOkButton.addEventListener('click', hideMessageBox);
    }
});


/**
 * Displays a custom message box.
 * @param {string} message - The message to display.
 * @param {boolean} [isConfirm=false] - If true, displays OK/Cancel buttons for confirmation.
 * @param {Function} [onConfirmCallback] - Callback function if OK is pressed for a confirmation.
 */
export function showMessageBox(message, isConfirm = false, onConfirmCallback = null) {
    // Check if elements are available, if not, fallback to alert
    if (!messageBox || !overlay || !messageText) {
        console.error("MessageBox DOM elements not found. Falling back to alert.");
        alert(message); // Fallback if DOM elements aren't ready
        return;
    }

    messageText.textContent = message;
    messageBox.classList.remove('hidden');
    overlay.classList.remove('hidden');

    // The event listener for messageBoxOkButton is now permanently attached in DOMContentLoaded
    // We just need to manage its text content if it's used for confirmation (though showPromptBox is preferred)
    if (messageBoxOkButton) {
        // If it's a confirmation, change button behavior dynamically
        if (isConfirm) {
            messageBoxOkButton.textContent = "Confirm"; // Or "Yes"
            // Temporarily remove and re-add listener for specific confirmation logic
            messageBoxOkButton.removeEventListener('click', hideMessageBox);
            messageBoxOkButton.addEventListener('click', () => {
                hideMessageBox();
                if (onConfirmCallback) onConfirmCallback(true);
            }, { once: true }); // Use { once: true } to auto-remove after one click
        } else {
            messageBoxOkButton.textContent = "OK"; // Reset text for simple alert
            // Ensure the default hideMessageBox listener is active if it was removed
            messageBoxOkButton.removeEventListener('click', hideMessageBox); // Remove any old ones
            messageBoxOkButton.addEventListener('click', hideMessageBox); // Re-add default
        }
    }
}

/**
 * Hides the custom message box and overlay.
 */
export function hideMessageBox() {
    if (messageBox) messageBox.classList.add('hidden');
    if (overlay) overlay.classList.add('hidden');
    // Clear prompt input and listeners if promptBox was active
    if (promptInput) promptInput.value = '';
    // Prompt buttons' listeners are managed within showPromptBox, but ensure they are cleared
    if (promptOkBtn) promptOkBtn.onclick = null;
    if (promptCancelBtn) promptCancelBtn.onclick = null;
    if (promptInput) promptInput.onkeypress = null;
}


/**
 * Displays a custom prompt box for user input.
 * @param {string} message - The message to display in the prompt.
 * @param {string} [defaultValue=''] - The default value for the input field.
 * @returns {Promise<string|null>} A promise that resolves with the user's input string or null if cancelled.
 */
export function showPromptBox(message, defaultValue = '') {
    return new Promise(resolve => {
        // Check if elements are available, if not, fallback to window.prompt
        if (!promptBox || !overlay || !promptText || !promptInput || !promptOkBtn || !promptCancelBtn) {
            console.error("PromptBox DOM elements not found. Falling back to window.prompt.");
            const result = prompt(message, defaultValue);
            resolve(result);
            return;
        }

        promptText.textContent = message;
        promptInput.value = defaultValue;
        promptInput.focus(); // Focus the input for user convenience

        // Clear previous listeners
        promptOkBtn.onclick = null;
        promptCancelBtn.onclick = null;
        promptInput.onkeypress = null; // Clear previous keypress listener

        // Display the prompt box
        promptBox.classList.remove('hidden');
        overlay.classList.remove('hidden');

        resolvePrompt = resolve; // Store the resolve function

        promptOkBtn.onclick = () => {
            hideMessageBox(); // This hides the overlay too
            resolvePrompt(promptInput.value);
        };

        promptCancelBtn.onclick = () => {
            hideMessageBox(); // This hides the overlay too
            resolvePrompt(null); // Resolve with null if cancelled
        };

        // Allow pressing Enter key to submit
        promptInput.onkeypress = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default Enter behavior (e.g., form submission)
                promptOkBtn.click(); // Trigger the OK button click
            }
        };
    });
}
