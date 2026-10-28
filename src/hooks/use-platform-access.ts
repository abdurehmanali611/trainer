import * as React from 'react';

import { useAuth } from '@/lib/auth';
import {
  fetchLockedPlatformBilling,
  fetchPlatformBilling,
  platformErrorMessage,
  submitLockedPlatformPayment,
  submitPlatformPayment,
  type PlatformBilling,
} from '@/lib/platform';
import { getLockedCredentials } from '@/lib/locked-session';

export interface PlatformAccess {
  billing: PlatformBilling | null;
  loading: boolean;
  error: string | null;
  signedIn: boolean;
  refresh: () => Promise<PlatformBilling | null>;
  submitPayment: (channel: string, transactionRef: string) => Promise<string>;
}

export function usePlatformAccess(): PlatformAccess {
  const { status, refreshPlatform } = useAuth();
  const signedIn = status === 'signedIn';

  const [billing, setBilling] = React.useState<PlatformBilling | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      if (signedIn) {
        const res = await fetchPlatformBilling();
        setBilling(res.billing);
        await refreshPlatform();
        return res.billing;
      }
      const credentials = getLockedCredentials();
      if (!credentials) {
        setBilling(null);
        return null;
      }
      const res = await fetchLockedPlatformBilling(credentials.username, credentials.password);
      setBilling(res.billing);
      return res.billing;
    } catch (e) {
      setError(platformErrorMessage(e, 'Could not load your subscription status.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [signedIn, refreshPlatform]);

  React.useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const submitPayment = React.useCallback(
    async (channel: string, transactionRef: string) => {
      if (signedIn) {
        const res = await submitPlatformPayment(channel, transactionRef);
        setBilling(res.billing);
        return res.detail;
      }
      const credentials = getLockedCredentials();
      if (!credentials) {
        throw new Error('Sign in again to submit your payment reference.');
      }
      const res = await submitLockedPlatformPayment(
        credentials.username,
        credentials.password,
        channel,
        transactionRef
      );
      setBilling(res.billing);
      return res.detail;
    },
    [signedIn]
  );

  return { billing, loading, error, signedIn, refresh, submitPayment };
}
