# KW Research

AI-powered keyword research and content strategy platform built with Next.js 14.

## Overview

KW Research is a professional SaaS tool that automates keyword research workflows using AI (Claude, GPT) and real-time keyword metrics (Keywords Everywhere API). It crawls websites and competitors, discovers keyword opportunities, generates pillar/cluster strategies, and exports polished Excel workbooks.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via libSQL + Drizzle ORM
- **Auth**: Custom JWT sessions (bcryptjs + jose)
- **AI**: Anthropic Claude, OpenAI GPT (configurable)
- **Styling**: Tailwind CSS 3.4
- **Testing**: Vitest
- **Deployment**: Render (Node.js + persistent disk)

## Quick Start

```bash
# Install dependencies
npm ci

# Copy environment template
cp .env.example .env.local

# Fill in required values (at minimum SESSION_SECRET and one AI key)
# Edit .env.local

# Run development server (auto-runs migrations)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with auto-migrations |
| `npm run build` | Production build |
| `npm start` | Production server with auto-migrations |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript strict type check |
| `npm test` | Run Vitest test suite |
| `npm run migrate` | Run database migrations manually |

## Environment Variables

See [`.env.example`](./.env.example) for all variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Secret for JWT session signing |
| `DATABASE_URL` | Yes | SQLite database path (default: `.data/kw-research.db`) |
| `ANTHROPIC_API_KEY` | One AI key | Claude API key |
| `OPENAI_API_KEY` | One AI key | OpenAI API key |
| `KEYWORDS_EVERYWHERE_API_KEY` | Optional | For real-time keyword metrics |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret |

## Core Workflow

1. **Register/Login** → Create an account with email/password
2. **Create Project** → Add brand name, site URLs, competitors
3. **Start Research Run** → Choose fresh or expand mode
4. **AI Pipeline** → Crawl site + competitors → keyword discovery → AI analysis → synthesis
5. **Download Results** → Export polished Excel workbook with metrics

## Project Structure

```
src/
├── app/              # Next.js App Router (pages + API routes)
├── components/       # React UI components
├── hooks/            # Custom React hooks
├── lib/              # Shared utilities and types
└── server/           # Server-side code
    ├── auth/         # Authentication logic
    ├── db/           # Database schema + migrations
    ├── files/        # File storage
    └── research/     # AI research pipeline + agents
```

## Deployment

Configured for Render via `render.yaml`. The database uses a 5GB persistent disk at `/var/data`.

```bash
# Production build
npm run build

# Production start (runs migrations automatically)
npm start
```

## License

Private — All rights reserved.
