import { useMemo } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { API_URL, createApiClient, type ApiClient } from './client';

// Backend requests use Auth0 API bearer tokens. A backend 401 does not by
// itself prove the Auth0 session expired.
export function useApi(): ApiClient {
  const { getValidAccessToken } = useAuth();
  return useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getToken: getValidAccessToken,
      }),
    [getValidAccessToken],
  );
}
