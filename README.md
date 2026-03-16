# ToneShift

ToneShift is a lightweight, AI-driven text transformation engine. It processes raw input and instantly restructures it into specific stylistic formats—whether you need business-ready polish, authentic conversational pacing, or structured prompts for other AI agents.

<div align="center">
  <img src="https://i.ibb.co.com/NnHqP4SQ/Screenshot-6.png" alt="ToneShift Landing Page" width="800"/>
  <br><br>
  <img src="https://i.ibb.co.com/wrz5Rz4P/Screenshot-7.png" alt="ToneShift Interface" width="800"/>
</div>

## Capabilities

ToneShift uses LLaMA 3.3 (via Groq) to analyze and rewrite text across five distinct modes:

| Mode | Function |
| :--- | :--- |
| **Professional** | Polishes rough drafts into business-ready copy suitable for executive communication and formal documentation. |
| **Casual** | Relaxes formal text into natural, conversational language with authentic phrasing. |
| **Humanize** | Strips predictable LLM cadence and vocabulary, restructuring text to bypass synthetic detection. |
| **AI Prompt** | Expands raw ideas into highly structured, context-rich prompts designed for other AI agents. |
| **Detector** | Analyzes text patterns to estimate the probability of synthetic generation. |

## Quick Start

ToneShift requires a free [Groq API key](https://console.groq.com/keys) to handle the model inference. 

### Local Development (Zero Setup)
ToneShift can run entirely in the browser without a build step.
1. Clone the repository.
2. Duplicate `.env.example` and rename it to `.env.local`.
3. Add your Groq API key to the file.
4. Open `toneshift.html` directly in your browser.

### Vercel Deployment (Recommended)
For production use, the backend is optimized for Vercel Serverless Functions.
1. Install the Vercel CLI: `npm i -g vercel`
2. Authenticate: `vercel login`
3. Deploy the project: `vercel`
4. In your Vercel Project Settings, add a new Environment Variable: `GROQ_API_KEY` mapped to your key.

## Architecture

ToneShift is built with a minimalist, dependency-light stack:
* **Frontend**: Vanilla HTML/CSS/JavaScript (Clean, dark-mode-ready UI)
* **Backend**: Node.js (Vercel Serverless Functions)
* **Inference**: LLaMA 3.3 powered by Groq's high-speed API

## API Reference

ToneShift's transformation logic can be consumed by external applications via its serverless endpoint.

**Endpoint:** `POST /api/transform`

**Payload:**
```json
{
  "text": "String to be transformed",
  "tone": "professional | casual | humanize | prompt | detector"
}
