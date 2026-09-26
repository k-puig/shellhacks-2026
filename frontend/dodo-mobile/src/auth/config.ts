// Login is skipped until the Auth0 flow is finished: the app opens straight to
// Home. Set EXPO_PUBLIC_AUTH_ENABLED=1 in .env.local to turn it back on.
export const AUTH_ENABLED = process.env.EXPO_PUBLIC_AUTH_ENABLED === '1';
