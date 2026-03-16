/* ============================================================
   ToneShift API — Serverless Function for Vercel
   ============================================================
   Handles AI text transformation on the server side to keep
   the API key hidden from the client.

   Endpoint: /api/transform
   Method: POST
   Body: { "text": "user input text", "tone": "professional|casual|humanize|prompt|detector" }
   ============================================================ */

// Environment variables (set in Vercel dashboard)
// GROQ_API_KEY - Your Groq API key
// https://console.groq.com/keys

// ============================================================================
// Configuration
// ============================================================================

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const AI_MODEL = 'llama-3.3-70b-versatile';
const MAX_CHARS = 5000;

// ============================================================================
// Mode Classification
// ============================================================================

/**
 * Modes are split into three behaviorally distinct categories.
 * Each category gets its own system prompt with rules appropriate
 * for that behaviour. Mixing them into one prompt causes rule conflicts
 * (e.g. "never answer questions" breaking the detector).
 *
 *  TRANSFORM  — Rewrite the input text in a different style.
 *  ANALYZE    — Examine the input and produce a structured report.
 *  GENERATE   — Use the input as intent/context to produce new content.
 */
const MODE_CATEGORY = {
  professional: 'transform',
  casual:       'transform',
  humanize:     'transform',
  detector:     'analyze',
  prompt:       'generate',
};

// ============================================================================
// Tone-Specific Instructions (appended into the relevant system prompt)
// ============================================================================

const TRANSFORM_INSTRUCTIONS = {
  professional: `Rewrite the text into a clear, polished, and sophisticated professional version. 
  
Target Audience: C-suite executives, legal documents, or high-stakes business correspondence.

Guidelines:
- Tone: Confident, authoritative, but never arrogant. Use active voice.
- Precision: Replace vague words (e.g., "good", "fast") with precise business terminology (e.g., "optimal", "expedited").
- Nuance: Preserve subtle emotional cues while smoothing over hostility or informalities.
- Structure: Ensure a logical flow. Use semi-colons or well-placed transitions for a "literary" business feel.
- Negative Constraint: Avoid corporate jargon-stuffing (e.g., "synergy", "paradigm shift") if it doesn't serve a clear purpose.`,

  casual: `Rewrite the text to sound like a natural, high-energy conversation between friends or on social media.

Target Audience: Gen-Z, Alpha, or informal community spaces.

Guidelines:
- Style: Use "text-speak" nuances like lowercase-only for effect, or lowercase first letters.
- Pacing: Mimic the rhythm of instant messaging — use ellipses (...) for trailing thoughts or punchy short sentences.
- Authenticity: Use modern slang (e.g., "lowkey", "fr fr", "vibes") but ONLY where it feels organic. Don't force "fellow kids" energy.
- Punctuation: Use exclamation marks or emojis sparingly but impactfuly.
- Negative Constraint: Absolutely no corporate "friendliness" or fake enthusiasm.`,

  humanize: `Transform the input (likely AI-generated) into text that carries the unique "fingerprint" of a human writer.

Psychological Triggers:
- Burstiness: Vary sentence length dramatically. A very short sentence. Followed by a much longer, more descriptive one that winds through multiple clauses before landing.
- Imperfection: Occasionally use a starting conjunction (But, And, Because) or a fragment for emphasis.
- Perspective: Shift the "distance" of the narrator — zoom in on details, then zoom out to a wider observation.
- Vocabulary: Use "low-frequency" words that a human would know from experience, not just statistical probability.
- Flow: Remove AI markers like "In today's digital landscape" or "Overall, it is important to remember".`,
};

const ANALYZE_INSTRUCTIONS = {
  detector: `Execute a forensic linguistic analysis to detect machine-generated patterns.

Analysis Depth:
- Syntax: Check for mathematically perfect sentence rhythms and repetitive structures.
- Semantic Density: Look for "fluff" — sentences that sound good but contain zero unique information.
- Register Consistency: Does the voice shift naturally? AI often stays in a "safe" medium register.
- Transition Signatures: Flag formulaic transitions like "Furthermore", "Moreover", and "In conclusion".

Scoring Logic:
- 100% is nearly impossible for humans; 0% is nearly impossible for AI. Be precise.
- Low Confidence: Short snippets (<30 words) or highly technical/legal text.
- High Confidence: Long, flowing essays or descriptive stories.

Exact Output Format:
**AI Probability**: [0–100]%
**Confidence**: [Low/Medium/High] — [Contextual reason]

**Top Indicators**:
1. [Pattern Category]: "[Quote from text]" — [Why this is machine-like]
2. [Pattern Category]: "[Quote from text]" — [Why this is machine-like]

**Final Assessment**: [Verdict]
**Linguistic Reasoning**: [Concise, expert explanation of the verdict.]`,
};

