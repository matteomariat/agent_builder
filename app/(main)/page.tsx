import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="mb-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
        Agent Builder
      </h1>
      <p className="mb-10 text-zinc-600 dark:text-zinc-400">
        Upload files, create agents, and chat with the Master agent. The working
        doc is shared between you and the agents.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/files"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Files
          </span>
          <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Upload .md, .csv, .txt, .pdf
          </span>
        </Link>
        <Link
          href="/agents"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Agents
          </span>
          <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create and manage agents
          </span>
        </Link>
        <Link
          href="/chat/new"
          className="flex flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <span className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            New chat
          </span>
          <span className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Chat with Master agent
          </span>
        </Link>
      </div>
    </div>
  );
}
