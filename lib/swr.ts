import type { SWRConfiguration } from 'swr';

import { ApiClientError } from '@/api';
import { triggerGlobalSignOut } from '@/lib/auth-context';

export const swrConfig: SWRConfiguration = {
  // 401s mean the token is gone/expired — retrying won't help, so force a
  // sign-out back to the login screen instead of leaving a stale error on
  // screen (this app runs on shared devices, so a dead session should never
  // just sit there until someone notices).
  shouldRetryOnError: (err) => !(err instanceof ApiClientError && err.status === 401),
  onError: (err) => {
    if (err instanceof ApiClientError && err.status === 401) triggerGlobalSignOut();
  },
};
