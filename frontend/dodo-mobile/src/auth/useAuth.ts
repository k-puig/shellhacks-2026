import { useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import { saveTokens, getAccessToken, clearTokens } from './tokenStorage';

//const funcs to access auth
const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? '';
const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? '';
const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;

const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: `https://${domain}/authorize`,
    tokenEndpoint: `https://${domain}/oauth/token`,
    revocationEndpoint: `https://${domain}/oauth/revoke`,
};

export function useAuth() {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'dodomobile',
        path: 'auth',
    });

    const [loginRequest, loginResponse, promptLoginAsync] = AuthSession.useAuthRequest(
        {
            clientId,
            redirectUri,
            responseType: AuthSession.ResponseType.Token,
            scopes: ['openid', 'profile', 'email', 'offline_access'],
            extraParams: audience ? { audience } : {},
        },
        discovery
    );
    const [signUpRequest, signUpResponse, promptSignUpAsync] = AuthSession.useAuthRequest(
        {
            clientId,
            redirectUri,
            responseType: AuthSession.ResponseType.Token,
            scopes: ['openid', 'profile', 'email', 'offline_access'],
            extraParams: {
                ...(audience ? { audience } : {}),
                screen_hint: 'signup',
            },
        },
        discovery
    );

    // check token on startup
    useEffect(() => {
        async function loadStoredToken() {
            try {
                const stored = await getAccessToken();
                setToken(stored);
            }
            finally {
                setIsLoading(false);
            }
        }
        loadStoredToken();
    }, []);

    //handle oAuth callback
    useEffect(() => {
        const authResponse = loginResponse ?? signUpResponse;
        if (authResponse?.type === 'success') {
            const { access_token } = authResponse.params;
            if (access_token) {
                saveTokens(access_token);
                setToken(access_token);
            }
        }
    }, [loginResponse, signUpResponse]);

    const login = useCallback(async () => {
        if (!loginRequest) return;
        await promptLoginAsync();
    }, [loginRequest, promptLoginAsync]);
    const signUp = useCallback(async () => {
        if (!signUpRequest) return;
        await promptSignUpAsync();
    }, [signUpRequest, promptSignUpAsync]);
    const logout = useCallback(async () => {
        await clearTokens();
        setToken(null);
    }, []);

    return {
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        signUp,
        logout,
    };
};