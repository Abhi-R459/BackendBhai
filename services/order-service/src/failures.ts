export interface OrderItem {
  id: string;
  name?: string;
  qty: number;
  price: number;
}

export interface Queryable {
  query(sql: string, params?: any[]): Promise<any>;
}

let requestCounter = 0;

/**
 * S-07: Injects a 3-second database delay for orders containing >10 items.
 * Generates a visible 3s DB span in the trace waterfall.
 */
export async function maybeInjectOrderDelay(items: OrderItem[], db?: Queryable): Promise<void> {
  if (items && items.length > 10) {
    console.log(`[FailureInjection:OrderService] Order has ${items.length} items (> 10). Executing SELECT pg_sleep(3)...`);
    if (db && typeof db.query === 'function') {
      await db.query('SELECT pg_sleep(3)');
    } else {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

/**
 * S-07: Simulates a cache miss/failure on every 30th request.
 * Forces the caller to fallback to the database.
 */
export async function maybeInjectCacheMiss<T>(
  sessionId: string,
  fetchFromCache: () => Promise<T | null>
): Promise<T | null> {
  requestCounter++;
  if (requestCounter % 30 === 0) {
    console.warn(`[FailureInjection:OrderService] Request #${requestCounter}: Forcing Redis cache miss / error fallback.`);
    return null;
  }
  return fetchFromCache();
}
