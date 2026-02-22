"use client";

type ResourceCardProps = {
  children: React.ReactNode;
  menu?: React.ReactNode;
  editForm?: React.ReactNode;
  isEditing?: boolean;
};

export function ResourceCard({
  children,
  menu,
  editForm,
  isEditing = false,
}: ResourceCardProps) {
  return (
    <li className="relative flex flex-col rounded-xl border border-zinc-200 bg-white transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800">
      {isEditing && editForm != null ? (
        <div className="p-4">{editForm}</div>
      ) : (
        <>
          {menu != null && (
            <div className="absolute right-1 top-1">{menu}</div>
          )}
          <div className="min-w-0 flex-1 p-4 pr-12">{children}</div>
        </>
      )}
    </li>
  );
}
