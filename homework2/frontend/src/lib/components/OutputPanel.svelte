<script lang="ts">
  interface Props {
    output: string;
    isRunning: boolean;
  }

  let { output, isRunning }: Props = $props();
</script>

<div class="output-panel">
  <div class="output-header">
    <span class="output-title">
      <span class="icon">▸</span>
      Output
    </span>
    {#if isRunning}
      <span class="running-indicator">
        <span class="dot"></span>
        Running...
      </span>
    {/if}
  </div>
  <div class="output-content">
    <pre>{output || 'Click "Run" to execute your code...'}</pre>
  </div>
</div>

<style>
  .output-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .output-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }

  .output-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .icon {
    color: var(--accent-green);
  }

  .running-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: var(--accent-cyan);
  }

  .dot {
    width: 8px;
    height: 8px;
    background: var(--accent-cyan);
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .output-content {
    flex: 1;
    padding: 1rem;
    overflow: auto;
  }

  .output-content pre {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
  }
</style>

