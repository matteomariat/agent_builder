"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MasterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/agents");
  }, [router]);
  return (
    <p className="px-4 py-8 text-zinc-500 dark:text-zinc-400">
      Redirecting to Agents…
    </p>
  );
}
