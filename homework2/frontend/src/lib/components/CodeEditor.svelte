<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView, basicSetup } from "codemirror";
  import { EditorState, Compartment } from "@codemirror/state";
  import { syntaxHighlighting } from "@codemirror/language";
  import { javascript } from "@codemirror/lang-javascript";
  import { python } from "@codemirror/lang-python";
  import { java } from "@codemirror/lang-java";
  import { cpp } from "@codemirror/lang-cpp";
  import { rust } from "@codemirror/lang-rust";
  import { go } from "@codemirror/lang-go";
  import { oneDark, oneDarkHighlightStyle } from "@codemirror/theme-one-dark";

  interface Props {
    code: string;
    language: string;
    onCodeChange: (code: string) => void;
    readonly?: boolean;
  }

  let { code, language, onCodeChange, readonly = false }: Props = $props();

  let editorContainer: HTMLDivElement;
  let view: EditorView | null = null;
  let languageCompartment = new Compartment();
  let isExternalUpdate = false;

  function getLanguageExtension(lang: string) {
    switch (lang) {
      case "javascript":
      case "typescript":
        return javascript({ typescript: lang === "typescript", jsx: true });
      case "python":
        return python();
      case "java":
        return java();
      case "cpp":
      case "c":
        return cpp();
      case "rust":
        return rust();
      case "go":
        return go();
      default:
        return javascript();
    }
  }

  const customTheme = EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "14px",
    },
    ".cm-scroller": {
      fontFamily: "JetBrains Mono, monospace",
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: "#00fff5",
    },
    ".cm-cursor": {
      borderLeftColor: "#00fff5",
      borderLeftWidth: "2px",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(0, 255, 245, 0.05)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(0, 255, 245, 0.08)",
    },
    ".cm-gutters": {
      backgroundColor: "#12121a",
      borderRight: "1px solid #3d3d5c",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      color: "#6b6b8a",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "rgba(157, 78, 221, 0.3)",
    },
  });

  onMount(() => {
    const startState = EditorState.create({
      doc: code,
      extensions: [
        basicSetup,
        languageCompartment.of(getLanguageExtension(language)),
        oneDark,
        syntaxHighlighting(oneDarkHighlightStyle, { fallback: true }),
        customTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate) {
            onCodeChange(update.state.doc.toString());
          }
        }),
        EditorState.readOnly.of(readonly),
      ],
    });

    view = new EditorView({
      state: startState,
      parent: editorContainer,
    });
  });

  onDestroy(() => {
    if (view) {
      view.destroy();
    }
  });

  // Update code from external source (e.g., WebSocket)
  export function updateCode(newCode: string) {
    if (view && newCode !== view.state.doc.toString()) {
      isExternalUpdate = true;
      const transaction = view.state.update({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newCode,
        },
      });
      view.dispatch(transaction);
      isExternalUpdate = false;
    }
  }

  // Update language
  $effect(() => {
    if (view) {
      view.dispatch({
        effects: languageCompartment.reconfigure(
          getLanguageExtension(language),
        ),
      });
    }
  });
</script>

<div class="editor-wrapper">
  <div class="editor-container" bind:this={editorContainer}></div>
</div>

<style>
  .editor-wrapper {
    height: 100%;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 1px solid var(--border-color);
  }

  .editor-container {
    height: 100%;
    background: #1e1e2e;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }
</style>
