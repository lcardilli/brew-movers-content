# Brew Movers — Content Ideas Dashboard

A weekly SEO content idea generator and approval dashboard for Brew Movers.  
Ideas are generated entirely through **Claude AI with web search** — two targeted searches (current industry news + commonly searched keywords/questions) feed a synthesis step that produces 10 SEO-driven content ideas per run.

---

## How it works

1. **Weekly cron** — every Monday at 8 am EST, Vercel calls `/api/generate` automatically
2. **Manual trigger** — click "Generate New Ideas" in the dashboard header
3. **Review** — AG or BA selects their initials and approves/rejects each idea card
4. **Persistence** — all ideas are stored in Vercel Blob; `ideas.json` in the repo is the initial seed

---

## Generation pipeline

Each run makes three Claude API calls:

| Step | What it does |
|---|---|
| 1. Industry news search | Web search for beverage logistics news from the past 7 days |
| 2. Keyword research search | Web search for commonly searched questions and keywords in the space |
| 3. Idea synthesis | Combines both sources to generate 10 SEO-driven content ideas |

Each idea includes a blog title, target keyword, **search intent** (informational / commercial / navigational), content angle, suggested word count, and the source that inspired it.

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/lcardilli/brew-movers-content.git
cd brew-movers-content
npm install
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Fill in your values:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token   # only needed on Vercel
```

### 3. Run a local generation

This uses the local `ideas.json` file (no Blob required):

```bash
npm run generate
```

### 4. Preview the dashboard locally

Requires the [Vercel CLI](https://vercel.com/cli):

```bash
vercel dev
```

---

## Vercel deployment

### Environment variables (Vercel project settings, not GitHub secrets)

Since the serverless functions run on Vercel — not in GitHub Actions — the API token must be added directly to your **Vercel project settings**, not as a GitHub repo secret.

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard) → your project → **Settings → Environment Variables**
2. Add the following for **Production** (and optionally Preview/Development):

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key — from [console.anthropic.com](https://console.anthropic.com) |
| `BLOB_READ_WRITE_TOKEN` | Auto-filled after you create a Blob store (see below) |

### Setting up Vercel Blob (required for idea persistence)

Ideas are stored in **Vercel Blob** so they persist across deployments and serverless function invocations.

1. In your Vercel project dashboard → **Storage** tab → **Create Database** → choose **Blob**
2. Name it `brew-movers-ideas` (or anything you like) and click **Create**
3. Vercel automatically adds `BLOB_READ_WRITE_TOKEN` to your project environment variables
4. Redeploy — the functions will now read and write ideas from Blob

### Cron job

`vercel.json` configures a weekly cron that calls `/api/generate` every **Monday at 13:00 UTC (8 am EST / 9 am EDT)**:

```json
{
  "crons": [{ "path": "/api/generate", "schedule": "0 13 * * 1" }]
}
```

Cron jobs are available on Vercel's **Pro plan and above**.

---

## Project structure

```
brew-movers-content/
├── api/
│   ├── generate.js   # Serverless function — runs idea generation (cron + manual)
│   ├── ideas.js      # Serverless function — returns all ideas as JSON
│   └── save.js       # Serverless function — updates idea status/reviewer
├── lib/
│   ├── anthropic-utils.js  # Claude API: web search (news + keywords) + idea generation
│   └── storage.js          # Storage abstraction (local fs vs Vercel Blob)
├── generate.js   # Standalone local runner (npm run generate)
├── ideas.json    # Initial seed file (local dev)
├── index.html    # Branded dashboard
├── vercel.json   # Vercel config + cron schedule
└── package.json
```

---

## Reviewers

Two reviewer initials are supported on each idea card:

| Initials | Person |
|---|---|
| **AG** | Reviewer 1 |
| **BA** | Reviewer 2 |

A reviewer must be selected before Approve or Reject is enabled on a card.
