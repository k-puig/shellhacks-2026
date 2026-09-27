import { useMemo } from 'react';

import { useAuth } from '@/auth/AuthProvider';

import { API_URL, createApiClient, type ApiClient } from './client';

// The backend client for the signed-in user: sends a fresh login token with
// every request and signs out quietly if the backend rejects it.
export function useApi(): ApiClient {
  const { getValidAccessToken, endSession } = useAuth();
  return useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getToken: getValidAccessToken,
        onUnauthorized: () => void endSession(),
      }),
    [endSession, getValidAccessToken],
  );
}
