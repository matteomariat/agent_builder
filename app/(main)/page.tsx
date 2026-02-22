"use client";

import { useRouter } from "next/navigation";
import {
  ResourcePageLayout,
  ResourceActionBar,
} from "@/app/(main)/components/resource-list";
import { ProjectList } from "./components/ProjectList";

export default function HomePage() {
  const router = useRouter();

  return (
    <ResourcePageLayout
      title="Projects"
      description="Your chat projects. Start a new one or open an existing conversation."
      actionBar={
        <ResourceActionBar
          viewMode="cards"
          onViewModeChange={() => {}}
          addLabel="New project"
          onAdd={() => router.push("/chat/new")}
          showViewToggle={false}
        />
      }
    >
      <ProjectList />
    </ResourcePageLayout>
  );
}
