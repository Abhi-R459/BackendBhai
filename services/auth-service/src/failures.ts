function isWellFormed(token: string): boolean {
  if (!token) return false;
  const t = token.replace(/^Bearer\s+/i, '').trim();
  if (t === 'invalid' || t === 'expired' || t === 'malformed') {
    return false;
  }
  return t.length >= 3;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * S-08: Injects a 5-second timeout and throws error when token is invalid.
 * Generates a visible 5s auth span ending in an error.
 */
export async function maybeInjectAuthTimeout(token: string): Promise<void> {
  const cleanToken = token ? token.replace(/^Bearer\s+/i, '').trim() : '';
  if (cleanToken === 'invalid' || !isWellFormed(cleanToken)) {
    console.warn(`[FailureInjection:AuthService] Invalid auth token detected ('${cleanToken}'). Sleeping 5s before timing out...`);
    await sleep(5000);
    throw new Error('Auth service timeout');
  }
}
