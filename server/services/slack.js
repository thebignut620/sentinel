import db from '../db/connection.js';

async function getSlackSettings(companyId = 1) {
  const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'slack_%' AND company_id = ?", companyId);
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

const PRIORITY_EMOJI = { critical: '🚨', high: '🔴', medium: '🟡', low: '🟢' };
const PRIORITY_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' };
const CATEGORY_EMOJI = { hardware: '🖥', software: '💾', network: '🌐', access: '🔑', account: '👤' };

export async function sendNewTicketNotification(ticket) {
  try {
    const settings = await getSlackSettings(ticket.company_id || 1);
    if (!settings.slack_webhook_url || settings.slack_enabled !== 'true') return;

    const emoji = PRIORITY_EMOJI[ticket.priority] || '⚪';
    const color = PRIORITY_COLOR[ticket.priority] || '#6b7280';
    const catEmoji = CATEGORY_EMOJI[ticket.category] || '🎫';
    const isCritical = ticket.priority === 'critical';

    const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    const body = {
      ...(isCritical ? { text: `<!here> *CRITICAL TICKET* — Immediate attention required!` } : {}),
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${emoji} *New ${ticket.priority.toUpperCase()} Ticket — #${ticket.id}*\n*${ticket.title}*`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Priority:*\n${emoji} ${ticket.priority}` },
                { type: 'mrkdwn', text: `*Category:*\n${catEmoji} ${ticket.category}` },
                { type: 'mrkdwn', text: `*Status:*\n${ticket.status}` },
                { type: 'mrkdwn', text: `*Submitted by:*\n${ticket.submitter_name || 'Unknown'}` },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View Ticket' },
                  url: `${appUrl}/tickets/${ticket.id}`,
                  style: isCritical ? 'danger' : 'primary',
                },
              ],
            },
          ],
        },
      ],
    };

    await fetch(settings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('[Slack] sendNewTicketNotification failed:', e.message);
  }
}

export async function sendTicketResolvedNotification(ticket) {
  try {
    const settings = await getSlackSettings(ticket.company_id || 1);
    if (!settings.slack_webhook_url || settings.slack_enabled !== 'true') return;

    const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    const body = {
      attachments: [
        {
          color: '#22c55e',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `✅ *Ticket Resolved — #${ticket.id}*\n*${ticket.title}*`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Priority:*\n${ticket.priority}` },
                { type: 'mrkdwn', text: `*Category:*\n${ticket.category}` },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View Ticket' },
                  url: `${appUrl}/tickets/${ticket.id}`,
                },
              ],
            },
          ],
        },
      ],
    };

    await fetch(settings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('[Slack] sendTicketResolvedNotification failed:', e.message);
  }
}
