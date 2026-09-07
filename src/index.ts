// @meddleware/seal-ui — library entry.
//
// Exports the core Sealed Storage tool view (no app shell) for inline embedding in the dashboard.
// The standalone SPA (App.vue + main.ts) is unaffected and still builds/deploys as before.
//
// SealView's styles are scoped, so consumers need only the shared design tokens + UI base at
// their entry (not seal-ui's global styles.css):
//   import '@meddleware/design-tokens/tokens.css'
//   import '@meddleware/ui/base.css'

export { default as SealView } from './components/SealView.vue'
