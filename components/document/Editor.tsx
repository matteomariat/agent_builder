"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useAppStore } from "@/lib/store/useAppStore";

export default function Editor() {
  const { documentContent, documentLock, setDocumentContent, setDocumentLock } =
    useAppStore((s) => ({
      documentContent: s.documentContent,
      documentLock: s.documentLock,
      setDocumentContent: s.setDocumentContent,
      setDocumentLock: s.setDocumentLock,
    }));

  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAgentUpdate = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "The working document will appear here. Agents and you can write here…",
      }),
    ],
    content: documentContent || "",
    editable: documentLock !== "agent",
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setDocumentLock("user", "You");
    },
    onBlur: () => {
      blurTimer.current = setTimeout(() => {
        setDocumentLock("idle");
      }, 1500);
    },
    onUpdate: ({ editor }) => {
      if (isAgentUpdate.current) return;
      setDocumentContent(editor.getHTML());
    },
  });

  // Sync external doc changes (from agent writes) into TipTap
  useEffect(() => {
    if (!editor) return;
    const editorHtml = editor.getHTML();
    if (documentContent !== editorHtml) {
      isAgentUpdate.current = true;
      editor.commands.setContent(documentContent || "");
      isAgentUpdate.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentContent]);

  // Sync editable state with lock
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(documentLock !== "agent", false);
  }, [editor, documentLock]);

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <EditorContent
        editor={editor}
        className="flex-1 prose prose-sm max-w-none p-4 focus:outline-none"
      />
    </div>
  );
}
