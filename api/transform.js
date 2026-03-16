/* ============================================================
   ToneShift API — Production Grade Version
   ============================================================

   Serverless Function for Vercel

   Endpoint:
   POST /api/transform

   Body:
   {
     "text": "user input",
     "tone": "professional|casual|humanize|prompt|detector"
   }

   ============================================================ */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
const AI_MODEL = "llama-3.3-70b-versatile"

const MAX_CHARS = 5000

// ============================================================================
// Mode Categories
// ============================================================================

const MODE_CATEGORY = {
  professional: "transform",
  casual: "transform",
  humanize: "transform",
  detector: "analyze",
  prompt: "generate"
}

// ============================================================================
// TRANSFORM MODE INSTRUCTIONS
// ============================================================================

const TRANSFORM_INSTRUCTIONS = {

professional: `
Rewrite the text into a refined professional version.

Audience:
Executives, business communication, high-level documentation.

Guidelines:
• Use clear structured sentences.
• Replace vague language with precise terminology.
• Maintain the original meaning.
• Remove slang or emotional phrasing.
• Ensure logical flow and readability.

Negative Constraints:
• No corporate buzzword spam
• No commentary
• No explanations
`,

casual: `
Rewrite the text to sound like natural internet conversation.

Guidelines:
• Conversational tone
• Slight slang allowed
• Short punchy sentences
• Friendly rhythm

Constraints:
• No cringe forced slang
• No explanations
• Only rewritten text
`,

humanize: `
Rewrite the text to sound human-written rather than AI-generated.

Techniques:
• Vary sentence lengths
• Use natural transitions
• Remove robotic phrasing
• Occasionally start sentences with conjunctions
• Avoid generic filler phrases

Goal:
Make the text feel authentic and organic.
`

}

// ============================================================================
// ANALYZE MODE
// ============================================================================

const ANALYZE_INSTRUCTIONS = {

detector: `
Perform linguistic analysis to estimate if text is AI-generated.

Evaluation Criteria:

1. Sentence structure repetition
2. Predictable phrasing
3. Generic filler language
4. Overly consistent tone
5. Formulaic transitions

Return EXACT format:

AI Probability: X%
Confidence: Low | Medium | High

Top Indicators:
1. Pattern — example
2. Pattern — example

Assessment:
Short explanation of reasoning.
`

}

// ============================================================================
// GENERATE MODE (ULTRA IMPROVED)
// ============================================================================

const GENERATE_INSTRUCTIONS = {

prompt: `
You are an **elite prompt engineer**.

Your job:
Convert the user's rough request into a **professional AI engineering prompt**.

━━━━━━━━━━━━━━━━━━━━
CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━

• Output ONLY the generated prompt
• No commentary
• No explanations
• No greetings
• Do NOT solve the task yourself

━━━━━━━━━━━━━━━━━━━━
CHECK FOR CONTEXT
━━━━━━━━━━━━━━━━━━━━

Before generating the prompt, verify the user input includes:

1. Tech stack
2. Features to implement
3. UI expectations
4. Data/API source
5. Files or project context

If information is missing:

Return EXACTLY:

INSUFFICIENT_CONTEXT

Missing:
- tech stack
- features
- UI expectations
- API/data
- file context

Only list missing items.

━━━━━━━━━━━━━━━━━━━━
PROMPT STRUCTURE
━━━━━━━━━━━━━━━━━━━━

Generate a **professional coding agent prompt** using:

Persona  
Task  
Context  
Tech Stack  
Implementation Plan  
Files to Create / Modify  
API Contracts  
UI/UX Requirements  
Constraints  
Acceptance Criteria  

Be extremely precise.

Example level of clarity:

BAD:
"Create a component"

GOOD:
"Create src/components/WishlistButton.tsx using React + Tailwind. The component toggles a heart icon and persists state to PocketBase collection 'wishlist'."

━━━━━━━━━━━━━━━━━━━━
GOAL
━━━━━━━━━━━━━━━━━━━━

Produce a prompt that a **senior AI coding agent could execute immediately without clarification.**
`

}

