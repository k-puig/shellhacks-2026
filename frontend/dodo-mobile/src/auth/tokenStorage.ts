import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'dodo_access_token';
const REFRESH_TOKEN_KEY = 'dodo_refresh_token';

// async functions to save, access, and clear tokens

export async function saveTokens(accessToken: string, refreshToken?: string): Promise<void> {

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)
    }
}

export async function getAccessToken(): Promise<string | null> {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export async function clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}