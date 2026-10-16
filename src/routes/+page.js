// The main app is a complex client-side SPA (Leaflet map, IndexedDB, sessionStorage).
// SSR produces a stale shell that mismatches the hydrated client, causing Svelte 5's
// reconciler to silently drop event handlers in production builds. Disabling SSR here
// makes the page render purely client-side — the layout wrapper is still SSR'd.
export const ssr = false;
