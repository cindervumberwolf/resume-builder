import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage, indentOnInput } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { githubLight } from "@uiw/codemirror-theme-github";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function LaTeXEditor({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        githubLight,
        StreamLanguage.define(stex),
        lineNumbers(),
        highlightActiveLine(),
        history(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        updateListener,
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { overflow: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
          ".cm-content": { minHeight: "100%" },
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    return () => view.destroy();
  }, []);

  // Sync external value changes (e.g., loading a template)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", overflow: "hidden", border: "1px solid #e0e0e0", borderRadius: 4 }}
    />
  );
}
