// Login is required by default. For local testing without Auth0, set
// EXPO_PUBLIC_SKIP_LOGIN=1 in your (git-ignored) .env.local: the app then opens
// straight to Home and Settings shows a Guest account.
export const SKIP_LOGIN = process.env.EXPO_PUBLIC_SKIP_LOGIN === '1';

export const AUTH0_DOMAIN = (process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '')
	.trim()
	.replace(/^https?:\/\//i, '')
	.replace(/\/+$/, '');
export const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '';
export const AUTH0_AUDIENCE = (process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? '').trim();
