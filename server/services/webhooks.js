import crypto from 'crypto';
import db from '../db/connection.js';

export async function fireWebhooks(event, payload) {
  try {
    const hooks = await db.all(
      "SELECT * FROM webhooks WHERE is_active = 1 AND events LIKE ?",
      `%${event}%`
    );
    for (const hook of hooks) {
      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });
      const sig = crypto
        .createHmac('sha256', hook.secret || '')
        .update(body)
        .digest('hex');
      fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentinel-Signature': `sha256=${sig}`,
          'X-Sentinel-Event': event,
        },
        body,
      }).catch(e =>
        console.error('[webhook] delivery failed:', hook.url, e.message)
      );
    }
  } catch (e) {
    console.error('[webhooks] fireWebhooks error:', e.message);
  }
}