// ============================================================================
// SYSTEM PROMPT BUILDERS
// ============================================================================

function buildTransformSystemPrompt(instruction){

return `You are ToneShift — a rewriting engine.

Rules:

• Output ONLY rewritten text
• No commentary
• No explanations
• No greetings
• Do NOT answer questions
• Only transform wording

Style Rules:

${instruction}
`

}

function buildAnalyzeSystemPrompt(instruction){

return `You are ToneShift's AI analysis engine.

Rules:

• Output ONLY the structured analysis
• No rewriting
• No commentary

Instructions:

${instruction}
`

}

function buildGenerateSystemPrompt(instruction){

return `You are ToneShift's prompt generation engine.

Rules:

• Only generate prompts
• Never implement tasks
• Never explain

${instruction}
`

}

// ============================================================================
// MESSAGE BUILDER
// ============================================================================

function buildMessages(userText,tone){

const selected = MODE_CATEGORY[tone] ? tone : "professional"
const category = MODE_CATEGORY[selected]

let systemPrompt
let userPrompt

switch(category){

case "transform":

systemPrompt = buildTransformSystemPrompt(
TRANSFORM_INSTRUCTIONS[selected]
)

userPrompt = `Rewrite this text:\n\n${userText}`
break

case "analyze":

systemPrompt = buildAnalyzeSystemPrompt(
ANALYZE_INSTRUCTIONS[selected]
)

userPrompt = `Analyze this text:\n\n${userText}`
break

case "generate":

systemPrompt = buildGenerateSystemPrompt(
GENERATE_INSTRUCTIONS[selected]
)

userPrompt = `Convert this into a professional AI coding prompt:\n\n${userText}`
break

}

return [
{role:"system",content:systemPrompt},
{role:"user",content:userPrompt}
]

}

// ============================================================================
// VALIDATION
// ============================================================================

function validateRequest(body){

if(!body?.text || typeof body.text !== "string"){
return {valid:false,error:"Missing text"}
}

const text = body.text.trim()

if(!text){
return {valid:false,error:"Text empty"}
}

if(text.length > MAX_CHARS){
return {valid:false,error:`Max length ${MAX_CHARS}`}
}

const tone = MODE_CATEGORY[body.tone] ? body.tone : "professional"

return {valid:true,text,tone}

}

// ============================================================================
// OUTPUT PARSER
// ============================================================================

function parseModelOutput(content,tone){

if(tone === "prompt" && content.startsWith("INSUFFICIENT_CONTEXT")){

return{
success:false,
type:"missing_context",
message:"More information required",
details:content
}

}

return{
success:true,
text:content
}

}

// ============================================================================
// API HANDLER
// ============================================================================

export default async function handler(req,res){

if(req.method !== "POST"){
return res.status(405).json({error:"POST only"})
}

const apiKey = process.env.GROQ_API_KEY

if(!apiKey){
return res.status(500).json({error:"Server config error"})
}

const validation = validateRequest(req.body)

if(!validation.valid){
return res.status(400).json({error:validation.error})
}

const messages = buildMessages(validation.text,validation.tone)

const category = MODE_CATEGORY[validation.tone]

const params = {
model:AI_MODEL,
messages,
temperature: category === "transform" ? 0.7 : 0.3,
max_tokens: category === "generate" ? 2000 : 1200
}

try{

const aiRes = await fetch(GROQ_ENDPOINT,{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${apiKey}`
},
body:JSON.stringify(params)
})

if(!aiRes.ok){
throw new Error(`AI API ${aiRes.status}`)
}

const data = await aiRes.json()

const content =
data?.choices?.[0]?.message?.content?.trim()

if(!content){
throw new Error("Empty AI response")
}

const result = parseModelOutput(content,validation.tone)

return res.status(200).json(result)

}catch(err){

console.error(err)

return res.status(500).json({
error:"AI request failed"
})

}

}