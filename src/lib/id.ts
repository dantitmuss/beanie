let counter = 0;

export function newId(prefix = 'id'): string {
  return `${prefix}-${++counter}-${Date.now().toString(36)}`;
}

export function resetIdCounter(): void {
  counter = 0;
}
