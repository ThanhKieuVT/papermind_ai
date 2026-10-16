# Deploying to Vercel

The app needs no database and no file storage. All API routes are stateless serverless functions.

## 1. Push the repository to GitHub

Never commit `.env.local`. It is already ignored by `.gitignore`.

## 2. Import the project in Vercel

1. Go to https://vercel.com/new and import the repository.
2. **Framework preset:** Next.js (auto-detected). Leave the build command (`npm run build`) and the output settings at their defaults.
3. Under **Settings → General → Node.js Version**, choose **22.x** (or 20.x).

## 3. Environment variables (Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `OPENALEX_API_KEY` | **Strongly recommended** | Free key from https://openalex.org/settings/api. Without it, OpenAlex gives all users on Vercel's shared egress IPs one small daily budget, and search will soon return "rate limit reached". |
| `OPENALEX_MAILTO` | Optional | Contact e-mail sent to OpenAlex |
| `GEMINI_API_KEY` | Optional | Enables AI features. Free key from https://aistudio.google.com/app/apikey. Without it, the app runs with AI disabled. |
| `GEMINI_MODEL` | Optional | Defaults to `gemini-2.5-flash`. If Google retires that model, set a current one. |
| `AI_ACCESS_TOKEN` | Required for AI in production | A long random string, e.g. `openssl rand -hex 24`. Users enter it in **Settings**. Without it, AI is **disabled** in production. |
| `AI_ALLOW_PUBLIC` | Not recommended | `true` lets anyone use the AI endpoints without a token, and they will spend your Gemini quota. |

Set these variables for the **Production** environment, and for **Preview** too if you want AI on preview deployments.

## 4. Deploy and verify

After the deployment finishes, check these:

1. `https://<app>/api/ai/status` returns `{"enabled":true,"requiresToken":true,...}` when AI is configured, and the response does not contain your key.
2. Discover: searching for "graph neural networks" returns results.
3. Reader: uploading a PDF renders page 1 and shows the extracted text. `https://<app>/pdf.worker.min.mjs` must return 200.
4. Settings: enter the access token. Reader → AI assistant → "Summarize the paper" returns an answer.

## Limits and their handling

* **Function duration:** search routes use `maxDuration = 20`, AI routes use `maxDuration = 60`. The Hobby plan allows up to 60 s. The Gemini call times out after 50 s.
* **Request body:** Vercel limits function payloads to 4.5 MB. AI requests are limited to 400 KB, and PDFs are never uploaded.
* **Rate limiting:** the in-memory limit (30 AI requests per 10 minutes per IP) applies **per function instance**. Instances don't share memory, so this is not a global quota. If you need strict global limits, add Vercel KV / Upstash Redis or Vercel's firewall rate-limiting rules. The token requirement is the main protection.
* **Caching:** search responses are cached at the CDN (`s-maxage=600`), which also saves OpenAlex budget. AI responses use `no-store`.
