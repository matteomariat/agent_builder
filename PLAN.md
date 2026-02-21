# Multi-Agent App — Implementation Plan

## Product Vision

A Next.js app where users upload documents, configure AI agents, and collaborate with them on a shared rich-text working document. A **master agent** orchestrates the session from a left-panel chat, spawning **subagents** as tool calls. Both the user and agents can edit the right-panel document, but never simultaneously (mutex lock).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| AI SDK | Vercel AI SDK (`ai` + `@ai-sdk/google`) |
| Model | Google Gemini (2.0 Flash by default) |
| Editor | TipTap (headless WYSIWYG) |
| State | Zustand |
| Styling | Tailwind CSS + shadcn/ui |
| File parsing | `pdf-parse`, native for txt/md/csv |
| File storage | In-memory / localStorage (no backend DB for now) |

---

## App Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Project name │ Upload Files │ Configure Agents      │
├──────────────────────────┬──────────────────────────────────┤
│   LEFT PANE              │   RIGHT PANE                     │
│                          │                                  │
│   Master Agent Chat      │   Working Document               │
│   ─────────────────      │   ───────────────                │
│   [messages stream]      │   [TipTap WYSIWYG Editor]        │
│                          │                                  │
│   Subagent Activity      │   Lock indicator:                │
│   ─────────────────      │   🟢 Free / 🔴 Agent writing /   │
│   > subagent-1 running   │   🔵 You are editing             │
│   > subagent-2 done      │                                  │
│                          │                                  │
│   [input bar]            │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

---

## File Structure

```
agent_builder/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Main split-pane UI
│   ├── globals.css
│   └── api/
│       ├── chat/
│       │   └── route.ts            # Master agent streaming endpoint
│       ├── subagent/
│       │   └── route.ts            # Subagent execution endpoint
│       └── upload/
│           └── route.ts            # File upload + text extraction
├── components/
│   ├── layout/
│   │   ├── Header.tsx              # Top bar: uploads, agent config
│   │   └── SplitPane.tsx           # Resizable left/right layout
│   ├── chat/
│   │   ├── ChatPane.tsx            # Left pane container
│   │   ├── MessageList.tsx         # Streamed message history
│   │   ├── MessageInput.tsx        # User input bar
│   │   └── SubagentFeed.tsx        # Live subagent activity feed
│   ├── document/
│   │   ├── DocumentPane.tsx        # Right pane container
│   │   ├── Editor.tsx              # TipTap editor instance
│   │   └── LockBadge.tsx           # Shows current lock holder
│   ├── files/
│   │   ├── FileUploadZone.tsx      # Drag & drop + file picker
│   │   └── FileList.tsx            # Chips showing uploaded files
│   └── agents/
│       ├── AgentDialog.tsx         # Modal: create/edit agent config
│       └── AgentList.tsx           # Sidebar list of configured agents
├── lib/
│   ├── ai/
│   │   ├── tools.ts                # Shared tool definitions
│   │   ├── master-agent.ts         # Master agent system prompt builder
│   │   └── subagent.ts             # Subagent runner util
│   ├── store/
│   │   └── useAppStore.ts          # Zustand global store
│   └── utils/
│       └── file-extraction.ts      # Text extraction per file type
├── package.json
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Data Model (Zustand Store)

```ts
interface AppState {
  // Files
  files: UploadedFile[]               // { id, name, type, content: string }

  // Agents
  agents: AgentConfig[]               // { id, name, systemPrompt, modelId }

  // Chat
  messages: Message[]                 // Vercel AI SDK message format
  isStreaming: boolean

  // Subagent activity
  subagentTasks: SubagentTask[]       // { id, agentId, status, result }

  // Document
  documentContent: string             // TipTap JSON or HTML
  documentLock: 'idle' | 'user' | 'agent'
  documentLockHolder: string | null   // agent name or 'user'
}
```

---

## AI Tool Definitions

All agents share these tools:

### `writeToDocument`
Acquires the document lock, replaces or appends content. Lock is released after write completes. If the lock is held by the user, the agent waits (queued).

```ts
writeToDocument: tool({
  description: 'Write or append content to the working document',
  parameters: z.object({
    content: z.string().describe('HTML or markdown content to write'),
    mode: z.enum(['replace', 'append']).default('append'),
  }),
  execute: async ({ content, mode }) => { /* SSE back to client */ }
})
```

### `readDocument`
Returns the current document content as plain text.

```ts
readDocument: tool({
  description: 'Read the current content of the working document',
  parameters: z.object({}),
  execute: async () => { /* return doc content */ }
})
```

### `spawnSubagent` _(master agent only)_
Spawns a subagent with a specific task. The master agent describes the task and optionally specifies which subagent (by name) to use.

```ts
spawnSubagent: tool({
  description: 'Spawn a subagent to handle a specific subtask',
  parameters: z.object({
    agentId: z.string().describe('ID of the configured subagent to use'),
    task: z.string().describe('The specific task for the subagent to complete'),
    context: z.string().optional().describe('Extra context or data to pass'),
  }),
  execute: async ({ agentId, task, context }) => {
    // Calls POST /api/subagent and streams results back
  }
})
```

### `readFile`
Read the content of an uploaded file by name.

```ts
readFile: tool({
  description: 'Read the content of an uploaded file',
  parameters: z.object({
    filename: z.string(),
  }),
  execute: async ({ filename }) => { /* return file content */ }
})
```

---

## API Routes

### `POST /api/chat` — Master Agent

```
Request: { messages, agentConfig, files, documentContent }
Response: AI SDK data stream (streamText with tools)
```

- Uses `streamText` from Vercel AI SDK
- Model: `google('gemini-2.0-flash')`
- Tools: `writeToDocument`, `readDocument`, `spawnSubagent`, `readFile`
- System prompt includes: master agent config + list of available subagents + uploaded file names

### `POST /api/subagent` — Subagent Execution

```
Request: { agentConfig, task, context, documentContent, files }
Response: AI SDK data stream
```

- Spawned by master agent's `spawnSubagent` tool call
- Tools: `writeToDocument`, `readDocument`, `readFile`
- No `spawnSubagent` (subagents cannot nest by default)

### `POST /api/upload` — File Upload

```
Request: FormData with file(s)
Response: { id, name, type, content: string }
```

- Parses .txt, .md, .csv as UTF-8 text
- Parses .pdf with `pdf-parse`
- Returns extracted text content

---

## Document Locking Logic

### Lock States

| State | Description | Editor mode |
|---|---|---|
| `idle` | No one editing | Editable by user, writable by agents |
| `user` | User is actively typing | Agents queue writes, cannot interrupt |
| `agent` | Agent is writing to doc | Editor is read-only for user |

### Lock Acquisition

1. **User starts editing** → set lock to `user`, disable agent writes
2. **User stops editing** (blur / 2s debounce) → release lock → flush agent queue
3. **Agent calls `writeToDocument`** → if lock is `idle`, acquire and write; if `user`, enqueue and wait; if `agent`, queue (sequential)

### Implementation

- Lock state lives in Zustand
- `writeToDocument` tool execution sends SSE events: `lock_acquired`, `document_updated`, `lock_released`
- TipTap editor subscribes to lock state → `editable` prop toggled dynamically

---

## Streaming Architecture

```
User types message
        ↓