const GENERATE_INSTRUCTIONS = {
  prompt: `You are a Senior Prompt Engineer. Your goal is to generate "Zero-Shot" prompts for AI coding agents that minimize hallucination and maximize precision.

Evaluation Phase:
- If the request is a single sentence like "build a chat app", it is INSUFFICIENT.
- You NEED: Tech stack, specific feature list, and UI/UX preferences.

Generation Phase (The "Gold Standard" Prompt):
1. **Persona**: Define the agent's role (e.g., "Expert React Developer").
2. **Task**: A detailed, step-by-step implementation guide.
3. **Context**: Specific libraries, existing file structure, or API endpoints.
4. **Constraints**: Performance limits, browser support, or design tokens.
5. **Expected Output**: Folder structure and specific file content descriptions.

Rules:
- Use Markdown for structure.
- State assumptions clearly.
- If INSUFFICIENT, list EXACTLY what is missing with examples.`,
};

// ============================================================================
// System Prompt Builders
// ============================================================================

/**
 * System prompt for TRANSFORM modes (professional, casual, humanize).
 * Strictly forbids answering, analysing, or conversing — only rewrites.
 */
function buildTransformSystemPrompt(toneInstruction) {
  return `You are ToneShift, a text rewriting tool. You rewrite the user's input text according to the style instructions below. You do nothing else.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES (override everything else)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Your entire output is the rewritten text. Nothing more.
- Do NOT greet the user, explain what you are doing, or add any commentary.
- Do NOT add preamble such as "Here is the rewritten version:" or "Sure!".
- Do NOT answer the content of the text, even if it contains a question.
- Do NOT engage in conversation — the input is raw material to transform, not a message to you.
- Do NOT add, invent, or remove information — only reshape how it is expressed.
- For content that is hateful or offensive: rewrite in a neutral, factual tone that removes hostility while preserving the core subject matter.
- For illegal instructions or content: output exactly → [Content cannot be transformed]
- If you cannot meaningfully transform the text for any other reason: output exactly → [Content cannot be transformed]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLE INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${toneInstruction}`;
}

/**
 * System prompt for ANALYZE modes (detector).
 * Explicitly permits and requires analytical output.
 */
function buildAnalyzeSystemPrompt(analyzeInstruction) {
  return `You are ToneShift's text analysis engine. Your job is to carefully examine the user's text and produce a structured analytical report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Produce ONLY the structured analysis report described in the instructions below.
- Do NOT rewrite the user's text.
- Do NOT add preamble, sign-off, or commentary outside the defined report format.
- Do NOT refuse to analyse legal text, regardless of its content or subject matter.
- Be objective and evidence-based — cite specific examples from the text to support your findings.
- If the text is too short or lacks enough signal for a reliable result, state that clearly within the report rather than guessing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANALYSIS INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${analyzeInstruction}`;
}

/**
 * System prompt for GENERATE modes (prompt).
 * Permits evaluation, reasoning, and content generation.
 */
function buildGenerateSystemPrompt(generateInstruction) {
  return `You are ToneShift's prompt engineering engine. You help users turn rough ideas into high-quality prompts for AI coding agents.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Do NOT solve or implement the user's task yourself.
- Do NOT add preamble such as "Here is your prompt:" or "Sure, I can help with that!".
- Do NOT add closing remarks or commentary after the output.
- Your output is either the generated prompt OR an INSUFFICIENT_CONTEXT response — nothing else.
- Preserve the user's original intent exactly. Do not change what they are trying to accomplish.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${generateInstruction}`;
}

// ============================================================================
// Message Builder
// ============================================================================

/**
 * Build the system + user messages for the OpenRouter API call.
 * Routes to the correct system prompt based on the mode's category,
 * preventing rule conflicts between transform, analyze, and generate modes.
 *
 * @param {string} userText - The text submitted by the user.
 * @param {string} tone - The selected mode (professional, casual, humanize, detector, prompt).
 * @returns {Array} Message array for the chat completions API.
 */
function buildMessages(userText, tone) {
  const validTones = Object.keys(MODE_CATEGORY);
  const selectedTone = validTones.includes(tone) ? tone : 'professional';
  const category = MODE_CATEGORY[selectedTone];

  let systemPrompt;
  let userMessage;

  switch (category) {
    case 'transform': {
      const instruction = TRANSFORM_INSTRUCTIONS[selectedTone];
      systemPrompt = buildTransformSystemPrompt(instruction);
      userMessage = `Rewrite the following text according to your style instructions. Output only the rewritten text — no commentary.\n\n${userText}`;
      break;
    }

    case 'analyze': {
      const instruction = ANALYZE_INSTRUCTIONS[selectedTone];
      systemPrompt = buildAnalyzeSystemPrompt(instruction);
      userMessage = `Analyse the following text and produce the structured report as instructed:\n\n${userText}`;
      break;
    }

    case 'generate': {
      const instruction = GENERATE_INSTRUCTIONS[selectedTone];
      systemPrompt = buildGenerateSystemPrompt(instruction);
      userMessage = `Transform the following into a high-quality AI coding prompt, or respond with INSUFFICIENT_CONTEXT if more details are needed:\n\n${userText}`;
      break;
    }

    default: {
      // Fallback — should never be reached given validation above
      const instruction = TRANSFORM_INSTRUCTIONS['professional'];
      systemPrompt = buildTransformSystemPrompt(instruction);
      userMessage = `Rewrite the following text:\n\n${userText}`;
    }
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userMessage },
  ];
}

