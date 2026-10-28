import * as React from 'react';
import { api, ApiError, clearTokens, loadTokens, revokeSession, saveTokens } from '@/lib/api';
import { fetchPlatformBilling, type PlatformBilling } from '@/lib/platform';
import type { Trainer } from '@/lib/types';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  trainer: Trainer | null;
  platform: PlatformBilling | null;
}

interface AuthContextValue extends AuthState {
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (payload: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
  setTrainer: (trainer: Trainer) => void;
  setPlatform: (platform: PlatformBilling | null) => void;
  refreshPlatform: () => Promise<PlatformBilling | null>;
}

export class PlatformBlockedError extends Error {
  billing: PlatformBilling;
  reason: string;

  constructor(reason: string, billing: PlatformBilling) {
    super(reason);
    this.name = 'PlatformBlockedError';
    this.reason = reason;
    this.billing = billing;
  }
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function readBlocked(error: unknown): PlatformBlockedError | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 403) return null;
  const body = error.body as { blocked?: boolean; reason?: string; billing?: PlatformBilling };
  if (!body.blocked || !body.billing) return null;
  return new PlatformBlockedError(body.reason ?? 'Your account is not active.', body.billing);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    status: 'loading',
    trainer: null,
    platform: null,
  });

  const loadPlatform = React.useCallback(async () => {
    try {
      const res = await fetchPlatformBilling();
      return res.billing;
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      const tokens = await loadTokens();
      if (tokens.access) {
        try {
          const me = await api<Trainer>('auth/me/');
          const platform = await loadPlatform();
          setState({ status: 'signedIn', trainer: me, platform });
          return;
        } catch {
          await clearTokens();
        }
      }
      setState({ status: 'signedOut', trainer: null, platform: null });
    })();
  }, [loadPlatform]);

  const signIn = React.useCallback(async (username: string, password: string) => {
    try {
      const res = await api<{
        access: string;
        refresh: string;
        trainer: Trainer;
        platform: PlatformBilling;
      }>('auth/login/', { method: 'POST', body: { username, password }, auth: false });
      await saveTokens(res.access, res.refresh);
      setState({ status: 'signedIn', trainer: res.trainer, platform: res.platform ?? null });
    } catch (error) {
      const blocked = readBlocked(error);
      if (blocked) throw blocked;
      throw error;
    }
  }, []);

  const signUp = React.useCallback(async (payload: Record<string, string>) => {
    const res = await api<{
      access: string;
      refresh: string;
      trainer: Trainer;
      platform: PlatformBilling;
    }>('auth/register/', { method: 'POST', body: payload, auth: false });
    await saveTokens(res.access, res.refresh);
    setState({ status: 'signedIn', trainer: res.trainer, platform: res.platform ?? null });
  }, []);

  const signOut = React.useCallback(async () => {
    await revokeSession();
    setState({ status: 'signedOut', trainer: null, platform: null });
  }, []);

  const setTrainer = React.useCallback((trainer: Trainer) => {
    setState((s) => ({ ...s, trainer }));
  }, []);

  const setPlatform = React.useCallback((platform: PlatformBilling | null) => {
    setState((s) => ({ ...s, platform }));
  }, []);

  const refreshPlatform = React.useCallback(async () => {
    const platform = await loadPlatform();
    if (platform) setState((s) => ({ ...s, platform }));
    return platform;
  }, [loadPlatform]);

  const value = React.useMemo(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      setTrainer,
      setPlatform,
      refreshPlatform,
    }),
    [state, signIn, signUp, signOut, setTrainer, setPlatform, refreshPlatform]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
