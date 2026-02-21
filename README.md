# Agent Builder

Upload files (.md, .csv, .txt, .pdf), create agents, and chat with a Master agent that can delegate to your agents and edit a shared working doc.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.local` and set:

   - `DATABASE_URL` – SQLite path (default `file:./local.db`) or Turso/D1 URL
   - `GOOGLE_GENERATIVE_AI_API_KEY` – Required for the Master and user agents (Gemini)
   - `BLOB_READ_WRITE_TOKEN` – Optional; if unset, uploads are stored under `./uploads`

3. **Database**

   ```bash
   npm run db:push
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Features

- **Files**: Upload .md, .csv, .txt, .pdf; text is extracted and available to the Master agent via the `research` tool.
- **Agents**: Create agents (name + system prompt + optional model). The Master can call them with the `invoke_agent` tool.
- **Chat**: Two-pane UI – Master agent chat on the left, working doc on the right. Doc is locked while the agent is generating so only one writer at a time.
- **Master agent**: Uses Vercel AI SDK with tools: `invoke_agent`, `write_to_doc`, `research`.

## Tech

- Next.js 16 (App Router), React 19, Tailwind CSS
- Vercel AI SDK, Google Gemini (@ai-sdk/google)
- Drizzle ORM, SQLite (or Turso/D1)
- Vercel Blob (optional) for file storage
