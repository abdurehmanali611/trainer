let credentials: { username: string; password: string } | null = null;

export function setLockedCredentials(username: string, password: string): void {
  credentials = { username, password };
}

export function getLockedCredentials(): { username: string; password: string } | null {
  return credentials;
}

export function clearLockedCredentials(): void {
  credentials = null;
}
