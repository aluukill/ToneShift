/* ============================================================
   ToneShift — AI Text Transformer
   Transforms user text into AI-generated variations.
   Tech: Vanilla HTML/CSS/JS + OpenRouter API
   ============================================================ */


// ---------- API Configuration ----------
const API_ENDPOINT = '/api/transform';
const MAX_CHARS = 5000;

// ---------- DOM References ----------

const userInput      = document.getElementById('user-input');
const transformBtn   = document.getElementById('transform-btn');
const charCount      = document.getElementById('char-count');
const toastContainer = document.getElementById('toast-container');
const sidebar        = document.getElementById('sidebar');
const sidebarToggle  = document.getElementById('sidebar-toggle');
const mobileMenuBtn  = document.getElementById('mobile-menu-btn');
const themeToggle    = document.getElementById('theme-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

const outputBoxes = {
  professional: document.getElementById('professional-text'),
  casual:       document.getElementById('casual-text'),
  prompt:       document.getElementById('prompt-text'),
  humanize:     document.getElementById('humanize-text'),
  detector:     document.getElementById('detector-text'),
};

const outputCards = {
  professional: document.getElementById('output-professional'),
  casual:       document.getElementById('output-casual'),
  prompt:       document.getElementById('output-prompt'),
  humanize:     document.getElementById('output-humanize'),
  detector:     document.getElementById('output-detector'),
};

const copyButtons = document.querySelectorAll('.copy-btn');
const navLinks    = document.querySelectorAll('.nav-link');

// ---------- Theme Management ----------

/**
 * Initialize theme from localStorage or system preference.
 */
function initTheme() {
  const stored = localStorage.getItem('toneshift-theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  } else {
    // Default to dark
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

/**
 * Toggle between light and dark themes.
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('toneshift-theme', next);
}

// ---------- Sidebar ----------

/**
 * Toggle sidebar visibility on desktop.
 */
function toggleSidebar() {
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('toneshift-sidebar', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
}

/**
 * Toggle mobile sidebar.
 */
function toggleMobileSidebar() {
  const isOpen = sidebar.classList.toggle('mobile-open');
  if (isOpen) {
    sidebarBackdrop.classList.add('visible');
  } else {
    sidebarBackdrop.classList.remove('visible');
  }
}

/**
 * Initialize sidebar state from localStorage.
 */
function initSidebar() {
  const stored = localStorage.getItem('toneshift-sidebar');
  if (stored === 'collapsed') {
    sidebar.classList.add('collapsed');
  }
}

// ---------- Navigation Highlighting ----------

/**
 * Handle nav link clicks for smooth scrolling and active state.
 */
function handleNavClick(e) {
  e.preventDefault();
  const targetId = e.currentTarget.getAttribute('data-target');
  const targetEl = document.getElementById(targetId);

  if (targetEl) {
    Object.values(outputCards).forEach(card => card.classList.remove('active'));
    targetEl.classList.add('active');
  }

  navLinks.forEach(link => link.classList.remove('active'));
  e.currentTarget.classList.add('active');

  sidebar.classList.remove('mobile-open');
  sidebarBackdrop.classList.remove('visible');
}

// ---------- Toast Notifications ----------

/**
 * Show a small toast notification.
 * @param {string} message - Text to display
 * @param {'success'|'error'} type - Toast variant
 * @param {number} duration - Auto-dismiss in ms (default 2500)
 */
function showToast(message, type = 'success', duration = 2500) {
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

function updateCharCount() {
  const len = userInput.value.length;
  charCount.textContent = `${len.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
}

// ---------- UI Helpers ----------

function setPlaceholder(box, message) {
  box.innerHTML = `<p class="placeholder-text">${message}</p>`;
}

function setOutputContent(box, text) {
  box.innerHTML = '';
  if (text && typeof text === 'string') {
    const html = marked.parse(text);
    box.innerHTML = html;
  } else {
    box.textContent = text;
  }
}

function setDetectorContent(box, data) {
  if (!data) {
    setPlaceholderDetector();
    return;
  }

  const aiPercent = data.aiProbability || 0;
  const humanPercent = data.humanProbability || (100 - aiPercent);
  const confidence = data.confidence || 85;
  const verdict = aiPercent > 50 ? 'AI-Generated' : 'Human-Written';
  const verdictIcon = aiPercent > 50 
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="8" r="1.5" fill="currentColor"/></svg>';

  box.innerHTML = `
    <div class="ai-analysis-panel">
      <div class="analysis-results">
        <div class="metric-card">
          <div class="metric-ring ${aiPercent > 70 ? 'glow' : ''}">
            <svg viewBox="0 0 84 84">
              <circle class="ring-bg" cx="42" cy="42" r="40"/>
              <circle class="ring-progress ai" cx="42" cy="42" r="40" data-percent="${aiPercent}"/>
            </svg>
            <div class="metric-value">
              <span class="metric-percent">${aiPercent}%</span>
              <span class="metric-label">AI</span>
            </div>
          </div>
          <div class="metric-title">AI Probability</div>
          <div class="metric-desc">Likelihood of AI generation</div>
        </div>
        <div class="metric-card">
          <div class="metric-ring ${humanPercent > 70 ? 'glow' : ''}">
            <svg viewBox="0 0 84 84">
              <circle class="ring-bg" cx="42" cy="42" r="40"/>
              <circle class="ring-progress human" cx="42" cy="42" r="40" data-percent="${humanPercent}"/>
            </svg>
            <div class="metric-value">
              <span class="metric-percent">${humanPercent}%</span>
              <span class="metric-label">Human</span>
            </div>
          </div>
          <div class="metric-title">Human Score</div>
          <div class="metric-desc">Likelihood of human writing</div>
        </div>
        <div class="metric-card">
          <div class="metric-ring ${confidence > 80 ? 'glow' : ''}">
            <svg viewBox="0 0 84 84">
              <circle class="ring-bg" cx="42" cy="42" r="40"/>
              <circle class="ring-progress confidence" cx="42" cy="42" r="40" data-percent="${confidence}"/>
            </svg>
            <div class="metric-value">
              <span class="metric-percent">${confidence}%</span>
              <span class="metric-label">Conf.</span>
            </div>
          </div>
          <div class="metric-title">Confidence</div>
          <div class="metric-desc">Analysis reliability</div>
        </div>
      </div>
      <div class="analysis-verdict">
        <div class="verdict-icon ${aiPercent > 50 ? 'ai' : 'human'}">
          ${verdictIcon}
        </div>
        <div>
          <div class="verdict-text">${verdict}</div>
          <div class="verdict-sub">${aiPercent > 50 ? 'Text shows AI-generated patterns' : 'Text appears naturally written'}</div>
        </div>
      </div>
      ${data.details ? `
      <div class="analysis-details">
        <div class="details-title">Analysis Details</div>
        ${Object.entries(data.details).map(([key, value]) => `
          <div class="detail-row">
            <span class="detail-label">${key}</span>
            <span class="detail-value ${value.level || ''}">${value.text || value}</span>
          </div>
        `).join('')}
      </div>
      ` : ''}
    </div>
  `;

  // Animate the progress rings
  requestAnimationFrame(() => {
    box.querySelectorAll('.ring-progress').forEach(ring => {
      const percent = parseFloat(ring.dataset.percent);
      const circumference = 251.2;
      const offset = circumference - (percent / 100) * circumference;
      ring.style.strokeDashoffset = offset;
    });
  });
}

function resetOutputs() {
  setPlaceholder(outputBoxes.professional, 'Your professional version will appear here.');
  setPlaceholder(outputBoxes.casual, 'Your casual version will appear here.');
  setPlaceholder(outputBoxes.prompt, 'Your optimized AI prompt will appear here.');
  setPlaceholder(outputBoxes.humanize, 'Your humanized version will appear here.');
  setPlaceholderDetector();
}

function setPlaceholderDetector() {
  outputBoxes.detector.innerHTML = `
    <div class="ai-analysis-panel">
      <div class="analysis-empty">
        <div class="empty-ring"></div>
        <p>Enter text to analyze its AI detection probability</p>
      </div>
    </div>
  `;
}

function showLoading() {
  const loadingHTML = `
    <div class="loading-dots">
      <span></span><span></span><span></span>
    </div>
  `;
  const activeNav = document.querySelector('.nav-link.active');
  const tone = activeNav ? activeNav.getAttribute('data-target').replace('output-', '') : 'professional';
  if (outputBoxes[tone]) {
    outputBoxes[tone].innerHTML = loadingHTML;
  }
}

function showError(message) {
  const activeNav = document.querySelector('.nav-link.active');
  const tone = activeNav ? activeNav.getAttribute('data-target').replace('output-', '') : 'professional';
  if (outputBoxes[tone]) {
    outputBoxes[tone].innerHTML = `<p class="error-text">${message}</p>`;
  }
}

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

function isApiKeyConfigured() {
  if (!API_ENDPOINT) {
    showError('API endpoint not configured. Please deploy to Vercel.');
    showToast('Missing API endpoint!', 'error');
    return false;
  }
  return true;
}



// ---------- Button State ----------

function setButtonLoading(isLoading) {
  transformBtn.disabled = isLoading;
  if (isLoading) {
    transformBtn.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span></span> Transforming...';
  } else {
    transformBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
      <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg> Transform`;
  }
}


// ---------- Copy to Clipboard ----------

function handleCopy(button) {
  const targetId = button.getAttribute('data-target');
  const targetBox = document.getElementById(targetId);

  if (!targetBox) return;

  const text = targetBox.textContent.trim();

  if (!text || targetBox.querySelector('.placeholder-text') || targetBox.querySelector('.error-text') || targetBox.querySelector('.loading-dots')) {
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const btnHTML = button.innerHTML;
    button.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Copied!</span>`;
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

// ---------- API Call ----------

async function callTransformAPI(userText, retries = 3) {
  const activeNav = document.querySelector('.nav-link.active');
  const tone = activeNav ? activeNav.getAttribute('data-target').replace('output-', '') : 'professional';

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, tone: tone }),
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
      if (!data.success) throw new Error(data.error || 'Transformation failed.');
      return data.text || data.raw || '';

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

// ---------- Transform Handler ----------

async function handleTransform() {
  const text = getValidatedInput();
  if (!text) return;

  if (!isApiKeyConfigured()) return;

  setButtonLoading(true);
  showLoading();

  try {
    const resultText = await callTransformAPI(text);
    const activeNav = document.querySelector('.nav-link.active');
    const tone = activeNav ? activeNav.getAttribute('data-target').replace('output-', '') : 'professional';

    if (tone === 'detector') {
      // Parse detector result as JSON
      try {
        const detectorData = typeof resultText === 'string' ? JSON.parse(resultText) : resultText;
        setDetectorContent(outputBoxes[tone], detectorData);
      } catch (e) {
        // Fallback if not JSON - treat as regular output
        setOutputContent(outputBoxes[tone], resultText || '—');
      }
    } else {
      setOutputContent(outputBoxes[tone], resultText || '—');
    }
  } catch (error) {
    console.error('ToneShift error:', error);
    showError(`Error: ${error.message || 'Unknown error'}`);
    showToast('Transformation failed.', 'error');
  } finally {
    setButtonLoading(false);
  }
}

// ---------- Event Listeners ----------

// Transform
transformBtn.addEventListener('click', handleTransform);

// Keyboard shortcut: Ctrl + Enter
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleTransform();
  }
});

// Character counter
userInput.addEventListener('input', () => {
  userInput.classList.remove('input-error');
  updateCharCount();
});

// Copy handlers
copyButtons.forEach(btn => btn.addEventListener('click', () => handleCopy(btn)));

// Sidebar toggle
if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

// Mobile menu
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileSidebar);

// Theme toggle
if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

// Nav links
navLinks.forEach(link => link.addEventListener('click', handleNavClick));

// Close mobile sidebar when clicking outside
document.addEventListener('click', (e) => {
  if (e.target === sidebarBackdrop) {
    sidebar.classList.remove('mobile-open');
    sidebarBackdrop.classList.remove('visible');
  }
});

// ---------- Initialize ----------

initTheme();
initSidebar();
updateCharCount();
