// Runs user code from <Runner> blocks.
// JavaScript: a fresh Web Worker per run (terminated on timeout, so infinite loops can't freeze the page).
// Python: one shared Pyodide worker per page, so Python cells share state like a notebook.

export type Lang = 'js' | 'python';
export type Msg = { type: 'log' | 'warn' | 'error' | 'info' | 'status'; text: string };

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';

const JS_WORKER = `
const seen = () => new WeakSet();
function fmt(v, ws = seen()) {
  if (typeof v === 'string') return v;
  if (v === undefined) return 'undefined';
  if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
  if (typeof v === 'bigint') return v + 'n';
  if (typeof v === 'symbol') return v.toString();
  if (v instanceof Error) return v.name + ': ' + v.message;
  if (v instanceof ArrayBuffer) v = new Uint8Array(v);
  if (ArrayBuffer.isView(v) && !(v instanceof DataView))
    return v.constructor.name + '(' + v.length + ') [' + Array.from(v.slice(0, 64)).join(', ') + (v.length > 64 ? ', …' : '') + ']';
  if (v instanceof Map) return 'Map(' + v.size + ') ' + fmt(Object.fromEntries(v), ws);
  if (v instanceof Set) return 'Set(' + v.size + ') ' + fmt([...v], ws);
  try {
    return JSON.stringify(v, (k, x) => {
      if (typeof x === 'bigint') return x + 'n';
      if (typeof x === 'object' && x !== null) { if (ws.has(x)) return '[Circular]'; ws.add(x); }
      return x;
    }, 2);
  } catch { return String(v); }
}
const send = (type) => (...a) => postMessage({ type, text: a.map((x) => fmt(x)).join(' ') });
console.log = send('log'); console.info = send('info'); console.debug = send('log');
console.warn = send('warn'); console.error = send('error');
console.table = (d) => postMessage({ type: 'log', text: fmt(d) });
self.onmessage = async (e) => {
  try {
    const AsyncFunction = (async () => {}).constructor;
    await new AsyncFunction(e.data)();
  } catch (err) {
    postMessage({ type: 'error', text: (err && err.name ? err.name + ': ' + err.message : String(err)) });
  }
  postMessage({ type: 'done' });
};
`;

const PY_WORKER = `
importScripts('${PYODIDE}pyodide.js');
let ready = loadPyodide({ indexURL: '${PYODIDE}' }).then((py) => {
  py.setStdout({ batched: (s) => postMessage({ type: 'log', text: s }) });
  py.setStderr({ batched: (s) => postMessage({ type: 'error', text: s }) });
  return py;
});
self.onmessage = async (e) => {
  let py;
  try { py = await ready; } catch (err) {
    postMessage({ type: 'error', text: 'Failed to load Python runtime: ' + err });
    postMessage({ type: 'done' });
    return;
  }
  postMessage({ type: 'started' });
  try {
    await py.loadPackagesFromImports(e.data);
    const result = await py.runPythonAsync(e.data);
    if (result !== undefined && result !== null) {
      postMessage({ type: 'log', text: String(result) });
      if (result.destroy) result.destroy();
    }
  } catch (err) {
    const msg = String(err.message || err);
    // trim pyodide's internal frames
    const i = msg.indexOf('File "<exec>"');
    postMessage({ type: 'error', text: i > -1 ? 'Traceback (most recent call last):\\n  ' + msg.slice(i) : msg });
  }
  postMessage({ type: 'done' });
};
`;

const blobUrl = (src: string) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
let jsUrl: string | undefined;
let pyUrl: string | undefined;
let pyWorker: Worker | undefined;
let pyLoaded = false;
let pyQueue: Promise<unknown> = Promise.resolve();

export function run(
  lang: Lang,
  code: string,
  onMsg: (m: Msg) => void,
  timeoutMs = lang === 'python' ? 30000 : 5000,
): Promise<void> {
  return lang === 'python' ? runPython(code, onMsg, timeoutMs) : runJs(code, onMsg, timeoutMs);
}

