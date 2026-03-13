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

const OPENROUTER_API_KEY = 'OPENROUTER_API_KEY';          // ← Replace with your real key
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'meta-llama/llama-3.1-8b-instruct:free'; // Free model on OpenRouter
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
 * Check that the API key has been configured.
 * Returns true if valid, false otherwise.
 */
function isApiKeyConfigured() {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'OPENROUTER_API_KEY') {
    showError('API key not configured. Please set your OpenRouter API key in script.js.');
    showToast('Missing API key!', 'error');
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
  transformBtn.innerHTML = isLoading 
    ? '<span class="loading-dots"><span></span><span></span><span></span></span> Transforming...'
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg> Transform Text`;
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
    const originalHTML = button.innerHTML;
    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
    button.classList.add('copied');

    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('copied');
    }, 1500);

    showToast('Copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy.', 'error');
  });
}


// ---------- AI Prompt Builder ----------

/**
 * Build the system + user messages for the OpenRouter API call.
 * The system prompt instructs the model to return three clearly
 * delimited sections so we can parse them.
 */
function buildMessages(userText) {
  const systemPrompt = `You are ToneShift, a text transformation assistant.

Given the user's text, produce exactly THREE rewritten versions.
Return them in this EXACT format — use the markers exactly as shown,
each on its own line, followed by the content on the next line(s).

PROFESSIONAL:
<A polished, professional version suitable for emails, clients, bosses, or formal communication. Fix grammar, improve clarity, and elevate the tone.>

CASUAL:
<A casual, modern, Gen-Z-friendly version. Fix errors but keep it relaxed and friendly. Use light slang where appropriate, but keep it readable.>

PROMPT:
<Convert the user's message into a well-structured prompt for an AI coding agent. Understand the user's intent, structure instructions clearly, break complex tasks into phases if necessary, and produce a prompt that gives reliable AI outputs. Do not ask the AI to do everything at once.>

Rules:
- Use the markers PROFESSIONAL:, CASUAL:, and PROMPT: exactly as shown.
- Do NOT wrap the output in markdown code fences or add extra labels.
- Each section should be separated by a blank line.
- Respond ONLY with the three sections, nothing else.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userText },
  ];
}


// ---------- OpenRouter API Call ----------

/**
 * Send the user's text to OpenRouter and return the raw AI response string.
 * Throws on network or API errors.
 */
async function callOpenRouter(userText) {
  const messages = buildMessages(userText);

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer':  window.location.href,
      'X-Title':       'ToneShift',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  // Handle HTTP-level errors
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const msg = errorBody?.error?.message || `API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();

  // Validate that the response contains a message
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from AI model.');
  }

  return content;
}


// ---------- Response Parser ----------

/**
 * Parse the raw AI response into three sections using the
 * PROFESSIONAL: / CASUAL: / PROMPT: markers.
 *
 * Returns an object: { professional, casual, prompt }
 * Each value is a trimmed string, or an empty string if
 * the marker was not found.
 */
function parseResponse(raw) {
  const sections = {
    professional: '',
    casual:       '',
    prompt:       '',
  };

  // Regex captures everything after a marker until the next marker or end-of-string.
  // Flags: case-insensitive (i) + dotAll (s) so . matches newlines.
  const markerPattern = /PROFESSIONAL:\s*(.+?)(?=\nCASUAL:|$)/is;
  const casualPattern = /CASUAL:\s*(.+?)(?=\nPROMPT:|$)/is;
  const promptPattern = /PROMPT:\s*(.+)/is;

  const proMatch    = raw.match(markerPattern);
  const casualMatch = raw.match(casualPattern);
  const promptMatch = raw.match(promptPattern);

  if (proMatch)    sections.professional = proMatch[1].trim();
  if (casualMatch) sections.casual       = casualMatch[1].trim();
  if (promptMatch) sections.prompt       = promptMatch[1].trim();

  return sections;
}

/**
 * Check whether the parsed result has at least one non-empty section.
 */
function hasValidSections(sections) {
  return Object.values(sections).some(v => v.length > 0);
}


// ---------- Transform Handler ----------

/**
 * Main handler — triggered when the user clicks "Transform Text".
 * Calls OpenRouter, parses the response, and fills the output boxes.
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
    const rawResponse = await callOpenRouter(text);
    const sections    = parseResponse(rawResponse);

    if (hasValidSections(sections)) {
      // Place each parsed section into its output box
      setOutputContent(outputBoxes.professional, sections.professional || '—');
      setOutputContent(outputBoxes.casual,       sections.casual       || '—');
      setOutputContent(outputBoxes.prompt,       sections.prompt       || '—');
    } else {
      // Fallback: markers were missing — dump raw response into Professional box
      setOutputContent(outputBoxes.professional, rawResponse);
      setPlaceholder(outputBoxes.casual, 'Could not parse the casual section.');
      setPlaceholder(outputBoxes.prompt, 'Could not parse the prompt section.');
    }

    // Animate cards into view
    revealCards();

  } catch (error) {
    console.error('ToneShift error:', error);
    showError(`Something went wrong: ${error.message}`);
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