POST /api/chat  →  streamText (Gemini)
        ↓
  [text chunk]  →  MessageList streams text
        ↓
  [tool_call: spawnSubagent]
        ↓
  POST /api/subagent (parallel)
        ↓
  [subagent text + writeToDocument]
        ↓
  SSE events → documentContent updated in store
        ↓
  TipTap editor re-renders with new content
```

Client uses Vercel AI SDK's `useChat` hook for the master agent chat. Subagent streams are handled separately via `fetch` + `ReadableStream`.

---

## Implementation Steps

### Phase 1 — Project Scaffolding
1. `npx create-next-app@latest` with TypeScript + Tailwind
2. Install deps: `ai`, `@ai-sdk/google`, `zustand`, `@tiptap/react`, `@tiptap/starter-kit`, `pdf-parse`, `shadcn/ui`
3. Set up `next.config.ts` (increase body size limit for uploads)
4. Add `.env.local` with `GOOGLE_GENERATIVE_AI_API_KEY`

### Phase 2 — Store + Layout
5. Create Zustand store (`useAppStore.ts`)
6. Build `SplitPane.tsx` resizable layout (left 40% / right 60%)
7. Build `Header.tsx` with file upload trigger and agent config button

### Phase 3 — File Upload
8. Build `FileUploadZone.tsx` (drag & drop, multi-file)
9. Build `POST /api/upload` route with `pdf-parse` + text extraction
10. Display uploaded files as chips in the header

### Phase 4 — Agent Configuration
11. Build `AgentDialog.tsx` — modal form (name, system prompt, model selector)
12. Build `AgentList.tsx` — shows configured agents, designate one as master
13. Persist agents in Zustand (and optionally localStorage)

### Phase 5 — Master Agent Chat
14. Build `ChatPane.tsx` with `useChat` hook from Vercel AI SDK
15. Build `MessageList.tsx` with streaming text rendering
16. Build `MessageInput.tsx` with keyboard shortcuts
17. Build `POST /api/chat` route with master agent + all tools

### Phase 6 — Working Document
18. Build `Editor.tsx` with TipTap (StarterKit + placeholder)
19. Build `LockBadge.tsx` showing current lock state
20. Wire lock state: user focus/blur → Zustand lock
21. Wire `editable` prop to lock state

### Phase 7 — Subagent Spawning
22. Build `POST /api/subagent` route
23. Implement `spawnSubagent` tool on master agent (calls `/api/subagent`)
24. Build `SubagentFeed.tsx` — live activity list in left pane below chat
25. Wire subagent `writeToDocument` tool → SSE → Zustand → TipTap update

### Phase 8 — Document Write Tool
26. Implement `writeToDocument` on both master + subagents
27. Implement lock acquisition check server-side
28. Implement client-side queue for competing writes
29. Implement `readDocument` tool

### Phase 9 — Polish
30. Add typing indicators for agent activity
31. Add file content injection into agent system prompts
32. Handle errors (model failures, lock timeouts)
33. Add copy-to-clipboard for document

---

## Key Dependencies

```json
{
  "dependencies": {
    "ai": "^4.x",
    "@ai-sdk/google": "^1.x",
    "next": "^15.x",
    "react": "^19.x",
    "zustand": "^5.x",
    "@tiptap/react": "^2.x",
    "@tiptap/starter-kit": "^2.x",
    "@tiptap/extension-placeholder": "^2.x",
    "pdf-parse": "^1.x",
    "shadcn-ui": "latest",
    "tailwindcss": "^3.x",
    "zod": "^3.x"
  }
}
```

---

## Open Questions / Decisions

1. **Where does document content live server-side?** Currently in-memory in the Zustand store. For multi-tab or persistence, would need a DB or Redis. Start with client-only.
2. **Subagent parallelism**: Multiple subagents can run simultaneously but should queue `writeToDocument` calls sequentially to avoid conflicts.
3. **Max file size**: Set `next.config.ts` body size limit to 10MB.
4. **Gemini model selection**: Default to `gemini-2.0-flash` for speed. Allow switching to `gemini-1.5-pro` for longer context (files).