function runJs(code: string, onMsg: (m: Msg) => void, timeoutMs: number) {
  jsUrl ??= blobUrl(JS_WORKER);
  return new Promise<void>((resolve) => {
    const w = new Worker(jsUrl!);
    const timer = setTimeout(() => {
      w.terminate();
      onMsg({ type: 'error', text: `⏱ Execution timed out after ${timeoutMs / 1000}s (infinite loop?) — worker killed.` });
      resolve();
    }, timeoutMs);
    w.onmessage = (e) => {
      if (e.data.type === 'done') {
        clearTimeout(timer);
        w.terminate();
        resolve();
      } else onMsg(e.data);
    };
    w.onerror = (e) => {
      clearTimeout(timer);
      onMsg({ type: 'error', text: e.message });
      w.terminate();
      resolve();
    };
    w.postMessage(code);
  });
}

function runPython(code: string, onMsg: (m: Msg) => void, timeoutMs: number) {
  // Serialize python runs: they share one interpreter.
  const job = pyQueue.then(
    () =>
      new Promise<void>((resolve) => {
        pyUrl ??= blobUrl(PY_WORKER);
        if (!pyWorker) {
          pyWorker = new Worker(pyUrl);
          pyLoaded = false;
        }
        const w = pyWorker;
        if (!pyLoaded) onMsg({ type: 'status', text: 'Loading Python runtime (~10 MB, first run only)…' });
        let timer: ReturnType<typeof setTimeout> | undefined;
        w.onmessage = (e) => {
          const d = e.data;
          if (d.type === 'started') {
            if (!pyLoaded) onMsg({ type: 'status', text: '' });
            pyLoaded = true;
            timer = setTimeout(() => {
              w.terminate();
              pyWorker = undefined;
              onMsg({
                type: 'error',
                text: `⏱ Timed out after ${timeoutMs / 1000}s — Python runtime restarted (variables were reset).`,
              });
              resolve();
            }, timeoutMs);
          } else if (d.type === 'done') {
            clearTimeout(timer);
            resolve();
          } else onMsg(d);
        };
        w.onerror = (e) => {
          clearTimeout(timer);
          onMsg({ type: 'error', text: e.message || 'Python worker crashed' });
          w.terminate();
          pyWorker = undefined;
          resolve();
        };
        w.postMessage(code);
      }),
  );
  pyQueue = job;
  return job;
}

/* ---------- tiny syntax highlighter for the editor overlay ---------- */

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const JS_KW =
  'await|async|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|yield';
const JS_LIT = 'true|false|null|undefined|NaN|Infinity';
const PY_KW =
  'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield';
const PY_LIT = 'True|False|None|self';

const RULES: Record<Lang, RegExp> = {
  js: new RegExp(
    [
      String.raw`(?<c>\/\/.*|\/\*[\s\S]*?(?:\*\/|$))`,
      String.raw`(?<s>"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|` + '`(?:\\\\.|[^`\\\\])*`?)',
      String.raw`(?<k>\b(?:${JS_KW})\b)`,
      String.raw`(?<l>\b(?:${JS_LIT})\b)`,
      String.raw`(?<n>\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?n?)\b)`,
      String.raw`(?<f>\b[A-Za-z_$][\w$]*(?=\s*\())`,
    ].join('|'),
    'g',
  ),
  python: new RegExp(
    [
      String.raw`(?<c>#.*)`,
      String.raw`(?<s>[rbfuRBFU]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))`,
      String.raw`(?<k>\b(?:${PY_KW})\b)`,
      String.raw`(?<l>\b(?:${PY_LIT})\b)`,
      String.raw`(?<n>\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b)`,
      String.raw`(?<f>\b[A-Za-z_]\w*(?=\s*\())`,
      String.raw`(?<d>@[\w.]+)`,
    ].join('|'),
    'g',
  ),
};

export function highlight(code: string, lang: Lang): string {
  const re = RULES[lang];
  let out = '';
  let last = 0;
  for (const m of code.matchAll(re)) {
    const idx = m.index!;
    out += escHtml(code.slice(last, idx));
    const g = Object.entries(m.groups!).find(([, v]) => v !== undefined)?.[0] ?? '';
    out += `<span class="hl-${g}">${escHtml(m[0])}</span>`;
    last = idx + m[0].length;
  }
  return out + escHtml(code.slice(last)) + '\n';
}
