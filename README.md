# ToneShift

ToneShift is an AI-powered tool that transforms your writing into different tones instantly. Whether you need to sound more professional, casual, or human, ToneShift has you covered.

## What Does ToneShift Do?

ToneShift takes any text you write and rewrites it in a different style. Think of it as having a professional editor, a friendly conversation partner, and an AI expert all in one place.

### Available Transformations

| Mode                | Description                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Professional**    | Transform your text into polished, business-ready writing suitable for executives, clients, and formal documents |
| **Casual / Gen-Z**  | Convert your text into natural, friendly conversation that sounds like a real person wrote it                    |
| **Humanize**        | Remove AI-sounding patterns from text and make it sound authentically human-written                              |
| **AI Agent Prompt** | Turn a rough idea into a detailed, professional AI prompt that gets better results                               |
| **AI Detector**     | Analyze any text to estimate whether it was written by a human or AI                                             |

## Getting Started

### Prerequisites

You will need:

1. A computer with internet access
2. A free Groq API key (instructions below)

### Obtaining Your API Key

ToneShift uses Groq's AI technology to process your text. To get your free API key:

1. Visit [console.groq.com/keys](https://console.groq.com/keys)
2. Create a free account or sign in
3. Click "Create API Key"
4. Copy the key (it will look like a long string of letters and numbers)

### Running ToneShift Locally

#### Option 1: Simple HTML File (No Installation)

The easiest way to use ToneShift is to open the HTML file directly in your browser:

1. Copy `.env.example` to a new file named `.env.local`
2. Open `toneshift.html` in your web browser
3. Enter your Groq API key when prompted (or set it in the environment)

#### Option 2: Deploy to Vercel (Recommended)

For the best experience, deploy ToneShift to Vercel's free platform:

1. Create a free account at [vercel.com](https://vercel.com)
2. Install Vercel CLI: `npm i -g vercel`
3. Run `vercel login` in your terminal
4. Run `vercel` in the ToneShift folder
5. Follow the prompts to deploy

After deployment, add your Groq API key in the Vercel dashboard:

1. Go to your project in Vercel
2. Click Settings
3. Click Environment Variables
4. Add a new variable: `GROQ_API_KEY` = your API key

## How to Use ToneShift

1. **Enter your text** in the input box on the left
2. **Select a transformation mode** from the sidebar (Professional, Casual, Humanize, etc.)
3. **Click Transform** to generate the converted text
4. **Copy the result** with a single click

You can also use keyboard shortcuts: press `Ctrl + Enter` (or `Cmd + Enter` on Mac) to transform your text.

## Understanding the Modes

### Professional

Use this when you need to communicate with:

- Business executives
- Clients or customers
- Formal documents and reports
- Job applications and cover letters

The professional mode removes casual language, adds clarity, and uses business-appropriate vocabulary.

### Casual / Gen-Z

Use this for:

- Social media posts
- Messages to friends or colleagues
- Blog posts with a friendly tone
- Content that should feel approachable

The casual mode adds natural flow, appropriate expressions, and friendly engagement.

### Humanize

Use this when:

- You have text that sounds too robotic
- You want to bypass AI detection
- You need content that feels personally written

The humanize mode varies sentence length, removes formulaic patterns, and adds authentic voice.

### AI Agent Prompt

Use this when:

- You have a vague idea but don't know how to ask an AI
- You want better results from ChatGPT or other AI tools
- You need a detailed prompt for a specific task

The prompt mode converts your rough idea into a professional, detailed prompt.

### AI Detector

Use this when:

- You want to verify if content is AI-generated
- You're checking if text sounds too artificial
- You need to verify authenticity of content

The detector analyzes patterns and provides a probability score.

## Technical Details

### How It Works

ToneShift consists of two parts:

1. **Frontend** (`toneshift.html`) - The user interface where you enter and receive text
2. **Backend** (`api/transform.js`) - The server that processes your text using AI

The backend is designed as a Vercel serverless function, meaning it runs automatically when needed without any server maintenance.

### Technology Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js (Serverless function)
- **AI Model**: LLaMA 3.3 (via Groq API)
- **Deployment**: Vercel

### API Reference

If you want to use ToneShift's transformation capabilities in your own application:

**Endpoint**: `POST /api/transform`

**Request Body**:

```json
{
  "text": "Your text here",
  "tone": "professional|casual|humanize|prompt|detector"
}
```

**Response**:

```json
{
  "success": true,
  "text": "Transformed text here"
}
```

## Troubleshooting

### "Server configuration error"

Your Groq API key is not set correctly. Make sure:

- The `.env.local` file exists (for local development)
- The environment variable is set in Vercel (for deployed version)

### "Text exceeds maximum length"

Your input is too long. ToneShift accepts up to 5,000 characters.

### "AI request failed"

There may be a temporary issue with the Groq service. Try again in a few moments.

## Contributing

Contributions are welcome. Please feel free to submit issues or pull requests.

## License

This project is available for personal and commercial use.

## Support

If you encounter issues:

1. Check that your API key is valid and has not expired
2. Verify you have an active internet connection
3. Try refreshing the page and attempting the operation again
