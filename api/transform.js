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
// OPENROUTER_API_KEY - Your OpenRouter API key
// OPENROUTER_REFERRER - Your website URL (optional)

// ============================================================================
// Configuration
// ============================================================================

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
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
  professional: `Rewrite the text into a clear, polished, and professional version suitable for formal communication — emails, reports, client correspondence, or messages to a manager.

Guidelines:
- Fix grammar, punctuation, and sentence structure.
- Use confident, concise, and neutral language.
- Eliminate filler words, redundancy, and overly casual expressions.
- Preserve every idea and piece of information in the original — do not add or remove content.
- Keep roughly the same length unless tightening is needed for clarity.`,

  casual: `Rewrite the text in a casual, relaxed, and conversational tone suitable for friends, social media, or informal messages.

Guidelines:
- Use simple, everyday vocabulary — avoid stiff or corporate phrasing.
- Contractions are encouraged (don't, can't, it's, etc.).
- Light, modern slang or internet expressions are fine when they fit naturally — do not force them.
- Keep sentences short and punchy where it sounds natural.
- Preserve all the original ideas and meaning — do not add or remove content.`,

  humanize: `Rewrite AI-generated text so it reads as though a real person wrote it.

Guidelines:
- Vary sentence length deliberately — mix short punchy sentences with longer flowing ones.
- Replace generic transitions ("Furthermore", "In conclusion", "It is important to note") with natural connectors or none at all.
- Remove hedging clusters ("It is worth noting that", "One might argue that") unless they serve a purpose.
- Favour concrete, specific language over abstract generalisations.
- Allow minor stylistic quirks that a human writer would naturally have.
- Maintain the original message, facts, and tone intent — do not add new information.`,
};

const ANALYZE_INSTRUCTIONS = {
  detector: `Analyse the provided text and determine the likelihood that it was written by an AI model rather than a human.

Evaluation criteria — look for the following AI writing patterns:
- Formulaic or predictable sentence structures (e.g. topic sentence → evidence → summary repeated uniformly)
- Overuse of balanced parallel lists ("Firstly… Secondly… Finally…")
- Generic transitions that don't flow from actual ideas ("Moreover", "Furthermore", "It is important to note")
- Absence of personal voice, hedging, or genuine opinion
- Uniform vocabulary complexity across the text — no register shifts
- Unnaturally even paragraph lengths
- Filler phrases that pad length without adding meaning
- Correct but overly safe grammar with no natural variance
- Lack of contractions where a human writer would use them
- Topic sentences that over-announce what the paragraph will say

Scoring methodology:
- Weight each indicator by how strongly it correlates with AI output vs. human variance.
- A single indicator does not mean AI-generated. Cluster strength matters.
- Short texts (under 50 words) produce lower-confidence results — note this.

Your output must follow this exact structure:

**AI Probability**: [0–100]%

**Confidence**: [Low / Medium / High] — [one sentence explaining why, e.g. "text is too short for reliable analysis"]

**Indicators Found**:
- [Specific pattern observed, with a brief example from the text]
- [Repeat for each indicator found; if none, write "No strong AI indicators detected"]

**Assessment**: [AI-Generated / Likely AI / Uncertain / Likely Human / Human-Written]

**Reasoning**: [2–4 sentences summarising how you reached this assessment, referencing the indicators above]`,
};

const GENERATE_INSTRUCTIONS = {
  prompt: `You are an expert prompt engineer. Your job is to transform a user's rough idea or description into a high-quality, unambiguous prompt for an AI coding agent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — EVALUATE CONTEXT SUFFICIENCY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before generating a prompt, assess whether the input contains enough information for a coding agent to act on. A good coding prompt needs at minimum:
  (a) A clear goal or outcome
  (b) Enough technical context (language, framework, environment, or existing code) — unless the task is framework-agnostic
  (c) Any important constraints or requirements (e.g. performance, compatibility, libraries to use or avoid)

If the input is too vague or ambiguous to produce a reliable, actionable coding prompt, you MUST respond with:

INSUFFICIENT_CONTEXT
Missing: [bullet list of the specific information needed]
Example: "What programming language or framework should be used?", "What is the expected input/output format?", "Is this a new feature or a fix to existing code?"

Do not attempt to generate a prompt when the context is insufficient — a vague prompt is worse than no prompt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE THE PROMPT (if context is sufficient)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Transform the user's input into a structured, comprehensive prompt for an AI coding agent. Use the following format where relevant — skip sections that don't apply:

**Objective**
[One clear sentence stating what needs to be built or done.]

**Context**
[Background information the agent needs: language, framework, codebase state, relevant constraints, etc.]

**Requirements**
[Numbered list of specific, testable requirements the solution must satisfy.]

**Implementation Notes**
[Optional: hints, preferred approach, libraries to use/avoid, known edge cases.]

**Expected Output**
[What the agent should produce: files, functions, test results, etc. Be specific.]

Prompt engineering rules to follow:
- Be explicit about what is in scope and out of scope.
- Prefer concrete examples over abstract descriptions where helpful.
- Resolve ambiguities in the input by making reasonable assumptions and stating them explicitly in the prompt.
- Do not answer or solve the task yourself — only produce the improved prompt.
- Preserve the user's original intent exactly.`,
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not configured');
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
    const apiResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'https://toneshift-app.vercel.app',
        'X-Title': 'ToneShift',
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