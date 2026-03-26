import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// List rules
router.get('/', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const rules = await db.all('SELECT * FROM automation_rules WHERE company_id = ? ORDER BY created_at DESC', companyId);
  res.json(rules.map(r => ({
    ...r,
    conditions: JSON.parse(r.conditions || '[]'),
    actions: JSON.parse(r.actions || '[]'),
    trigger_config: JSON.parse(r.trigger_config || '{}'),
  })));
});

// Get logs for a rule
router.get('/:id/logs', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const logs = await db.all(`
    SELECT al.*, t.title as ticket_title
    FROM automation_logs al
    LEFT JOIN tickets t ON al.ticket_id = t.id
    WHERE al.rule_id = ? AND al.company_id = ?
    ORDER BY al.created_at DESC LIMIT 50
  `, req.params.id, companyId);
  res.json(logs.map(l => ({ ...l, actions_taken: JSON.parse(l.actions_taken || '[]') })));
});

// Create rule
router.post('/', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description, trigger_type, trigger_config, condition_logic, conditions, actions } = req.body;
  if (!name?.trim() || !trigger_type || !actions?.length) {
    return res.status(400).json({ error: 'name, trigger_type, and at least one action required' });
  }
  const companyId = req.user.company_id || 1;
  const r = await db.run(`
    INSERT INTO automation_rules (company_id, name, description, trigger_type, trigger_config, condition_logic, conditions, actions, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, companyId, name.trim(), description || null, trigger_type,
    JSON.stringify(trigger_config || {}), condition_logic || 'AND',
    JSON.stringify(conditions || []), JSON.stringify(actions), req.user.id);
  const rule = await db.get('SELECT * FROM automation_rules WHERE id = ?', r.lastInsertRowid);
  res.status(201).json({ ...rule, conditions: JSON.parse(rule.conditions), actions: JSON.parse(rule.actions) });
});

// Update rule
router.patch('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  const rule = await db.get('SELECT * FROM automation_rules WHERE id = ? AND company_id = ?', req.params.id, companyId);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  const { name, description, trigger_type, trigger_config, condition_logic, conditions, actions, is_enabled } = req.body;
  const fields = ['updated_at = NOW()'];
  const vals = [];
  if (name !== undefined) { fields.push('name = ?'); vals.push(name); }
  if (description !== undefined) { fields.push('description = ?'); vals.push(description); }
  if (trigger_type !== undefined) { fields.push('trigger_type = ?'); vals.push(trigger_type); }
  if (trigger_config !== undefined) { fields.push('trigger_config = ?'); vals.push(JSON.stringify(trigger_config)); }
  if (condition_logic !== undefined) { fields.push('condition_logic = ?'); vals.push(condition_logic); }
  if (conditions !== undefined) { fields.push('conditions = ?'); vals.push(JSON.stringify(conditions)); }
  if (actions !== undefined) { fields.push('actions = ?'); vals.push(JSON.stringify(actions)); }
  if (is_enabled !== undefined) { fields.push('is_enabled = ?'); vals.push(is_enabled ? 1 : 0); }
  await db.run(`UPDATE automation_rules SET ${fields.join(', ')} WHERE id = ?`, ...vals, req.params.id);
  const updated = await db.get('SELECT * FROM automation_rules WHERE id = ?', req.params.id);
  res.json({ ...updated, conditions: JSON.parse(updated.conditions), actions: JSON.parse(updated.actions) });
});

// Delete rule
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  const companyId = req.user.company_id || 1;
  await db.run('DELETE FROM automation_rules WHERE id = ? AND company_id = ?', req.params.id, companyId);
  res.json({ ok: true });
});

// Export function for use in other routes
export async function runAutomations(trigger, ticket, db) {
  if (!ticket?.company_id) return;
  try {
    const rules = await db.all(
      `SELECT * FROM automation_rules WHERE company_id = ? AND is_enabled = 1 AND trigger_type = ?`,
      ticket.company_id, trigger
    );
    for (const rule of rules) {
      const conditions = JSON.parse(rule.conditions || '[]');
      const actions = JSON.parse(rule.actions || '[]');
      const logic = rule.condition_logic || 'AND';
      let conditionsMet = true;
      if (conditions.length > 0) {
        const results = conditions.map(c => {
          const val = ticket[c.field];
          if (c.op === 'eq') return String(val) === String(c.value);
          if (c.op === 'contains') return String(val || '').toLowerCase().includes(String(c.value).toLowerCase());
          if (c.op === 'neq') return String(val) !== String(c.value);
          return true;
        });
        conditionsMet = logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
      if (!conditionsMet) continue;
      const actionsTaken = [];
      for (const action of actions) {
        try {
          if (action.type === 'add_note') {
            await db.run('INSERT INTO ticket_notes (ticket_id, user_id, body) VALUES (?, ?, ?)',
              ticket.id, ticket.submitter_id, `[Automation: ${rule.name}] ${action.value}`);
            actionsTaken.push({ type: 'add_note', value: action.value });
          } else if (action.type === 'change_priority') {
            await db.run('UPDATE tickets SET priority = ?, updated_at = NOW() WHERE id = ?', action.value, ticket.id);
            actionsTaken.push({ type: 'change_priority', value: action.value });
          } else if (action.type === 'change_status') {
            await db.run('UPDATE tickets SET status = ?, updated_at = NOW() WHERE id = ?', action.value, ticket.id);
            actionsTaken.push({ type: 'change_status', value: action.value });
          }
        } catch (e) {
          console.error('[automations] action error:', e.message);
        }
      }
      if (actionsTaken.length > 0) {
        await db.run('UPDATE automation_rules SET run_count = run_count + 1, last_run_at = NOW() WHERE id = ?', rule.id);
        await db.run('INSERT INTO automation_logs (rule_id, company_id, ticket_id, triggered_by, actions_taken) VALUES (?, ?, ?, ?, ?)',
          rule.id, ticket.company_id, ticket.id, trigger, JSON.stringify(actionsTaken));
      }
    }
  } catch (e) {
    console.error('[automations] error:', e.message);
  }
}

export default router;