// ============================================================================
// Request Validator
// ============================================================================

/**
 * Validate and normalise the incoming request body.
 * @param {object} body - The parsed request body.
 * @returns {{ valid: boolean, text?: string, tone?: string, error?: string }}
 */
function validateRequest(body) {
  if (!body.text || typeof body.text !== 'string') {
    return { valid: false, error: 'Missing or invalid "text" field in request body.' };
  }

  const trimmedText = body.text.trim();

  if (!trimmedText) {
    return { valid: false, error: 'Text cannot be empty.' };
  }

  if (trimmedText.length > MAX_CHARS) {
    return { valid: false, error: `Text exceeds the maximum length of ${MAX_CHARS} characters.` };
  }

  const requestedTone = body.tone || 'professional';
  const validTones = Object.keys(MODE_CATEGORY);
  const tone = validTones.includes(requestedTone) ? requestedTone : 'professional';

  return { valid: true, text: trimmedText, tone };
}

// ============================================================================
// Response Parser
// ============================================================================

/**
 * Inspect the model's output for special sentinel values and shape
 * the API response accordingly.
 *
 * Currently handles:
 *   - INSUFFICIENT_CONTEXT — returned by prompt mode when input lacks detail.
 *
 * @param {string} content - Raw text from the model.
 * @param {string} tone    - The mode that produced this content.
 * @returns {object} Shaped response object.
 */
function parseModelOutput(content, tone) {
  // Prompt mode: detect insufficiency signal
  if (tone === 'prompt' && content.startsWith('INSUFFICIENT_CONTEXT')) {
    const missingSection = content.replace('INSUFFICIENT_CONTEXT', '').trim();
    return {
      success: false,
      type: 'insufficient_context',
      message: 'Your input does not contain enough detail to generate a reliable prompt.',
      missing: missingSection || 'Please provide more context about your task.',
    };
  }

  return { success: true, text: content };
}

// ============================================================================
// API Handler
// ============================================================================

export default async function handler(request, response) {
  // -------------------------------------------------------------------------
  // Method Validation
  // -------------------------------------------------------------------------
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // -------------------------------------------------------------------------
  // API Key Validation
  // -------------------------------------------------------------------------
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY not configured');
    return response.status(500).json({ error: 'Server configuration error.' });
  }

  // -------------------------------------------------------------------------
  // Request Validation
  // -------------------------------------------------------------------------
  const validation = validateRequest(request.body);

  if (!validation.valid) {
    return response.status(400).json({ error: validation.error });
  }

  // -------------------------------------------------------------------------
  // Build Messages
  // -------------------------------------------------------------------------
  const messages = buildMessages(validation.text, validation.tone);

  // -------------------------------------------------------------------------
  // Adjust model parameters per mode category
  // -------------------------------------------------------------------------
  const category = MODE_CATEGORY[validation.tone];
  const modelParams = {
    model: AI_MODEL,
    messages,
    // Lower temperature for analysis/generation = more consistent, structured output.
    // Slightly higher for creative transform modes (casual, humanize).
    temperature: (category === 'transform' && ['casual', 'humanize'].includes(validation.tone))
      ? 0.75
      : 0.4,
    max_tokens: category === 'generate' ? 2000 : 1500,
  };

  try {
    // -----------------------------------------------------------------------
    // API Call
    // -----------------------------------------------------------------------
    const apiResponse = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(modelParams),
    });

    // -----------------------------------------------------------------------
    // Rate Limiting
    // -----------------------------------------------------------------------
    if (apiResponse.status === 429) {
      return response.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // -----------------------------------------------------------------------
    // API-Level Errors
    // -----------------------------------------------------------------------
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.json().catch(() => ({}));
      const msg = errorBody?.error?.message || `API error ${apiResponse.status}`;
      throw new Error(msg);
    }

    // -----------------------------------------------------------------------
    // Parse Response
    // -----------------------------------------------------------------------
    const data = await apiResponse.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty response from AI model.');
    }

    // -----------------------------------------------------------------------
    // Shape and Return Response
    // -----------------------------------------------------------------------
    const result = parseModelOutput(content, validation.tone);

    // insufficient_context is a valid, handled outcome — return 200 with typed payload
    return response.status(200).json(result);

  } catch (error) {
    console.error('ToneShift API error:', error);
    return response.status(500).json({ error: error.message || 'Transformation failed.' });
  }
}