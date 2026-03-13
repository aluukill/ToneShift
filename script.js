/* ============================================================
   ToneShift — AI Text Transformer
   ============================================================
   Transforms user text into three AI-generated variations:
   1. Professional  — polished, formal tone
   2. Casual Gen-Z  — modern, friendly tone
   3. AI Prompt     — optimized prompt for coding agents

   Tech: Vanilla HTML / CSS / JS + OpenRouter API
   Design: Neo-Brutalism
   ============================================================ */


// ---------- API Configuration ----------
// API key is now stored server-side in Vercel environment variables
// The frontend calls our own /api/transform endpoint
const API_ENDPOINT = '/api/transform';  // Vercel serverless function
const MAX_CHARS = 5000;


// ---------- DOM References ----------

const userInput      = document.getElementById('user-input');
const transformBtn   = document.getElementById('transform-btn');
const charCount      = document.getElementById('char-count');
const toastContainer = document.getElementById('toast-container');

const outputBoxes = {
  professional: document.getElementById('professional-text'),
  casual:       document.getElementById('casual-text'),
  prompt:       document.getElementById('prompt-text'),
};

const outputCards = {
  professional: document.getElementById('output-professional'),
  casual:       document.getElementById('output-casual'),
  prompt:       document.getElementById('output-prompt'),
};

const copyButtons = document.querySelectorAll('.copy-btn');


// ---------- Toast Notifications ----------

/**
 * Show a small toast notification at the bottom-right.
 * @param {string} message - Text to display
 * @param {'success'|'error'} type - Toast variant
 * @param {number} duration - Auto-dismiss in ms (default 2000)
 */
function showToast(message, type = 'success', duration = 2000) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}


// ---------- Character Counter ----------

/**
 * Update the character count display.
 */
function updateCharCount() {
  const len = userInput.value.length;
  charCount.textContent = `${len.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
}


// ---------- UI Helpers ----------

/**
 * Set placeholder text inside an output box.
 */
function setPlaceholder(box, message) {
  box.innerHTML = `<p class="placeholder-text">${message}</p>`;
}

/**
 * Set real content inside an output box.
 */
function setOutputContent(box, text) {
  box.innerHTML = '';
  box.textContent = text;
}

/**
 * Reset all output boxes to their default placeholder state.
 */
function resetOutputs() {
  setPlaceholder(outputBoxes.professional, 'Your professional version will appear here.');
  setPlaceholder(outputBoxes.casual,       'Your casual version will appear here.');
  setPlaceholder(outputBoxes.prompt,       'Your optimized AI prompt will appear here.');
}

/**
 * Show an animated loading state in all output boxes.
 */
function showLoading() {
  const loadingHTML = `
    <div class="loading-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  Object.values(outputBoxes).forEach(box => {
    box.innerHTML = loadingHTML;
  });
}

/**
 * Display a user-facing error in all output boxes.
 */
function showError(message) {
  Object.values(outputBoxes).forEach(box => {
    box.innerHTML = `<p class="error-text">${message}</p>`;
  });
}

/**
 * Validate that the user has entered text.
 * Returns the trimmed input or null if empty.
 */
function getValidatedInput() {
  const text = userInput.value.trim();

  if (!text) {
    userInput.classList.add('input-error');
    userInput.focus();
    showToast('Please enter some text first.', 'error');
    return null;
  }

  userInput.classList.remove('input-error');
  return text;
}

/**
 * Check that the API endpoint has been configured.
 * Returns true if valid, false otherwise.
 */
function isApiKeyConfigured() {
  if (!API_ENDPOINT) {
    showError('API endpoint not configured. Please deploy to Vercel.');
    showToast('Missing API endpoint!', 'error');
    return false;
  }
  return true;
}


// ---------- Card Reveal ----------

/**
 * Trigger a staggered slide-in animation on all output cards.
 */
