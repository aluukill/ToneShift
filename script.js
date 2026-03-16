/* ============================================================
   ToneShift — Client Script  v2.0
   ============================================================
   Changes from v1:
   • Transform All: one click runs all 4 text transforms in parallel
   • All output cards are always visible (no hide/show toggle)
   • Per-card loading and error states
   • AI Detector has its own dedicated "Analyze" button
   • Sidebar nav scrolls to + highlights the corresponding card
   • Word count added alongside char count
   • Clear button to reset input
   • Char progress bar with warning colours
   • Sidebar drawer uses transform (not margin) — animatable
   • All bugs from v1 fixed
   ============================================================ */

// ── API ──────────────────────────────────────────────────
const API_ENDPOINT = '/api/transform';
const MAX_CHARS    = 5000;

// ── DOM References ────────────────────────────────────────
const userInput       = document.getElementById('user-input');
const transformBtn    = document.getElementById('transform-btn');
const analyzeBtn      = document.getElementById('analyze-btn');
const clearBtn        = document.getElementById('clear-btn');
const charCountEl     = document.getElementById('char-count');
const wordCountEl     = document.getElementById('word-count');
const charLimitFill   = document.getElementById('char-limit-fill');
const toastContainer  = document.getElementById('toast-container');
const sidebar         = document.getElementById('sidebar');
const sidebarToggle   = document.getElementById('sidebar-toggle');
const mobileMenuBtn   = document.getElementById('mobile-menu-btn');
const themeToggle     = document.getElementById('theme-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const transformStatus = document.getElementById('transform-status');

/** All 4 text-output boxes */
const outputBoxes = {
  professional: document.getElementById('professional-text'),
  casual:       document.getElementById('casual-text'),
  prompt:       document.getElementById('prompt-text'),
  humanize:     document.getElementById('humanize-text'),
  detector:     document.getElementById('detector-text'),
};

/** The card articles */
const outputCards = {
  professional: document.getElementById('output-professional'),
  casual:       document.getElementById('output-casual'),
  prompt:       document.getElementById('output-prompt'),
  humanize:     document.getElementById('output-humanize'),
  detector:     document.getElementById('output-detector'),
};

const copyButtons = document.querySelectorAll('.copy-btn');
const navLinks    = document.querySelectorAll('.nav-link');

// ── Text transform modes (run in parallel) ────────────────
const TRANSFORM_MODES = ['professional', 'casual', 'prompt', 'humanize'];

// ── Theme ─────────────────────────────────────────────────

function initTheme() {
  const stored = localStorage.getItem('toneshift-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', stored);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('toneshift-theme', next);
}

// ── Sidebar ───────────────────────────────────────────────

function initSidebar() {
  const stored = localStorage.getItem('toneshift-sidebar');
  if (stored === 'collapsed') {
    sidebar.classList.add('collapsed');
  }
}

function toggleSidebar() {
  const isCollapsed = sidebar.classList.toggle('collapsed');
  localStorage.setItem('toneshift-sidebar', isCollapsed ? 'collapsed' : 'expanded');
}

function openMobileSidebar() {
  sidebar.classList.add('mobile-open');
  sidebarBackdrop.classList.add('visible');
  mobileMenuBtn.setAttribute('aria-expanded', 'true');
  // Trap focus inside sidebar on mobile
  sidebar.querySelector('a, button')?.focus();
}

function closeMobileSidebar() {
  sidebar.classList.remove('mobile-open');
  sidebarBackdrop.classList.remove('visible');
  mobileMenuBtn.setAttribute('aria-expanded', 'false');
}

function toggleMobileSidebar() {
  if (sidebar.classList.contains('mobile-open')) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

// ── Nav Links ─────────────────────────────────────────────

/**
 * Clicking a nav link scrolls to / highlights that card and
 * closes the mobile sidebar.
 */
function handleNavClick(e) {
  e.preventDefault();

  const targetId = e.currentTarget.getAttribute('data-target');
  const targetEl = document.getElementById(targetId);

  // Update active nav state
  navLinks.forEach(l => {
    l.classList.remove('active');
    l.removeAttribute('aria-current');
  });
  e.currentTarget.classList.add('active');
  e.currentTarget.setAttribute('aria-current', 'true');

  // Scroll to target card
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Brief highlight flash
    targetEl.classList.add('card-highlight');
    setTimeout(() => targetEl.classList.remove('card-highlight'), 900);
  }

  // Close mobile sidebar
  closeMobileSidebar();
}

// ── Counters ──────────────────────────────────────────────

function updateCounters() {
  const len   = userInput.value.length;
  const words = userInput.value.trim()
    ? userInput.value.trim().split(/\s+/).length
    : 0;

  charCountEl.textContent = `${len.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  wordCountEl.textContent = `${words.toLocaleString()} word${words !== 1 ? 's' : ''}`;

  // Progress bar
  const pct = (len / MAX_CHARS) * 100;
  charLimitFill.style.width = `${Math.min(pct, 100)}%`;

  if (pct >= 95) {
    charLimitFill.style.background = 'var(--color-error-fg)';
    charCountEl.classList.add('danger');
    charCountEl.classList.remove('warning');
  } else if (pct >= 80) {
    charLimitFill.style.background = 'var(--accent-yellow)';
    charCountEl.classList.add('warning');
    charCountEl.classList.remove('danger');
  } else {
    charLimitFill.style.background = 'var(--accent-blue)';
    charCountEl.classList.remove('warning', 'danger');
  }
}

// ── Toast ─────────────────────────────────────────────────

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'} type
 * @param {number} duration ms before auto-dismiss
 */
function showToast(message, type = 'success', duration = 2800) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  setTimeout(dismiss, duration);
}

// ── UI Helpers ────────────────────────────────────────────

/** Render an empty / placeholder state into a box */
function setEmpty(box, message) {
  box.innerHTML = `<p class="placeholder-text">${message}</p>`;
}

/** Render an error state into a box */
function setError(box, message) {
  box.innerHTML = `<p class="error-text">${escapeHtml(message)}</p>`;
}

/** Render loading dots into a box */
function setLoading(box) {
  box.innerHTML = `
    <div class="loading-dots" aria-label="Loading…" role="status">
      <span></span><span></span><span></span>
    </div>`;
}

/** Render markdown text into a box */
function setContent(box, text) {
  if (!text || typeof text !== 'string') {
    box.textContent = text ?? '';
    return;
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'output-result-content';
  wrapper.innerHTML = marked.parse(text);
  box.innerHTML = '';
  box.appendChild(wrapper);
}

/** Set detector-specific content */
function setDetectorContent(box, data) {
  if (!data) { setPlaceholderDetector(); return; }

  const aiPercent    = data.aiProbability  ?? 0;
  const humanPercent = data.humanProbability ?? (100 - aiPercent);
  const confidence   = data.confidence ?? 85;
  const isAI         = aiPercent > 50;

  const primaryPercent = isAI ? aiPercent : humanPercent;
  const primaryLabel   = isAI ? 'AI Probability' : 'Human Score';
  const primaryClass   = isAI ? 'ai' : 'human';
  const verdict        = isAI ? 'AI-Generated' : 'Human-Written';

  const secondaryValue = isAI ? humanPercent : aiPercent;
  const secondaryLabel = isAI ? 'Human Score' : 'AI Probability';
  const secondaryClass = isAI ? 'human' : 'ai';

  const verdictIconSvg = isAI
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
        <circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/>
       </svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
       </svg>`;

  box.innerHTML = `
    <div class="ai-analysis-panel">
      <div class="analysis-results">

        <div class="analysis-primary">
          <div class="primary-ring${primaryPercent > 70 ? ' glow' : ''}">
            <svg viewBox="0 0 140 140" aria-hidden="true">
              <circle class="ring-bg" cx="70" cy="70" r="65"/>
              <circle class="ring-progress ${primaryClass}" cx="70" cy="70" r="65" data-percent="${primaryPercent}"/>
            </svg>
            <div class="primary-value">
              <span class="primary-percent">${primaryPercent}%</span>
              <span class="primary-label">${primaryLabel}</span>
            </div>
          </div>
          <span class="primary-sublabel">Analysis Result</span>
        </div>

        <div class="analysis-secondary">
          <div class="metric-card">
            <span class="metric-row-value ${secondaryClass === 'human' ? 'low' : 'high'}">${secondaryValue}%</span>
            <span class="metric-row-label">${secondaryLabel}</span>
          </div>
          <div class="metric-card">
            <span class="metric-row-value">${confidence}%</span>
            <span class="metric-row-label">Confidence</span>
          </div>
        </div>

      </div>

      <div class="analysis-verdict" role="status" aria-label="${verdict}">
        <div class="verdict-icon ${isAI ? 'ai' : 'human'}" aria-hidden="true">${verdictIconSvg}</div>
        <div>
          <div class="verdict-text">${verdict}</div>
          <div class="verdict-sub">${isAI
            ? 'Text shows patterns consistent with AI generation'
            : 'Text appears to be naturally human-written'}</div>
        </div>
      </div>

      ${data.details ? `
      <div class="analysis-details">
        <div class="details-title">Analysis Details</div>
        ${Object.entries(data.details).map(([key, value]) => `
          <div class="detail-row">
            <span class="detail-label">${escapeHtml(key)}</span>
            <span class="detail-value ${value.level || ''}">${escapeHtml(String(value.text ?? value))}</span>
          </div>
        `).join('')}
      </div>` : ''}
    </div>`;

  // Animate progress ring
  requestAnimationFrame(() => {
    const ring = box.querySelector('.ring-progress');
    if (ring) {
      const circumference = 408;
      ring.style.strokeDashoffset = circumference - (primaryPercent / 100) * circumference;
    }
  });
}

function setPlaceholderDetector() {
  outputBoxes.detector.innerHTML = `
    <div class="ai-analysis-panel">
      <div class="analysis-empty">
        <div class="empty-ring" aria-hidden="true"></div>
        <p>Enter text above and click <strong>Analyze</strong> to detect AI patterns</p>
      </div>
    </div>`;
}

/** Minimal HTML escape */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Input validation ──────────────────────────────────────

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

function isApiReady() {
  if (!API_ENDPOINT) {
    showToast('API endpoint not configured.', 'error');
    return false;
  }
  return true;
}

// ── Button states ─────────────────────────────────────────

function setTransformLoading(isLoading) {
  transformBtn.disabled = isLoading;
  if (isLoading) {
    transformBtn.innerHTML = `
      <span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>
      <span class="btn-label">Transforming…</span>`;
  } else {
    transformBtn.innerHTML = `
      <svg class="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
      <span class="btn-label">Transform All</span>`;
  }
}

function setAnalyzeLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  if (isLoading) {
    analyzeBtn.innerHTML = `
      <span class="loading-dots" aria-hidden="true"><span></span><span></span><span></span></span>
      Analyzing…`;
  } else {
    analyzeBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      Analyze`;
  }
}

// ── API call ──────────────────────────────────────────────

/**
 * Call the transform API for a single tone.
 * @param {string} userText
 * @param {string} tone
 * @param {number} retries
 * @returns {Promise<string>}
 */
async function callAPI(userText, tone, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, tone }),
      });

      if (response.status === 429 && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || `API error ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Transformation failed.');
      return data.text || data.raw || '';

    } catch (err) {
      if (attempt < retries - 1 && String(err.message).includes('429')) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Parse detector response ───────────────────────────────

function parseDetectorResponse(raw) {
  // Try JSON first
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { /* fall through */ }

  // Extract from markdown text
  const text = String(raw ?? '');
  const aiMatch     = text.match(/\*{0,2}AI\s+Probability\*{0,2}\s*[:：]\s*(\d+)/i);
  const humanMatch  = text.match(/\*{0,2}Human\s+(?:Score|Probability)\*{0,2}\s*[:：]\s*(\d+)/i);
  const confMatch   = text.match(/\*{0,2}Confidence\*{0,2}\s*[:：]\s*(\w+)/i);

  const aiProb    = aiMatch    ? parseInt(aiMatch[1])   : null;
  const humanProb = humanMatch ? parseInt(humanMatch[1]): null;
  const confRaw   = confMatch  ? confMatch[1].toLowerCase() : 'medium';

  const confMap   = { low: 60, medium: 75, high: 90 };
  const confVal   = confMap[confRaw] ?? parseInt(confRaw) ?? 75;

  if (aiProb === null && humanProb === null) {
    return { aiProbability: 50, humanProbability: 50, confidence: confVal };
  }

  const ai    = aiProb    !== null ? aiProb    : 100 - (humanProb ?? 50);
  const human = humanProb !== null ? humanProb : 100 - ai;

  return { aiProbability: ai, humanProbability: human, confidence: confVal };
}

// ── Transform All ─────────────────────────────────────────

async function handleTransformAll() {
  const text = getValidatedInput();
  if (!text) return;
  if (!isApiReady()) return;

  // Mark all transform cards as loading
  TRANSFORM_MODES.forEach(mode => {
    const card = outputCards[mode];
    const box  = outputBoxes[mode];
    if (card) card.classList.add('loading');
    if (box)  setLoading(box);
  });

  setTransformLoading(true);
  setStatus('running', 'Transforming…');

  // Run all 4 transforms in parallel
  const results = await Promise.allSettled(
    TRANSFORM_MODES.map(mode => callAPI(text, mode))
  );

  let successCount = 0;
  let errorCount   = 0;

  results.forEach((result, i) => {
    const mode = TRANSFORM_MODES[i];
    const card = outputCards[mode];
    const box  = outputBoxes[mode];

    if (card) {
      card.classList.remove('loading');
      card.classList.remove('has-result');
    }

    if (result.status === 'fulfilled') {
      const content = result.value || '—';
      setContent(box, content);
      if (card) card.classList.add('has-result');
      successCount++;
    } else {
      setError(box, `Error: ${result.reason?.message || 'Unknown error'}`);
      errorCount++;
    }
  });

  setTransformLoading(false);

  if (errorCount === 0) {
    setStatus('done', `All ${successCount} transforms complete`);
    showToast('All transforms complete!');
  } else if (successCount === 0) {
    setStatus('', '');
    showToast('All transforms failed.', 'error');
  } else {
    setStatus('done', `${successCount} complete, ${errorCount} failed`);
    showToast(`${successCount} transforms complete, ${errorCount} failed.`, 'error');
  }
}

// ── Analyze (AI Detector) ─────────────────────────────────

async function handleAnalyze() {
  const text = getValidatedInput();
  if (!text) return;
  if (!isApiReady()) return;

  const card = outputCards.detector;
  const box  = outputBoxes.detector;

  if (card) card.classList.add('loading');
  setLoading(box);
  setAnalyzeLoading(true);

  try {
    const raw = await callAPI(text, 'detector');
    const data = parseDetectorResponse(raw);
    setDetectorContent(box, data);
    if (card) {
      card.classList.remove('loading');
      card.classList.add('has-result');
    }
    showToast('Analysis complete!');
  } catch (err) {
    setError(box, `Error: ${err.message || 'Analysis failed'}`);
    if (card) card.classList.remove('loading');
    showToast('Analysis failed.', 'error');
  } finally {
    setAnalyzeLoading(false);
    if (card) card.classList.remove('loading');
  }
}

// ── Status helper ─────────────────────────────────────────

function setStatus(state, message) {
  if (!transformStatus) return;
  transformStatus.textContent = message;
  transformStatus.className = 'section-status';
  if (state) transformStatus.classList.add(state);
}

// ── Copy to clipboard ─────────────────────────────────────

function handleCopy(button) {
  const targetId  = button.getAttribute('data-target');
  const targetBox = document.getElementById(targetId);
  if (!targetBox) return;

  // Don't copy if still empty / loading / error
  if (
    targetBox.querySelector('.placeholder-text') ||
    targetBox.querySelector('.error-text') ||
    targetBox.querySelector('.loading-dots') ||
    targetBox.querySelector('.output-empty-state')
  ) return;

  const text = targetBox.textContent?.trim();
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const origHTML = button.innerHTML;
    button.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Copied!`;
    button.classList.add('copied');
    button.setAttribute('aria-label', 'Copied!');

    setTimeout(() => {
      button.innerHTML = origHTML;
      button.classList.remove('copied');
      button.setAttribute('aria-label', 'Copy');
    }, 1600);

    showToast('Copied to clipboard!');
  }).catch(() => showToast('Failed to copy.', 'error'));
}

// ── Clear input ───────────────────────────────────────────

function handleClear() {
  if (!userInput.value.trim()) return;
  userInput.value = '';
  userInput.focus();
  updateCounters();

  // Reset all output cards to empty state
  TRANSFORM_MODES.forEach(mode => {
    const card = outputCards[mode];
    if (card) { card.classList.remove('has-result', 'loading'); }
  });

  const emptyMessages = {
    professional: 'Professional version will appear here',
    casual:       'Casual version will appear here',
    prompt:       'AI prompt will appear here',
    humanize:     'Humanized version will appear here',
  };
  const emptyIcons = {
    professional: 'pro',
    casual:       'casual',
    prompt:       'prompt',
    humanize:     'humanize',
  };
  const iconSvgs = {
    pro:      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>`,
    casual:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    prompt:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    humanize: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  };

  TRANSFORM_MODES.forEach(mode => {
    const box   = outputBoxes[mode];
    const icon  = emptyIcons[mode];
    const label = emptyMessages[mode];
    if (box) {
      box.innerHTML = `
        <div class="output-empty-state">
          <div class="empty-icon empty-icon-${icon}" aria-hidden="true">${iconSvgs[icon]}</div>
          <p>${label}</p>
        </div>`;
    }
  });

  setPlaceholderDetector();
  if (outputCards.detector) outputCards.detector.classList.remove('has-result', 'loading');
  setStatus('', '');

  showToast('Input cleared.');
}

// ── Keyboard shortcuts ────────────────────────────────────

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    handleTransformAll();
  }
  // Escape closes mobile sidebar
  if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
    closeMobileSidebar();
  }
});

// ── Event Listeners ───────────────────────────────────────

transformBtn.addEventListener('click', handleTransformAll);
analyzeBtn.addEventListener('click', handleAnalyze);
clearBtn.addEventListener('click', handleClear);

userInput.addEventListener('input', () => {
  userInput.classList.remove('input-error');
  updateCounters();
});

// Paste event — let browser handle, then update counters
userInput.addEventListener('paste', () => {
  // Defer until after paste is processed
  requestAnimationFrame(updateCounters);
});

copyButtons.forEach(btn => btn.addEventListener('click', () => handleCopy(btn)));

if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
if (themeToggle)   themeToggle.addEventListener('click', toggleTheme);

navLinks.forEach(link => link.addEventListener('click', handleNavClick));

// Close mobile sidebar on backdrop click
sidebarBackdrop.addEventListener('click', closeMobileSidebar);

// ── Init ──────────────────────────────────────────────────

initTheme();
initSidebar();
updateCounters();