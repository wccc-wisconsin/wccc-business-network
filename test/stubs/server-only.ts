/**
 * Stands in for the `server-only` package during tests.
 *
 * The real package throws the moment it is imported outside a React Server
 * Component. That is its entire purpose: it is what guarantees lib/appStore.ts,
 * which holds SUPABASE_SERVICE_ROLE_KEY, can never be pulled into a browser
 * bundle by an accidental import from a client component.
 *
 * A Vitest run is neither a server component nor a browser, so the real package
 * throws there too, and nothing that imports it would be testable. vitest.config.ts
 * aliases the package to this empty module for the test run only — the app's own
 * build still imports the real one and keeps the protection.
 *
 * The wrong fix would be deleting the `import "server-only"` lines from the
 * source to make tests pass. That trades a real safety property for a green
 * check.
 */
export {};
