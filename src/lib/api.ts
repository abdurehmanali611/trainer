import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/lib/config';

const ACCESS_KEY = 'trainer.access';
const REFRESH_KEY = 'trainer.refresh';
/** Default request timeout — never leave the UI blocked on a hung socket. */
const DEFAULT_TIMEOUT_MS = 12_000;

let access: string | null = null;
let refresh: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(
      (typeof body.detail === 'string' && body.detail) ||
        Object.values(body)
          .flat()
          .map(String)
          .join('\n') ||
        `Request failed (${status})`
    );
    this.status = status;
    this.body = body;
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    return await fetch(input, {
      ...init,
      signal: controller?.signal ?? init.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, { detail: 'Request timed out. Check your connection.' });
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const [a, r] = await AsyncStorage.multiGet([ACCESS_KEY, REFRESH_KEY]);
  access = a[1];
  refresh = r[1];
  return { access, refresh };
}

export async function saveTokens(newAccess: string, newRefresh: string): Promise<void> {
  access = newAccess;
  refresh = newRefresh;
  await AsyncStorage.multiSet([
    [ACCESS_KEY, newAccess],
    [REFRESH_KEY, newRefresh],
  ]);
}

export async function clearTokens(): Promise<void> {
  access = null;
  refresh = null;
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

export function getAccessToken(): string | null {
  return access;
}

/** Ask the server to expire this session, then drop the local tokens. */
export async function revokeSession(): Promise<void> {
  // Bounded: a hung logout request must never block the sign-out navigation.
  try {
    if (access || refresh) {
      await fetchWithTimeout(
        `${API_URL}/api/auth/logout/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: JSON.stringify({ refresh }),
        },
        4000
      );
    }
  } catch {
    // Offline / server unreachable / timed out — still sign the user out locally.
  }
  await clearTokens();
}

async function tryRefresh(): Promise<boolean> {
  if (!refresh) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetchWithTimeout(`${API_URL}/api/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) {
          await clearTokens();
          return false;
        }
        const data = await res.json();
        access = data.access;
        await AsyncStorage.setItem(ACCESS_KEY, data.access);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | undefined | null>;
  formData?: FormData;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, query, formData } = options;

  let url = `${API_URL}/api/${path.replace(/^\//, '')}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const doFetch = () => {
    const headers: Record<string, string> = {};
    if (auth && access) headers.Authorization = `Bearer ${access}`;
    if (!formData) headers['Content-Type'] = 'application/json';
    return fetchWithTimeout(url, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  };

  let res: Response;
  try {
    res = await doFetch();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, { detail: 'Network error. Check your connection.' });
  }

  if (res.status === 401 && auth) {
    const ok = await tryRefresh();
    if (ok) {
      try {
        res = await doFetch();
      } catch {
        throw new ApiError(0, { detail: 'Network error. Check your connection.' });
      }
    }
  }

  if (res.status === 204) return undefined as T;

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
