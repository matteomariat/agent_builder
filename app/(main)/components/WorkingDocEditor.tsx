"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef } from "react";

type WorkingDocEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  exportFileName?: string;
  onPersistedUndo?: () => void;
  onPersistedRedo?: () => void;
  canPersistedUndo?: boolean;
  canPersistedRedo?: boolean;
};

const TB = "rounded p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:pointer-events-none dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100";
const TB_ACTIVE = "bg-zinc-200 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100";

function ToolbarDivider() {
  return (
    <span
      className="mx-0.5 w-px self-stretch bg-zinc-300 dark:bg-zinc-600"
      aria-hidden
    />
  );
}

export function WorkingDocEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Shared doc. You and the agent can edit (not at the same time).",
  className = "",
  exportFileName = "working-doc.md",
  onPersistedUndo,
  onPersistedRedo,
  canPersistedUndo = false,
  canPersistedRedo = false,
}: WorkingDocEditorProps) {
  const lastEmittedRef = useRef<string>(value);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit,
        Markdown,
        Placeholder.configure({
          placeholder,
          showOnlyWhenEditable: true,
        }),
      ],
      content: value,
      contentType: "markdown",
      editable: !readOnly,
      editorProps: {
        attributes: {
          class:
            "min-h-full w-full p-4 focus:outline-none [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-medium [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_p]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:bg-zinc-100 [&_code]:dark:bg-zinc-800 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-zinc-100 [&_pre]:dark:bg-zinc-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto",
        },
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor) return;
    if (value !== lastEmittedRef.current) {
      editor.commands.setContent(value, { contentType: "markdown" });
      lastEmittedRef.current = value;
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const fn = () => {
      const md = editor.getMarkdown();
      lastEmittedRef.current = md;
      onChange(md);
    };
    editor.on("update", fn);
    return () => {
      editor.off("update", fn);
    };
  }, [editor, onChange]);

  const handleExportMd = useCallback(() => {
    if (!editor) return;
    const md = editor.getMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [editor, exportFileName]);

  if (!editor) {
    return (
      <div
        className={`min-h-[200px] w-full rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 ${className}`}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${className}`}
    >
      {!readOnly && (
        <div
          className="flex flex-shrink-0 items-center gap-0.5 overflow-x-auto border-b border-zinc-200 bg-zinc-50/80 px-1 py-1 dark:border-zinc-800 dark:bg-zinc-800/50 [scrollbar-width:thin]"
          role="toolbar"
          aria-label="Formatting"
        >
          <button
            type="button"
            className={TB}
            onClick={() => {
              if (canPersistedUndo && onPersistedUndo) onPersistedUndo();
              else editor.chain().focus().undo().run();
            }}
            disabled={canPersistedUndo ? !canPersistedUndo : !editor.can().undo()}
            title="Undo"
            aria-label="Undo"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            type="button"
            className={TB}
            onClick={() => {
              if (canPersistedRedo && onPersistedRedo) onPersistedRedo();
              else editor.chain().focus().redo().run();
            }}
            disabled={canPersistedRedo ? !canPersistedRedo : !editor.can().redo()}
            title="Redo"
            aria-label="Redo"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
          <ToolbarDivider />
          <button
            type="button"
            className={`${TB} ${editor.isActive("paragraph") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Paragraph"
            aria-label="Paragraph"
          >
            <span className="px-1 text-xs font-medium">P</span>
          </button>
          <button
            type="button"
            className={`${TB} ${editor.isActive("heading", { level: 1 }) ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
            aria-label="Heading 1"
          >
            <span className="px-0.5 text-xs font-bold">H1</span>
          </button>
          <button
            type="button"
            className={`${TB} ${editor.isActive("heading", { level: 2 }) ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
            aria-label="Heading 2"
          >
            <span className="px-0.5 text-xs font-bold">H2</span>
          </button>
          <button
            type="button"
            className={`${TB} ${editor.isActive("heading", { level: 3 }) ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
            aria-label="Heading 3"
          >
            <span className="px-0.5 text-xs font-bold">H3</span>
          </button>
          <ToolbarDivider />
          <button
            type="button"
            className={`${TB} ${editor.isActive("bold") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
            aria-label="Bold"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
            </svg>
          </button>
          <button
            type="button"
            className={`${TB} ${editor.isActive("italic") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
            aria-label="Italic"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
            </svg>
          </button>
          <ToolbarDivider />
          <button
            type="button"
            className={`${TB} ${editor.isActive("bulletList") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet list"
            aria-label="Bullet list"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            className={`${TB} ${editor.isActive("orderedList") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
            aria-label="Numbered list"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10M7 16h10M5 8v.01M5 12v.01M5 16v.01" />
            </svg>
          </button>
          <ToolbarDivider />
          <button
            type="button"
            className={`${TB} ${editor.isActive("blockquote") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
            aria-label="Block quote"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
            </svg>
          </button>
          <button
            type="button"
            className={`${TB} ${editor.isActive("codeBlock") ? TB_ACTIVE : ""}`}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code block"
            aria-label="Code block"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M4 20l4-16m4 4l4 4-4 4" />
            </svg>
          </button>
          <div className="ml-auto flex flex-shrink-0 items-center">
            <button
              type="button"
              className={TB}
              onClick={handleExportMd}
              title="Export as Markdown"
              aria-label="Export as Markdown"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
