<script lang="ts">
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";

  let isCreating = $state(false);
  let joinCode = $state("");
  let error = $state("");

  // Derive API URL from current location
  function getApiUrl(): string {
    if (!browser) return "http://localhost:3001";
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    return `${protocol}//${host}:3001`;
  }

  async function createSession() {
    isCreating = true;
    error = "";

    try {
      const res = await fetch(`${getApiUrl()}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Failed to create session");

      const data = await res.json();
      goto(`/room/${data.id}`);
    } catch (e) {
      error = "Failed to create session. Is the server running?";
      isCreating = false;
    }
  }

  function joinSession() {
    if (joinCode.trim()) {
      goto(`/room/${joinCode.trim()}`);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      joinSession();
    }
  }
</script>

<svelte:head>
  <title>CodeView | Live Coding Interviews</title>
</svelte:head>

<main class="landing">
  <div class="hero">
    <div class="logo-container">
      <div class="logo-icon">
        <span class="bracket">&lt;</span>
        <span class="slash">/</span>
        <span class="bracket">&gt;</span>
      </div>
      <h1 class="logo-text">Code<span class="accent">View</span></h1>
    </div>

    <p class="tagline">Real-time collaborative coding interviews</p>

    <div class="features">
      <div class="feature">
        <span class="feature-icon">⚡</span>
        <span>Real-time sync</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🎨</span>
        <span>Syntax highlighting</span>
      </div>
      <div class="feature">
        <span class="feature-icon">▶</span>
        <span>In-browser execution</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🔗</span>
        <span>Instant sharing</span>
      </div>
    </div>
  </div>

  <div class="actions">
    <div class="action-card create-card">
      <h2>Start Interview</h2>
      <p>Create a new coding session and share the link with candidates</p>
      <button
        class="btn btn-primary"
        onclick={createSession}
        disabled={isCreating}
      >
        {#if isCreating}
          <span class="spinner"></span>
          Creating...
        {:else}
          Create Session
        {/if}
      </button>
    </div>

    <div class="divider">
      <span>or</span>
    </div>

    <div class="action-card join-card">
      <h2>Join Session</h2>
      <p>Enter a session code to join an existing interview</p>
      <div class="input-group">
        <input
          type="text"
          placeholder="Enter session code..."
          bind:value={joinCode}
          onkeydown={handleKeydown}
        />
        <button
          class="btn btn-secondary"
          onclick={joinSession}
          disabled={!joinCode.trim()}
        >
          Join
        </button>
      </div>
    </div>
  </div>

  {#if error}
    <div class="error-toast">
      <span>⚠️</span>
      {error}
    </div>
  {/if}

  <footer class="footer">
    <p>Built for seamless technical interviews</p>
  </footer>
</main>

<style>
  .landing {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 3rem;
  }

  .hero {
    text-align: center;
    animation: fadeInUp 0.6s ease-out;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .logo-icon {
    font-family: var(--font-mono);
    font-size: 3rem;
    font-weight: 700;
    display: flex;
    gap: 0.2rem;
  }

  .bracket {
    color: var(--accent-cyan);
    text-shadow: 0 0 20px var(--accent-cyan);
  }

  .slash {
    color: var(--accent-magenta);
    text-shadow: 0 0 20px var(--accent-magenta);
  }

  .logo-text {
    font-size: 3.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .accent {
    color: var(--accent-cyan);
  }

  .tagline {
    font-size: 1.25rem;
    color: var(--text-secondary);
    margin-top: 0.5rem;
  }

  .features {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 2rem;
  }

  .feature {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    font-size: 0.9rem;
    color: var(--text-secondary);
    transition: all 0.2s ease;
  }

  .feature:hover {
    border-color: var(--accent-cyan);
    transform: translateY(-2px);
  }

  .feature-icon {
    font-size: 1.1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    align-items: center;
    justify-content: center;
    animation: fadeInUp 0.6s ease-out 0.2s both;
  }

  .action-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
    padding: 2rem;
    width: 320px;
    text-align: center;
    transition: all 0.3s ease;
  }

  .action-card:hover {
    border-color: var(--accent-purple);
    box-shadow: var(--shadow-glow);
  }

  .action-card h2 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .action-card p {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .create-card:hover {
    border-color: var(--accent-cyan);
  }

  .join-card:hover {
    border-color: var(--accent-magenta);
  }

  .btn {
    padding: 0.875rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: linear-gradient(
      135deg,
      var(--accent-cyan),
      var(--accent-purple)
    );
    color: var(--bg-deep);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(0, 255, 245, 0.4);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--accent-magenta);
    border-color: var(--accent-magenta);
    transform: translateY(-2px);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
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

  .divider {
    display: flex;
    align-items: center;
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .input-group {
    display: flex;
    gap: 0.5rem;
  }

  .input-group input {
    flex: 1;
    min-width: 0;
  }

  .error-toast {
    position: fixed;
    bottom: 2rem;
    background: rgba(255, 59, 48, 0.9);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .footer {
    margin-top: auto;
    padding-top: 2rem;
    color: var(--text-muted);
    font-size: 0.85rem;
    animation: fadeInUp 0.6s ease-out 0.4s both;
  }

  @media (max-width: 768px) {
    .logo-text {
      font-size: 2.5rem;
    }

    .actions {
      flex-direction: column;
    }

    .action-card {
      width: 100%;
      max-width: 320px;
    }

    .divider {
      transform: rotate(90deg);
    }
  }
</style>
