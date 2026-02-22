"use client";

type ResourcePageLayoutProps = {
  title: string;
  description: string;
  error?: string | null;
  actionBar?: React.ReactNode;
  children: React.ReactNode;
};

export function ResourcePageLayout({
  title,
  description,
  error,
  actionBar,
  children,
}: ResourcePageLayoutProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">{description}</p>

      {error && (
        <div
          className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {actionBar != null && <div className="mb-6">{actionBar}</div>}

      {children}
    </div>
  );
}
