"use client";

type ResourceRowProps = {
  children: React.ReactNode;
  menu?: React.ReactNode;
  editForm?: React.ReactNode;
  isEditing?: boolean;
};

export function ResourceRow({
  children,
  menu,
  editForm,
  isEditing = false,
}: ResourceRowProps) {
  if (isEditing && editForm != null) {
    return (
      <li className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {editForm}
      </li>
    );
  }

  return (
    <li className="group relative flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800">
      <div className="min-w-0 flex-1">{children}</div>
      {menu != null && <div className="flex shrink-0">{menu}</div>}
    </li>
  );
}
