"use client";

type FormCardProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export function FormCard({ title, children, className = "" }: FormCardProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {title != null && (
        <h2 className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}
