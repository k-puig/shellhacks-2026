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

export function useAuthFlow() {
    const [tokens, setTokens] = useState<AuthTokens | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<UserProfile | null>(null);
    const redirectUri = AuthSession.makeRedirectUri({ scheme: 'dodomobile', path: 'auth' });

    const [loginRequest, loginResponse, promptLoginAsync] = AuthSession.useAuthRequest(
        {
            clientId: AUTH0_CLIENT_ID,
            redirectUri,
            responseType: AuthSession.ResponseType.Code,
            usePKCE: true,
            scopes: SCOPES,
            extraParams: AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {},
        },
        discovery,
    );
    const [signUpRequest, signUpResponse, promptSignUpAsync] = AuthSession.useAuthRequest(
        {
            clientId: AUTH0_CLIENT_ID,
            redirectUri,
            responseType: AuthSession.ResponseType.Code,
            usePKCE: true,
            scopes: SCOPES,
            extraParams: {
                ...(AUTH0_AUDIENCE ? { audience: AUTH0_AUDIENCE } : {}),
                screen_hint: 'signup',
            },
        },
        discovery,
    );

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

    useEffect(() => {
        if (loginResponse?.type !== 'success') return;
        let active = true;
        const persistLogin = async () => {
            try {
                const next = await exchangeAuthorizationCode(loginResponse, loginRequest, redirectUri);
                if (!next) return;
                await saveTokens(next);
                if (active) setTokens(next);
            } catch (error) {
                console.warn('[dodo] Auth0 login failed:', String(error));
            }
        };
        void persistLogin();
        return () => {
            active = false;
        };
    }, [loginRequest, loginResponse, redirectUri]);

    useEffect(() => {
        if (signUpResponse?.type !== 'success') return;
        let active = true;
        const persistSignUp = async () => {
            try {
                const next = await exchangeAuthorizationCode(signUpResponse, signUpRequest, redirectUri);
                if (!next) return;
                await saveTokens(next);
                if (active) setTokens(next);
            } catch (error) {
                console.warn('[dodo] Auth0 sign-up failed:', String(error));
            }
        };
        void persistSignUp();
        return () => {
            active = false;
        };
    }, [redirectUri, signUpRequest, signUpResponse]);

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
            await clearTokens();
            setTokens(null);
            setUser(null);
            return null;
        }
    }, [tokens]);

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

    const login = useCallback(async () => {
        if (loginRequest) await promptLoginAsync();
    }, [loginRequest, promptLoginAsync]);

    const signUp = useCallback(async () => {
        if (signUpRequest) await promptSignUpAsync();
    }, [promptSignUpAsync, signUpRequest]);

    const logout = useCallback(async () => {
        await clearTokens();
        setTokens(null);
        setUser(null);
        if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) return;

        const logoutUrl =
            `https://${AUTH0_DOMAIN}/v2/logout?client_id=${encodeURIComponent(AUTH0_CLIENT_ID)}` +
            `&returnTo=${encodeURIComponent(redirectUri)}&federated`;
        try {
            await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
        } catch (error) {
            console.warn('[dodo] Auth0 browser logout failed:', String(error));
        }
    }, [redirectUri]);

    return {
        token: tokens?.accessToken ?? null,
        tokens,
        isAuthenticated: Boolean(tokens?.accessToken),
        isLoading,
        user,
        login,
        signUp,
        logout,
        getValidAccessToken,
    };
}