import db from '../db/connection.js';

async function getJiraSettings() {
  const rows = await db.all("SELECT key, value FROM settings WHERE key LIKE 'jira_%'");
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

async function jiraRequest(method, path, body) {
  const settings = await getJiraSettings();
  if (!settings.jira_host || !settings.jira_email || !settings.jira_token) {
    throw new Error('Jira not configured');
  }
  const auth = Buffer.from(`${settings.jira_email}:${settings.jira_token}`).toString('base64');
  const res = await fetch(`https://${settings.jira_host}/rest/api/3${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira API error ${res.status}: ${text}`);
  }
  return res.json();
}

const PRIORITY_MAP = {
  critical: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export async function pushTicketToJira(ticket) {
  const settings = await getJiraSettings();
  if (!settings.jira_enabled || settings.jira_enabled !== 'true') {
    throw new Error('Jira integration is not enabled');
  }

  const projectKey = settings.jira_project;
  if (!projectKey) throw new Error('Jira project key not configured');

  const issueData = {
    fields: {
      project: { key: projectKey },
      summary: `[Sentinel #${ticket.id}] ${ticket.title}`,
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: ticket.description }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: `Category: ${ticket.category} | Priority: ${ticket.priority} | Status: ${ticket.status}` },
            ],
          },
        ],
      },
      issuetype: { name: 'Task' },
      priority: { name: PRIORITY_MAP[ticket.priority] || 'Medium' },
      labels: ['sentinel', ticket.category],
    },
  };

  const created = await jiraRequest('POST', '/issue', issueData);

  await db.run(
    `INSERT INTO jira_syncs (ticket_id, jira_issue_key, jira_project, pushed_at)
     VALUES (?, ?, ?, NOW())
     ON CONFLICT DO NOTHING`,
    ticket.id, created.key, projectKey
  );

  return created;
}

export async function syncJiraStatus(ticketId) {
  const sync = await db.get(
    'SELECT * FROM jira_syncs WHERE ticket_id = ? ORDER BY pushed_at DESC LIMIT 1',
    ticketId
  );
  if (!sync) throw new Error('No Jira sync found for this ticket');

  const issue = await jiraRequest('GET', `/issue/${sync.jira_issue_key}`);

  // Map Jira status to Sentinel status
  const jiraStatus = issue.fields?.status?.name?.toLowerCase() || '';
  let sentinelStatus = null;
  if (jiraStatus.includes('done') || jiraStatus.includes('resolved') || jiraStatus.includes('closed')) {
    sentinelStatus = 'resolved';
  } else if (jiraStatus.includes('progress') || jiraStatus.includes('in review')) {
    sentinelStatus = 'in_progress';
  }

  await db.run(
    'UPDATE jira_syncs SET last_sync_at = NOW() WHERE id = ?',
    sync.id
  );

  if (sentinelStatus) {
    const current = await db.get('SELECT status FROM tickets WHERE id = ?', ticketId);
    if (current && current.status !== sentinelStatus && !['resolved', 'closed'].includes(current.status)) {
      await db.run(
        'UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?',
        sentinelStatus, ticketId
      );
    }
  }

  return { sync, issue, sentinelStatus };
}

export async function getJiraSyncStatus(ticketId) {
  return db.get(
    'SELECT * FROM jira_syncs WHERE ticket_id = ? ORDER BY pushed_at DESC LIMIT 1',
    ticketId
  );
}
