/**
 * Bearer token authentication.
 *
 * The submission token is defined here and documented in the README. Any
 * request must present it as:
 *
 *   Authorization: Bearer <AUTH_TOKEN>
 */
export const AUTH_TOKEN = 'test-bearer-token-woztell-2026';

const BEARER_PREFIX = 'Bearer ';

/**
 * Validate an `Authorization` header value.
 * @param {string|undefined} authorizationHeader
 * @returns {boolean}
 */
export function validateToken(authorizationHeader) {
  if (!authorizationHeader) return false;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.startsWith(BEARER_PREFIX)) return false;
  const token = trimmed.slice(BEARER_PREFIX.length).trim();
  return token === AUTH_TOKEN;
}
