/**
 * Entry point of the review harness. Never part of the application build:
 * `tools/build-harness.js` is the only thing that points webpack at it.
 *
 * `electronBridge` reads `window.electronAPI` at module scope, so the stub has
 * to be in place before anything that imports it is loaded — hence the dynamic
 * import below rather than a normal one at the top of the file.
 */

const noop = () => undefined;

const stub = {
  native: new Proxy(
    {},
    {
      get: () => async (): Promise<string> => "{}",
    },
  ),
  clipboard: { writeText: noop, readText: () => "" },
  shell: { openExternal: async () => undefined, openPath: async () => "" },
  ipcRenderer: {
    invoke: async () => undefined,
    send: noop,
    on: () => noop,
    once: noop,
    removeAllListeners: noop,
  },
  fs: { existsSync: () => false, readFileSync: () => "", writeFileSync: noop },
  isSandboxed: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).electronAPI = stub;

import("./bootstrap");

export {};
