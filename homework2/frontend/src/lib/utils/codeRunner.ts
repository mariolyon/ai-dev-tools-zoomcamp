// Safe in-browser code execution using Web Workers and Pyodide

const UNSUPPORTED_LANG_NOTE = (lang: string) => `
Code execution for ${lang} is not available in the browser.
In a production environment, this would connect to a secure sandbox server.
`;

export interface ExecutionResult {
  output: string;
  error?: string;
  duration: number;
}

// Pyodide instance (loaded in main thread for reliability)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null;
let pyodideLoadPromise: Promise<void> | null = null;

// Declare the global loadPyodide function that will be available after script loads
declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function loadPyodide(): Promise<any>;
}

export async function executeCode(
  code: string,
  language: string,
): Promise<ExecutionResult> {
  const startTime = performance.now();

  if (language === "javascript" || language === "typescript") {
    return executeJavaScript(code, startTime);
  }

  if (language === "python") {
    return executePython(code, startTime);
  }

  return {
    output: UNSUPPORTED_LANG_NOTE(language),
    duration: performance.now() - startTime,
  };
}

// Load Pyodide script dynamically
function loadPyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="pyodide"]')) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Pyodide script"));
    document.head.appendChild(script);
  });
}

// Initialize Pyodide
async function initPyodide(): Promise<void> {
  if (pyodideInstance) return;
  if (pyodideLoadPromise) return pyodideLoadPromise;

  pyodideLoadPromise = (async () => {
    await loadPyodideScript();
    pyodideInstance = await loadPyodide();
  })();

  return pyodideLoadPromise;
}

async function executePython(
  code: string,
  startTime: number,
): Promise<ExecutionResult> {
  try {
    // Initialize Pyodide if needed
    await initPyodide();

    if (!pyodideInstance) {
      return {
        output: "",
        error: "Failed to initialize Python runtime",
        duration: performance.now() - startTime,
      };
    }

    // Set up stdout/stderr capture
    pyodideInstance.runPython(`
import sys
from io import StringIO
_captured_stdout = StringIO()
_captured_stderr = StringIO()
sys.stdout = _captured_stdout
sys.stderr = _captured_stderr
`);

    let result;
    let execError: string | null = null;

    try {
      result = pyodideInstance.runPython(code);
    } catch (err) {
      execError = err instanceof Error ? err.message : String(err);
    }

    // Get captured output
    const stdout = pyodideInstance.runPython("_captured_stdout.getvalue()");
    const stderr = pyodideInstance.runPython("_captured_stderr.getvalue()");

    // Reset stdout/stderr
    pyodideInstance.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);

    let output = stdout || "";
    if (stderr) {
      output += (output ? "\n" : "") + stderr;
    }

    if (execError) {
      return {
        output,
        error: execError,
        duration: performance.now() - startTime,
      };
    }

    // If there's a return value and no print output, show the result
    if (result !== undefined && result !== null && !stdout?.trim()) {
      const resultStr =
        typeof result === "object" && result.toString
          ? result.toString()
          : String(result);
      if (resultStr !== "None" && resultStr !== "undefined") {
        output += (output ? "\n" : "") + "=> " + resultStr;
      }
    }

    return {
      output: output || "Code executed successfully (no output)",
      duration: performance.now() - startTime,
    };
  } catch (err) {
    return {
      output: "",
      error: `Python error: ${err instanceof Error ? err.message : String(err)}`,
      duration: performance.now() - startTime,
    };
  }
}

// Pre-load Pyodide in the background
export function preloadPyodide(): void {
  initPyodide().catch(() => {
    // Silently fail on preload - will retry on actual execution
  });
}

function executeJavaScript(
  code: string,
  startTime: number,
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    // Create a blob with the worker code
    const workerCode = `
      const logs = [];
      const originalConsole = {
        log: (...args) => logs.push(args.map(a => formatValue(a)).join(' ')),
        error: (...args) => logs.push('Error: ' + args.map(a => formatValue(a)).join(' ')),
        warn: (...args) => logs.push('Warning: ' + args.map(a => formatValue(a)).join(' ')),
        info: (...args) => logs.push(args.map(a => formatValue(a)).join(' ')),
      };

      function formatValue(val) {
        if (val === null) return 'null';
        if (val === undefined) return 'undefined';
        if (typeof val === 'object') {
          try {
            return JSON.stringify(val, null, 2);
          } catch {
            return String(val);
          }
        }
        return String(val);
      }

      const console = originalConsole;

      self.onmessage = function(e) {
        const code = e.data;
        try {
          const result = eval(code);
          if (result !== undefined) {
            logs.push('=> ' + formatValue(result));
          }
          self.postMessage({ success: true, output: logs.join('\\n') });
        } catch (err) {
          self.postMessage({ success: false, error: err.message, output: logs.join('\\n') });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));

    const timeout = setTimeout(() => {
      worker.terminate();
      resolve({
        output: "",
        error: "Execution timed out (5s limit)",
        duration: 5000,
      });
    }, 5000);

    worker.onmessage = (e) => {
      clearTimeout(timeout);
      worker.terminate();

      const duration = performance.now() - startTime;

      if (e.data.success) {
        resolve({
          output: e.data.output || "Code executed successfully (no output)",
          duration,
        });
      } else {
        resolve({
          output: e.data.output,
          error: e.data.error,
          duration,
        });
      }
    };

    worker.onerror = (e) => {
      clearTimeout(timeout);
      worker.terminate();
      resolve({
        output: "",
        error: e.message || "Unknown error occurred",
        duration: performance.now() - startTime,
      });
    };

    worker.postMessage(code);
  });
}

