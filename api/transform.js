/* ============================================================
   ToneShift API — Serverless Function for Vercel
   ============================================================
   Handles AI text transformation on the server side to keep
   the API key hidden from the client.
   
   Endpoint: /api/transform
   Method: POST
   Body: { "text": "user input text" }
   ============================================================ */

// Environment variables (set in Vercel dashboard)
// OPENROUTER_API_KEY - Your OpenRouter API key
// OPENROUTER_REFERRER - Your website URL (optional)

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'nvidia/nemotron-3-nano-30b-a3b:free';
const MAX_CHARS = 5000;

/**
 * Build the system + user messages for the OpenRouter API call.
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
    { role: 'user', content: userText },
  ];
}

/**
 * Parse the raw AI response into three sections.
 */
function parseResponse(raw) {
  const sections = {
    professional: '',
    casual: '',
    prompt: '',
  };

  const markerPattern = /PROFESSIONAL:\s*(.+?)(?=\nCASUAL:|$)/is;
  const casualPattern = /CASUAL:\s*(.+?)(?=\nPROMPT:|$)/is;
  const promptPattern = /PROMPT:\s*(.+)/is;

  const proMatch = raw.match(markerPattern);
  const casualMatch = raw.match(casualPattern);
  const promptMatch = raw.match(promptPattern);

  if (proMatch) sections.professional = proMatch[1].trim();
  if (casualMatch) sections.casual = casualMatch[1].trim();
  if (promptMatch) sections.prompt = promptMatch[1].trim();

  return sections;
}

/**
 * Check if the response has at least one valid section.
 */
function hasValidSections(sections) {
  return Object.values(sections).some(v => v.length > 0);
}

export default async function handler(request, response) {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Get API key from environment variable
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not configured');
    return response.status(500).json({ error: 'Server configuration error.' });
  }

  // Validate and get user input
  const { text } = request.body;
  
  if (!text || typeof text !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid "text" field in request body.' });
  }

  const trimmedText = text.trim();
  
  if (!trimmedText) {
    return response.status(400).json({ error: 'Text cannot be empty.' });
  }

  if (trimmedText.length > MAX_CHARS) {
    return response.status(400).json({ error: `Text exceeds maximum length of ${MAX_CHARS} characters.` });
  }

  const messages = buildMessages(trimmedText);

  try {
    // Make API call to OpenRouter from server side
    const apiResponse = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'https://toneshift.vercel.app',
        'X-Title': 'ToneShift',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    // Handle rate limiting
    if (apiResponse.status === 429) {
      return response.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    // Handle other API errors
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.json().catch(() => ({}));
      const msg = errorBody?.error?.message || `API error ${apiResponse.status}`;
      throw new Error(msg);
    }

    // Parse the response
    const data = await apiResponse.json();
    const content = data?.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Empty response from AI model.');
    }

    const sections = parseResponse(content);

    if (!hasValidSections(sections)) {
      // Return raw response if parsing fails
      return response.status(200).json({
        success: true,
        raw: content,
        sections: {
          professional: content,
          casual: 'Could not parse the casual section.',
          prompt: 'Could not parse the prompt section.',
        },
      });
    }

    return response.status(200).json({
      success: true,
      sections,
    });

  } catch (error) {
    console.error('ToneShift API error:', error);
    return response.status(500).json({ error: error.message || 'Transformation failed.' });
  }
}
