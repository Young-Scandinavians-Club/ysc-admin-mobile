import type { SWRConfiguration } from 'swr';

import { ApiClientError } from '@/api';

export const swrConfig: SWRConfiguration = {
  // 401s mean the token is gone/expired — retrying won't help, and the
  // AuthProvider already routes back to sign-in when that happens elsewhere.
  shouldRetryOnError: (err) => !(err instanceof ApiClientError && err.status === 401),
};
