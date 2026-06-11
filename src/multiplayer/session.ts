const SESSION_KEY = 'beanie:sessionId';
const NAME_KEY = 'beanie:displayName';

/**
 * Reconnect token. Stored in sessionStorage (per-tab) rather than
 * localStorage so a page refresh resumes the same seat, while two tabs in
 * the same browser get distinct seats (which also makes local testing easy).
 */
export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function setDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 16));
}