function revealCards() {
  const cards = Object.values(outputCards);
  cards.forEach((card, i) => {
    card.classList.remove('reveal');

    // Force reflow so the animation restarts
    void card.offsetWidth;

    setTimeout(() => {
      card.classList.add('reveal');
    }, i * 120);   // 120ms stagger between cards
  });
}


// ---------- Button State ----------

/**
 * Disable / enable the transform button during processing.
 */
function setButtonLoading(isLoading) {
  transformBtn.disabled = isLoading;
  if (isLoading) {
    transformBtn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Transforming...';
  } else {
    transformBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
      <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg> Transform Text`;
  }
}


// ---------- Copy to Clipboard ----------

/**
 * Copy the text content of a target output box to the clipboard.
 */
function handleCopy(button) {
  const targetId = button.getAttribute('data-target');
  const targetBox = document.getElementById(targetId);

  if (!targetBox) return;

  const text = targetBox.textContent.trim();

  // Don't copy placeholder / loading text
  if (!text || targetBox.querySelector('.placeholder-text') || targetBox.querySelector('.error-text') || targetBox.querySelector('.loading-dots')) {
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const btnHTML = button.innerHTML;
    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    button.classList.add('copied');

    setTimeout(() => {
      button.innerHTML = btnHTML;
      button.classList.remove('copied');
    }, 1500);

    showToast('Copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy.', 'error');
  });
}


// ---------- API Call (Serverless) ----------

/**
 * Send the user's text to the serverless API and return the transformed result.
 * The server handles the OpenRouter API call securely.
 */
async function callTransformAPI(userText, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: userText,
        }),
      });

      if (response.status === 429 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const msg = errorBody?.error || `API error ${response.status}`;
        throw new Error(msg);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Transformation failed.');
      }
      
      // Return the sections from the server response
      return data.sections || data.raw || '';

    } catch (error) {
      if (error.message.includes('429') && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}


// ---------- Response Parser ----------

/**
 * Check whether the parsed result has at least one non-empty section.
 */
function hasValidSections(sections) {
  return Object.values(sections).some(v => v.length > 0);
}


// ---------- Transform Handler ----------

/**
 * Main handler — triggered when the user clicks "Transform Text".
 * Calls the serverless API which securely handles OpenRouter,
 */
async function handleTransform() {
  const text = getValidatedInput();
  if (!text) return;

  // Guard: check API key before making the call
  if (!isApiKeyConfigured()) {
    return;
  }

  setButtonLoading(true);
  showLoading();

  try {
    // Call our serverless API which handles OpenRouter securely
    const sections = await callTransformAPI(text);
    
    // Check if we got valid sections
    if (sections && typeof sections === 'object' && hasValidSections(sections)) {
      // Place each parsed section into its output box
      setOutputContent(outputBoxes.professional, sections.professional || '—');
      setOutputContent(outputBoxes.casual,       sections.casual       || '—');
      setOutputContent(outputBoxes.prompt,       sections.prompt       || '—');
    } else {
      // Fallback: dump raw response into Professional box
      setOutputContent(outputBoxes.professional, sections || '—');
      setPlaceholder(outputBoxes.casual, 'Could not parse the casual section.');
      setPlaceholder(outputBoxes.prompt, 'Could not parse the prompt section.');
    }

    // Animate cards into view
    revealCards();

  } catch (error) {
    console.error('ToneShift error:', error);
    const errorMsg = error.message || 'Unknown error';
    showError(`Error: ${errorMsg}`);
    showToast('Transformation failed.', 'error');
  } finally {
    setButtonLoading(false);
  }
}


// ---------- Event Listeners ----------

// Transform button click
transformBtn.addEventListener('click', handleTransform);

// Keyboard shortcut: Ctrl + Enter to transform
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleTransform();
  }
});

// Update character counter on input
userInput.addEventListener('input', () => {
  userInput.classList.remove('input-error');
  updateCharCount();
});

// Attach copy handlers
copyButtons.forEach(btn => {
  btn.addEventListener('click', () => handleCopy(btn));
});

// Initialize character count on load
updateCharCount();
