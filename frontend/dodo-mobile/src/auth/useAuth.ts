import { useCallback, useEffect, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_DOMAIN } from './config';
import { fetchProfile, UserInfoError, type UserProfile } from './profile';
import { clearTokens, getTokens, saveTokens, type AuthTokens } from './tokenStorage';

const SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const TOKEN_EXPIRY_MARGIN_MS = 30_000;
const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
    tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
};

function toAuthTokens(
    response: AuthSession.TokenResponse,
    previous?: AuthTokens | null,
): AuthTokens {
    return {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? previous?.refreshToken ?? null,
        expiresAt: response.expiresIn === undefined ? null : Date.now() + response.expiresIn * 1000,
    };
}

async function exchangeAuthorizationCode(
    response: AuthSession.AuthSessionResult | null,
    request: AuthSession.AuthRequest | null,
    redirectUri: string,
): Promise<AuthTokens | null> {
    if (response?.type !== 'success') return null;
    const code = response.params.code;
    const codeVerifier = request?.codeVerifier;
    if (!code || !codeVerifier) {
        throw new Error('Auth0 did not return an authorization code and PKCE verifier.');
    }

    const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
            clientId: AUTH0_CLIENT_ID,
            code,
            redirectUri,
            extraParams: { code_verifier: codeVerifier },
        },
        discovery,
    );
    return toAuthTokens(tokenResponse);
}

async function refreshAuthTokens(previous: AuthTokens): Promise<AuthTokens> {
    if (!previous.refreshToken) throw new Error('No Auth0 refresh token is available.');
    const response = await AuthSession.refreshAsync(
        {
            clientId: AUTH0_CLIENT_ID,
            refreshToken: previous.refreshToken,
            scopes: SCOPES,
            extraParams: AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {},
        },
        discovery,
    );
    return toAuthTokens(response, previous);
}

function isFresh(tokens: AuthTokens): boolean {
    return tokens.expiresAt !== null && tokens.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS;
}

// iOS allows one auth browser at a time. One left behind (a hot reload during
// login, a page the user never came back from) makes the next open throw
// "Another web browser is already open", so close it first.
function closeStaleBrowser() {
    try {
        WebBrowser.dismissAuthSession();
    } catch {
        // Nothing was open.
    }
}

// Opens Auth0 in the browser and trades the returned code for tokens. Builds a
// new request every time: each attempt needs its own state and PKCE pair, and
// Auth0 rejects a login that reuses the previous one's (useAuthRequest builds
// one per mount, which failed every other login).
async function authorize(
    redirectUri: string,
    extraParams: Record<string, string>,
): Promise<AuthTokens | null> {
    const request = new AuthSession.AuthRequest({
        clientId: AUTH0_CLIENT_ID,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        scopes: SCOPES,
        extraParams: { ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}), ...extraParams },
    });
    closeStaleBrowser();
    const result = await request.promptAsync(discovery);
    return exchangeAuthorizationCode(result, request, redirectUri);
}

export function useAuthFlow() {
    const [tokens, setTokens] = useState<AuthTokens | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<UserProfile | null>(null);
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'dodomobile', path: 'auth' });

    useEffect(() => {
        let active = true;
        const restoreSession = async () => {
            try {
                const stored = await getTokens();
                if (!stored) return;

                const restored = isFresh(stored)
                    ? stored
                    : stored.refreshToken
                        ? await refreshAuthTokens(stored)
                        : null;
                if (restored) {
                    await saveTokens(restored);
                    if (active) setTokens(restored);
                } else {
                    await clearTokens();
                }
            } catch (error) {
                console.warn('[dodo] Could not restore Auth0 session:', String(error));
                await clearTokens();
            } finally {
                if (active) setIsLoading(false);
            }
        };

        void restoreSession();
        return () => {
            active = false;
        };
    }, []);

    // Forgets the login on this phone without opening a browser: used when the
    // login can't be renewed or the backend rejects it (a 401).
    const endSession = useCallback(async () => {
        await clearTokens();
        setTokens(null);
        setUser(null);
    }, []);

    const getValidAccessToken = useCallback(async () => {
        if (!tokens) return null;
        if (isFresh(tokens)) return tokens.accessToken;

        try {
            const refreshed = await refreshAuthTokens(tokens);
            await saveTokens(refreshed);
            setTokens(refreshed);
            return refreshed.accessToken;
        } catch (error) {
            console.warn('[dodo] Auth0 token refresh failed:', String(error));
            await endSession();
            return null;
        }
    }, [endSession, tokens]);

    useEffect(() => {
        if (!tokens || !AUTH0_DOMAIN) return;
        let active = true;
        const loadProfile = async () => {
            try {
                const accessToken = await getValidAccessToken();
                if (!accessToken) return;
                const profile = await fetchProfile(AUTH0_DOMAIN, accessToken);
                if (active) setUser(profile);
            } catch (error) {
                if (error instanceof UserInfoError && error.status === 401) {
                    await clearTokens();
                    if (active) {
                        setTokens(null);
                        setUser(null);
                    }
                    return;
                }
                console.warn('[dodo] Could not load profile:', String(error));
            }
        };

        void loadProfile();
        return () => {
            active = false;
        };
    }, [getValidAccessToken, tokens]);

    const signIn = useCallback(
        async (label: string, extraParams: Record<string, string>) => {
            try {
                const next = await authorize(redirectUri, extraParams);
                if (!next) return;
                await saveTokens(next);
                setTokens(next);
            } catch (error) {
                console.warn(`[dodo] Auth0 ${label} failed:`, String(error));
            }
        },
        [redirectUri],
    );
    const login = useCallback(() => signIn('login', {}), [signIn]);
    const signUp = useCallback(() => signIn('sign-up', { screen_hint: 'signup' }), [signIn]);

    const logout = useCallback(async () => {
        await endSession();
        if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) return;

        const logoutUrl =
            `https://${AUTH0_DOMAIN}/v2/logout?client_id=${encodeURIComponent(AUTH0_CLIENT_ID)}` +
            `&returnTo=${encodeURIComponent(redirectUri)}`;
        closeStaleBrowser();
        try {
            await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
        } catch (error) {
            console.warn('[dodo] Auth0 browser logout failed:', String(error));
        }
    }, [endSession, redirectUri]);

    return {
        token: tokens?.accessToken ?? null,
        tokens,
        isAuthenticated: Boolean(tokens?.accessToken),
        isLoading,
        user,
        login,
        signUp,
        logout,
        endSession,
        getValidAccessToken,
    };
}