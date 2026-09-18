// Test stub. In the app, importing `server-only` makes a client-side import a
// build error; under Vitest the modules are imported directly on the server, so
// the guard has nothing to protect and would otherwise throw.
export {};
