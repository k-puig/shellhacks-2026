import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'dodo_access_token';
const REFRESH_TOKEN_KEY = 'dodo_refresh_token';
const EXPIRES_AT_KEY = 'dodo_token_expires_at';

export type AuthTokens = {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number | null;
};

export async function saveTokens(tokens: AuthTokens): Promise<void> {
    const operations = [SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken)];

    operations.push(
        tokens.refreshToken
            ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken)
            : SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    );
    operations.push(
        tokens.expiresAt === null
            ? SecureStore.deleteItemAsync(EXPIRES_AT_KEY)
            : SecureStore.setItemAsync(EXPIRES_AT_KEY, String(tokens.expiresAt)),
    );

    await Promise.all(operations);
}

export async function getTokens(): Promise<AuthTokens | null> {
    const [accessToken, refreshToken, expiresAtValue] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(EXPIRES_AT_KEY),
    ]);

    if (!accessToken) return null;

    const parsedExpiry = expiresAtValue === null ? null : Number(expiresAtValue);
    return {
        accessToken,
        refreshToken,
        expiresAt: parsedExpiry !== null && Number.isFinite(parsedExpiry) ? parsedExpiry : null,
    };
}

export async function clearTokens(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(EXPIRES_AT_KEY),
    ]);
}