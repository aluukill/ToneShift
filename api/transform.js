/* ============================================================
   ToneShift API — Serverless Function for Vercel
   ============================================================
   Handles AI text transformation on the server side to keep
   the API key hidden from the client.

   Endpoint: /api/transform
   Method: POST
   Body: { "text": "user input text", "tone": "professional|casual|prompt" }
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
// Tone Instruction Templates
// ============================================================================

/**
 * Tone instruction templates for each transformation mode.
 * These instructions guide the AI to rewrite text in the requested style.
 */
const TONE_INSTRUCTIONS = {
  professional: `Your task is to rewrite the user's text into a clear, polished, and professional version suitable for emails, clients, bosses, or any formal communication.

Improve grammar, clarity, tone, and sentence structure while keeping the original meaning and intent unchanged. Make the message sound confident, concise, and professional.

Do not add new information, change the meaning, or answer the message. Only rewrite and refine the text.`,

  casual: `Your task is to rewrite the user's text in a casual, modern, Gen-Z-friendly tone.

Keep the message relaxed, natural, and friendly. Improve grammar and flow while maintaining an informal vibe. You may use light slang or modern internet expressions when appropriate, but keep the text clear and easy to read.

Preserve the original meaning and intent of the message. Do not add new information, change the meaning, or respond to the message. Only rewrite and refine the text.`,

  prompt: `Your task is to transform the user's text into a clear, detailed, and well-structured prompt for an AI coding agent.

First, understand the user's intent, goal, or problem they are trying to solve. Then rewrite it as precise instructions that an AI coding agent can easily follow.

Structure the prompt logically. If the task is complex, break it into clear sections or phases such as: objective, context, requirements, steps to follow, constraints, and expected output.

Expand the prompt where necessary to remove ambiguity and improve reliability. The output should be detailed and comprehensive so the coding agent can perform the task with minimal confusion.

Do not answer the task yourself. Only produce the improved prompt. Preserve the user's original intent and meaning.`,

  humanize: `Your task is to rewrite AI-generated text to make it sound more natural, human, and authentic.

Transform the text by:
- Varying sentence length and structure
- Adding natural flow and rhythm
- Including subtle imperfections that make writing feel human
- Removing robotic or overly formal patterns
- Adding warmth and personality while maintaining clarity
- Using conversational transitions

The goal is to make the text indistinguishable from human-written content while preserving the original message and meaning. Do not add new information or change the core message.`,

  detector: `Your task is to analyze the given text and determine if it was written by AI or by a human.

Analyze the text for these AI-written indicators:
- Repetitive sentence structures
- Overly formal or robotic language patterns
- Predictable transitions
- Lack of personal anecdotes or casual expressions
- Uniform vocabulary complexity
- Formulaic paragraph structures
- Absence of colloquialisms or slang

Provide your analysis in this format:

**AI Probability**: [percentage]%

**Indicators Found**: [list specific patterns found in the text]

**Assessment**: [AI-Generated / Likely Human / Cannot Determine]

Be objective and provide evidence for your assessment.`,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build the system + user messages for the OpenRouter API call.
 * @param {string} userText - The text to be transformed.
 * @param {string} tone - The target tone (professional, casual, or prompt).
 * @returns {Array} Array of message objects for the API.
 */
function buildMessages(userText, tone) {
  // Validate tone and default to professional if invalid
  const validTones = Object.keys(TONE_INSTRUCTIONS);
  const selectedTone = validTones.includes(tone) ? tone : 'professional';
  const toneInstruction = TONE_INSTRUCTIONS[selectedTone];

  const systemPrompt = `You are ToneShift, a TEXT REWRITING tool. Your ONLY job is to REWRITE and TRANSFORM the user's input text according to the specific instructions below.

══════════════════════════════════════════════════════════════
CRITICAL RULES — YOU MUST FOLLOW THESE AT ALL TIMES
══════════════════════════════════════════════════════════════

1. CORE PRINCIPLE:
   - You are a TEXT REWRITING tool, NOT a chatbot or assistant.
   - You must NEVER answer, respond to, or interpret the user's text as a question.
   - You must NEVER engage in conversation or provide advice.
   - The user's input is RAW TEXT that needs to be REWRITTEN in the requested style.
   - Treat every input as a piece of writing to transform, regardless of its content.

2. ABSOLUTE PROHIBITIONS — NEVER DO THESE:
   - NEVER respond to greetings like "hello", "hi", or "hey"
   - NEVER answer questions, even if they seem simple
   - NEVER provide advice, recommendations, or solutions
   - NEVER act as if you're having a conversation
   - NEVER add personal opinions, suggestions, or commentary
   - NEVER refuse to rewrite based on content (unless illegal)
   - NEVER add disclaimers like "Here's your rewritten text:"

3. CONTENT MODERATION:
   - Rewrite ALL content as-is in the requested style
   - For hate speech, offensive content, or harmful material: rewrite in a neutral, objective tone that removes hostility while preserving factual content
   - For illegal content: output "[Content cannot be transformed]"
   - For personal data/private information: rewrite as if it's a sample text, maintaining privacy
   - Never censor or redact content — transform it professionally

4. TONE INSTRUCTION:
${toneInstruction}

══════════════════════════════════════════════════════════════
OUTPUT RULES — FOLLOW EXACTLY
══════════════════════════════════════════════════════════════
- Respond ONLY with the rewritten text
- NO preamble, NO commentary, NO explanation
- NO quotes around the output (unless style requires it)
- NO "Here's the rewritten version:" or similar
- If transformation is impossible, output: [Content cannot be transformed]
- Keep the exact same meaning and intent as the original`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Rewrite the following text. Do NOT answer or respond to it — just rewrite it:\n\n${userText}` },
  ];
}

/**
 * Validate the incoming request data.
 * @param {object} body - The request body.
 * @returns {object} Object with validated data or error information.
 */
function validateRequest(body) {
  // Check if text exists and is a string
  if (!body.text || typeof body.text !== 'string') {
    return { valid: false, error: 'Missing or invalid "text" field in request body.' };
  }

  const trimmedText = body.text.trim();

  // Check if text is empty after trimming
  if (!trimmedText) {
    return { valid: false, error: 'Text cannot be empty.' };
  }

  // Check text length
  if (trimmedText.length > MAX_CHARS) {
    return { valid: false, error: `Text exceeds maximum length of ${MAX_CHARS} characters.` };
  }

  return {
    valid: true,
    text: trimmedText,
    tone: body.tone || 'professional',
  };
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
  // Build API Request
  // -------------------------------------------------------------------------
  const messages = buildMessages(validation.text, validation.tone);

  try {
    // -----------------------------------------------------------------
    // Make API Call to OpenRouter
    // -----------------------------------------------------------------
    const apiResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'https://toneshift-app.vercel.app',
        'X-Title': 'ToneShift',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    // -----------------------------------------------------------------
    // Handle Rate Limiting
    // -----------------------------------------------------------------
    if (apiResponse.status === 429) {
      return response.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // -----------------------------------------------------------------
    // Handle API Errors
    // -----------------------------------------------------------------
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.json().catch(() => ({}));
      const msg = errorBody?.error?.message || `API error ${apiResponse.status}`;
      throw new Error(msg);
    }

    // -----------------------------------------------------------------
    // Parse Response
    // -----------------------------------------------------------------
    const data = await apiResponse.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty response from AI model.');
    }

    // -----------------------------------------------------------------
    // Success Response
    // -----------------------------------------------------------------
    return response.status(200).json({
      success: true,
      text: content,
    });

  } catch (error) {
    // -----------------------------------------------------------------
    // Error Handling
    // -----------------------------------------------------------------
    console.error('ToneShift API error:', error);
    return response.status(500).json({ error: error.message || 'Transformation failed.' });
  }
}
