import { ImapFlow } from 'imapflow';
import db from '../db/connection.js';

async function getImapSettings(companyId = 1) {
  const rows = await db.all(
    "SELECT key, value FROM settings WHERE (key LIKE 'imap_%' OR key = 'email_ingestion_enabled') AND company_id = ?",
    companyId
  );
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

let isPolling = false;

export async function pollEmailInbox() {
  if (isPolling) return;
  isPolling = true;
  try {
    const companies = await db.all('SELECT id FROM companies ORDER BY id ASC');
    for (const { id: companyId } of companies) {
      await pollCompanyInbox(companyId);
    }
  } catch (e) {
    console.error('[EmailIngestion] Poll error:', e.message);
  } finally {
    isPolling = false;
  }
}

async function pollCompanyInbox(companyId) {
  try {
    const cfg = await getImapSettings(companyId);
    if (cfg.email_ingestion_enabled !== 'true') return;
    if (!cfg.imap_host || !cfg.imap_user || !cfg.imap_pass) return;

    const client = new ImapFlow({
      host: cfg.imap_host,
      port: parseInt(cfg.imap_port || '993'),
      secure: true,
      auth: { user: cfg.imap_user, pass: cfg.imap_pass },
      logger: false,
    });

    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      // Fetch all unseen messages
      const messages = [];
      for await (const msg of client.fetch('1:*', {
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: true,
      })) {
        if (!msg.flags.has('\\Seen')) {
          messages.push(msg);
        }
      }

      for (const msg of messages) {
        try {
          await processEmail(msg, client, companyId);
        } catch (e) {
          console.error('[EmailIngestion] Failed to process message:', e.message);
        }
      }

      if (messages.length > 0) {
        console.log(`[EmailIngestion] Processed ${messages.length} new email(s) for company ${companyId}`);
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (e) {
    console.error(`[EmailIngestion] Poll error for company ${companyId}:`, e.message);
  }
}

async function processEmail(msg, client, companyId = 1) {
  const envelope = msg.envelope;
  const subject = envelope.subject || '(No subject)';
  const fromAddr = envelope.from?.[0]?.address || '';
  const fromName = envelope.from?.[0]?.name || fromAddr;
  const messageId = envelope.messageId || '';
  const inReplyTo = envelope.inReplyTo || '';

  // Extract plain text body from source
  const source = msg.source?.toString('utf-8') || '';
  const bodyText = extractTextBody(source);

  // Check if this is a reply to an existing thread
  if (inReplyTo) {
    // Try to find existing ticket via comment body referencing the message id (scoped to company)
    const existingComment = await db.get(
      `SELECT tc.ticket_id FROM ticket_comments tc
       JOIN tickets t ON t.id = tc.ticket_id
       WHERE tc.body LIKE ? AND t.company_id = ?`,
      `%${inReplyTo}%`, companyId
    );
    if (existingComment) {
      // Find or create a system user for email replies (scoped to company)
      let systemUser = await db.get("SELECT id FROM users WHERE email = 'system@sentinel.local' AND company_id = ?", companyId);
      if (!systemUser) {
        const inserted = await db.run(
          "INSERT INTO users (name, email, password, role, company_id) VALUES ('Email Bot', 'system@sentinel.local', 'disabled', 'employee', ?)",
          companyId
        );
        systemUser = { id: inserted.lastID ?? inserted.lastInsertRowid };
      }

      await db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, body, company_id) VALUES (?, ?, ?, ?)',
        existingComment.ticket_id,
        systemUser.id,
        `📧 **Reply from ${fromName} <${fromAddr}>:**\n\n${bodyText}\n\n<!-- message-id: ${messageId} -->`,
        companyId
      );
      await client.messageFlagsAdd(msg.seq, ['\\Seen']);
      return;
    }
  }

  // Find submitter by email within this company, or use first admin as fallback
  let submitter = await db.get('SELECT id FROM users WHERE email = ? AND is_active = 1 AND company_id = ?', fromAddr, companyId);
  if (!submitter) {
    submitter = await db.get("SELECT id FROM users WHERE role = 'admin' AND is_active = 1 AND company_id = ? LIMIT 1", companyId);
  }
  if (!submitter) return;

  // Create ticket
  const result = await db.run(`
    INSERT INTO tickets (title, description, priority, category, submitter_id, ai_attempted, sla_due_at, company_id)
    VALUES (?, ?, 'medium', 'software', ?, 0, NOW() + INTERVAL '24 hours', ?)
  `,
    subject.slice(0, 200),
    `${bodyText}\n\n<!-- source: email | from: ${fromAddr} | message-id: ${messageId} -->`,
    submitter.id,
    companyId
  );

  const ticketId = result.lastID ?? result.lastInsertRowid;
  console.log(`[EmailIngestion] Created ticket #${ticketId} from email for company ${companyId}: ${subject}`);

  // Mark as seen
  await client.messageFlagsAdd(msg.seq, ['\\Seen']);
}

function extractTextBody(source) {
  // Try to extract plain text from raw email source
  const lines = source.split('\n');
  let inBody = false;
  let inTextPart = false;
  let body = [];
  let contentType = '';

  for (const line of lines) {
    if (!inBody) {
      if (line.trim() === '') {
        inBody = true;
        inTextPart = contentType.includes('text/plain') || !contentType.includes('text/html');
      } else if (line.toLowerCase().startsWith('content-type:')) {
        contentType = line.toLowerCase();
      }
    } else if (inTextPart) {
      body.push(line);
    }
  }

  return body.join('\n').trim().slice(0, 4000) || '(email body could not be extracted)';
}
