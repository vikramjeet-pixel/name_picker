/**
 * Privacy masking utility for participant identifiers (phone, email, ticket IDs).
 * Example outputs:
 * - "+44 7911 123456" -> "+44 **** 3456"
 * - "alice.johnson@example.com" -> "a****n@example.com"
 * - "TKT-884920" -> "TKT-****20"
 */
export function maskIdentifier(identifier?: string): string {
  if (!identifier) return '';
  const trimmed = identifier.trim();

  // 1. Email masking
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    if (parts.length === 2) {
      const user = parts[0];
      const domain = parts[1];
      if (user.length <= 2) {
        return `${user[0]}*@${domain}`;
      }
      return `${user[0]}****${user[user.length - 1]}@${domain}`;
    }
  }

  // 2. Phone number masking (has digits and possibly +, spaces, dashes)
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7) {
    // Keep first 2-4 chars and last 4 chars
    const last4 = trimmed.slice(-4);
    const prefix = trimmed.slice(0, Math.min(4, trimmed.length - 4));
    return `${prefix} **** ${last4}`;
  }

  // 3. Ticket code / alphanumeric ID masking
  if (trimmed.length > 5) {
    const firstPart = trimmed.slice(0, Math.min(3, Math.floor(trimmed.length / 3)));
    const lastPart = trimmed.slice(-2);
    return `${firstPart}****${lastPart}`;
  }

  if (trimmed.length > 2) {
    return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
  }

  return `${trimmed}***`;
}
