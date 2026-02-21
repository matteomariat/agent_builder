"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewChatPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New conversation" }),
      });
      if (cancelled) return;
      if (!res.ok) {
        router.push("/");
        return;
      }
      const data = await res.json();
      router.replace(`/chat/${data.id}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-zinc-500 dark:text-zinc-400">Creating conversation…</p>
    </div>
  );
}
