export function isAurakEmail(email: string): boolean {
  return /^[^@\s]+@aurak\.ac\.ae$/i.test(email.trim());
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
