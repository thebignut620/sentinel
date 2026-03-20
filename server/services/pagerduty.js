import db from '../db/connection.js';

async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', key);
  return row?.value || null;
}

export async function createPagerDutyIncident(ticket) {
  try {
    const routingKey = await getSetting('pagerduty_routing_key');
    if (!routingKey) return;

    const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: routingKey,
        event_action: 'trigger',
        payload: {
          summary: `[Sentinel] CRITICAL: ${ticket.title}`,
          severity: 'critical',
          source: 'sentinel-helpdesk',
          custom_details: {
            ticket_id: ticket.id,
            category: ticket.category,
            submitter: ticket.submitter_name || ticket.submitter_id,
            created_at: ticket.created_at,
          },
        },
        dedup_key: `sentinel-ticket-${ticket.id}`,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[PagerDuty] enqueue failed:', res.status, text);
    } else {
      console.log(`[PagerDuty] Incident triggered for ticket #${ticket.id}`);
    }
  } catch (e) {
    console.error('[PagerDuty] createPagerDutyIncident failed:', e.message);
  }
}

export async function checkCriticalUnassignedTickets() {
  try {
    const enabled = await getSetting('pagerduty_enabled');
    if (enabled !== 'true') return;

    const routingKey = await getSetting('pagerduty_routing_key');
    if (!routingKey) return;

    // Critical tickets older than 15 min with no assignee action taken
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const tickets = await db.all(`
      SELECT t.*, u.name as submitter_name
      FROM tickets t
      JOIN users u ON t.submitter_id = u.id
      WHERE t.priority = 'critical'
        AND t.status IN ('open', 'in_progress')
        AND t.assignee_id IS NULL
        AND t.created_at < ?
    `, cutoff);

    for (const ticket of tickets) {
      await createPagerDutyIncident(ticket);
    }

    if (tickets.length > 0) {
      console.log(`[PagerDuty Cron] Triggered ${tickets.length} incident(s) for unassigned critical tickets`);
    }
  } catch (e) {
    console.error('[PagerDuty Cron] check failed:', e.message);
  }
}
