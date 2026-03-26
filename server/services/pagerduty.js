import db from '../db/connection.js';

async function getSetting(key, companyId = 1) {
  const row = await db.get('SELECT value FROM settings WHERE key = ? AND company_id = ?', key, companyId);
  return row?.value || null;
}

export async function createPagerDutyIncident(ticket) {
  try {
    const companyId = ticket.company_id || 1;
    const routingKey = await getSetting('pagerduty_routing_key', companyId);
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
    const companies = await db.all('SELECT id FROM companies ORDER BY id ASC');
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    for (const { id: companyId } of companies) {
      const enabled = await getSetting('pagerduty_enabled', companyId);
      if (enabled !== 'true') continue;

      const routingKey = await getSetting('pagerduty_routing_key', companyId);
      if (!routingKey) continue;

      // Critical tickets older than 15 min with no assignee action taken
      const tickets = await db.all(`
        SELECT t.*, u.name as submitter_name
        FROM tickets t
        JOIN users u ON t.submitter_id = u.id
        WHERE t.priority = 'critical'
          AND t.status IN ('open', 'in_progress')
          AND t.assignee_id IS NULL
          AND t.created_at < ?
          AND t.company_id = ?
      `, cutoff, companyId);

      for (const ticket of tickets) {
        await createPagerDutyIncident(ticket);
      }

      if (tickets.length > 0) {
        console.log(`[PagerDuty Cron] Triggered ${tickets.length} incident(s) for company ${companyId}`);
      }
    }
  } catch (e) {
    console.error('[PagerDuty Cron] check failed:', e.message);
  }
}
