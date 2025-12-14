<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import OutputPanel from "$lib/components/OutputPanel.svelte";
  import { wsStore, type ConnectionState } from "$lib/stores/websocket";
  import { executeCode, preloadPyodide } from "$lib/utils/codeRunner";

  // Derive API URL from current location
  function getApiUrl(): string {
    if (!browser) return "http://localhost:3001";
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    return `${protocol}//${host}:3001`;
  }

  interface Props {
    data: { sessionId: string };
  }

  let { data }: Props = $props();

  let code = $state("// Loading...");
  let language = $state("javascript");
  let output = $state("");
  let isRunning = $state(false);
  let copied = $state(false);
  let editorComponent: CodeEditor;
  let connectionState = $state<ConnectionState>("disconnected");
  let participantCount = $state(0);
  let error = $state("");

  const languages = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "rust", label: "Rust" },
    { value: "go", label: "Go" },
  ];

  onMount(async () => {
    // First fetch the session to get initial state
    try {
      const res = await fetch(`${getApiUrl()}/api/sessions/${data.sessionId}`);
      if (!res.ok) {
        if (res.status === 404) {
          error = "Session not found";
          return;
        }
        throw new Error("Failed to fetch session");
      }

      const session = await res.json();
      code = session.code;
      language = session.language;

      // Preload Pyodide if the session starts with Python
      if (session.language === "python") {
        preloadPyodide();
      }

      await tick();
      editorComponent?.updateCode(code);
    } catch (e) {
      error = "Failed to connect to server. Is the backend running?";
      return;
    }

    // Connect to WebSocket
    wsStore.connect(data.sessionId);

    // Subscribe to store updates
    const unsubscribe = wsStore.subscribe((state) => {
      connectionState = state.state;
      participantCount = state.participantCount;
    });

    // Handle incoming messages
    const unsubInit = wsStore.on("init", (data) => {
      code = data.code;
      language = data.language;
      participantCount = data.participantCount;
      tick().then(() => editorComponent?.updateCode(data.code));
    });

    const unsubCodeUpdate = wsStore.on("code_update", (data) => {
      code = data.code;
      editorComponent?.updateCode(data.code);
    });

    const unsubLangChange = wsStore.on("language_change", (data) => {
      language = data.language;
    });

    return () => {
      unsubscribe();
      unsubInit();
      unsubCodeUpdate();
      unsubLangChange();
      wsStore.disconnect();
    };
  });

  function handleCodeChange(newCode: string) {
    code = newCode;
    wsStore.send("code_update", { code: newCode });
  }

  function handleLanguageChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    language = target.value;
    wsStore.send("language_change", { language: target.value });

    // Preload Pyodide when Python is selected for faster first execution
    if (target.value === "python") {
      preloadPyodide();
    }
  }

  async function runCode() {
    isRunning = true;
    output = "";

    // Show loading message for Python (Pyodide may need to load)
    if (language === "python") {
      output =
        "🐍 Loading Python runtime (first run may take a few seconds)...";
    }

    try {
      const result = await executeCode(code, language);

      if (result.error) {
        output = `❌ Error: ${result.error}\n\n${result.output}`;
      } else {
        output = result.output;
      }

      output += `\n\n⏱️ Executed in ${result.duration.toFixed(2)}ms`;
    } catch (e) {
      output = `❌ Execution failed: ${e}`;
    } finally {
      isRunning = false;
    }
  }

  async function copyLink() {
    const link = window.location.href;
    await navigator.clipboard.writeText(link);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function goHome() {
    goto("/");
  }
</script>

<svelte:head>
  <title>Room {data.sessionId} | CodeView</title>
</svelte:head>

{#if error}
  <div class="error-screen">
    <div class="error-content">
      <span class="error-icon">⚠️</span>
      <h2>Connection Error</h2>
      <p>{error}</p>
      <button class="btn btn-primary" onclick={goHome}>Back to Home</button>
    </div>
  </div>
{:else}
  <div class="room-container">
    <header class="room-header">
      <div class="header-left">
        <button class="logo-btn" onclick={goHome}>
          <span class="logo-mini">&lt;/&gt;</span>
          <span class="logo-text">CodeView</span>
        </button>
        <div class="session-info">
          <span class="session-id">Session: {data.sessionId}</span>
          <div
            class="connection-status"
            class:connected={connectionState === "connected"}
          >
            <span class="status-dot"></span>
            <span
              >{connectionState === "connected"
                ? "Connected"
                : connectionState}</span
            >
          </div>
        </div>
      </div>

      <div class="header-center">
        <div class="participants">
          <span class="participant-icon">👥</span>
          <span
            >{participantCount}
            {participantCount === 1 ? "participant" : "participants"}</span
          >
        </div>
      </div>

      <div class="header-right">
        <button class="btn btn-share" onclick={copyLink}>
          {#if copied}
            ✓ Copied!
          {:else}
            📋 Copy Link
          {/if}
        </button>
      </div>
    </header>

    <div class="toolbar">
      <div class="toolbar-left">
        <select
          class="language-select"
          value={language}
          onchange={handleLanguageChange}
        >
          {#each languages as lang}
            <option value={lang.value}>{lang.label}</option>
          {/each}
        </select>
      </div>

      <div class="toolbar-right">
        <button class="btn btn-run" onclick={runCode} disabled={isRunning}>
          {#if isRunning}
            <span class="spinner"></span>
            Running...
          {:else}
            ▶ Run Code
          {/if}
        </button>
      </div>
    </div>

    <main class="workspace">
      <div class="editor-panel">
        <CodeEditor
          bind:this={editorComponent}
          {code}
          {language}
          onCodeChange={handleCodeChange}
        />
      </div>
      <div class="output-wrapper">
        <OutputPanel {output} {isRunning} />
      </div>
    </main>
  </div>
{/if}

<style>
  .error-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .error-content {
    text-align: center;
    background: var(--bg-primary);
    padding: 3rem;
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-color);
    max-width: 400px;
  }

  .error-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .error-content h2 {
    margin-bottom: 0.5rem;
  }

  .error-content p {
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .room-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .room-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .logo-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    color: var(--text-primary);
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .logo-btn:hover {
    color: var(--accent-cyan);
  }

  .logo-mini {
    font-family: var(--font-mono);
    color: var(--accent-cyan);
    font-weight: 700;
  }

  .session-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .session-id {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text-muted);
    background: var(--bg-secondary);
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .connection-status.connected {
    color: var(--accent-green);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .connection-status.connected .status-dot {
    background: var(--accent-green);
    box-shadow: 0 0 8px var(--accent-green);
  }

  .header-center {
    display: flex;
    align-items: center;
  }

  .participants {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
  }

  .participant-icon {
    font-size: 1rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    border-radius: var(--radius-sm);
    transition: all 0.2s ease;
    border: none;
    cursor: pointer;
  }

  .btn-primary {
    background: linear-gradient(
      135deg,
      var(--accent-cyan),
      var(--accent-purple)
    );
    color: var(--bg-deep);
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 0 20px rgba(0, 255, 245, 0.3);
  }

  .btn-share {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-share:hover {
    background: var(--bg-tertiary);
    border-color: var(--accent-cyan);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.5rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .language-select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    cursor: pointer;
    min-width: 140px;
  }

  .language-select:focus {
    border-color: var(--accent-cyan);
    outline: none;
  }

  .btn-run {
    background: var(--accent-green);
    color: var(--bg-deep);
    font-weight: 600;
    padding: 0.5rem 1.25rem;
  }

  .btn-run:hover:not(:disabled) {
    background: #4dff4d;
    transform: translateY(-1px);
    box-shadow: 0 0 15px rgba(57, 255, 20, 0.4);
  }

  .btn-run:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .workspace {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 0;
    overflow: hidden;
    background: var(--bg-deep);
  }

  .editor-panel {
    height: 100%;
    overflow: hidden;
    padding: 1rem;
    padding-right: 0.5rem;
  }

  .output-wrapper {
    height: 100%;
    padding: 1rem;
    padding-left: 0.5rem;
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .workspace {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr 250px;
    }

    .editor-panel {
      padding-right: 1rem;
      padding-bottom: 0.5rem;
    }

    .output-wrapper {
      padding-left: 1rem;
      padding-top: 0.5rem;
    }

    .header-center {
      display: none;
    }

    .session-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>
