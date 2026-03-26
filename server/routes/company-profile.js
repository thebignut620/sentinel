import express from 'express';
import db from '../db/connection.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

function parseProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    os_types:       JSON.parse(profile.os_types       || '[]'),
    comm_tools:     JSON.parse(profile.comm_tools     || '[]'),
    common_issues:  JSON.parse(profile.common_issues  || '[]'),
    compliance_reqs: JSON.parse(profile.compliance_reqs || '[]'),
  };
}

// GET — any authenticated user can read (ATLAS needs it for all roles)
router.get('/', authenticate, async (req, res) => {
  const companyId = req.user.company_id || 1;
  const profile = await db.get('SELECT * FROM company_profile WHERE company_id = ? LIMIT 1', companyId);
  res.json(parseProfile(profile));
});

// PUT — admin only, upsert
router.put('/', authenticate, requireRole('admin'), async (req, res) => {
  const {
    company_name, industry, employee_count, it_staff_count,
    os_types, email_platform, comm_tools, other_software,
    common_issues, recurring_issues, problem_systems,
    has_vpn, network_equipment, infrastructure, compliance_reqs,
    atlas_style, atlas_clarify, completed,
  } = req.body;

  const companyId = req.user.company_id || 1;
  const osJson         = JSON.stringify(os_types        || []);
  const toolsJson      = JSON.stringify(comm_tools      || []);
  const issuesJson     = JSON.stringify(common_issues   || []);
  const complianceJson = JSON.stringify(compliance_reqs || []);

  const existing = await db.get('SELECT id FROM company_profile WHERE company_id = ? LIMIT 1', companyId);

  if (existing) {
    await db.run(
      `UPDATE company_profile SET
        company_name = ?, industry = ?, employee_count = ?, it_staff_count = ?,
        os_types = ?, email_platform = ?, comm_tools = ?, other_software = ?,
        common_issues = ?, recurring_issues = ?, problem_systems = ?,
        has_vpn = ?, network_equipment = ?, infrastructure = ?, compliance_reqs = ?,
        atlas_style = ?, atlas_clarify = ?, completed = ?, updated_at = NOW()
       WHERE id = ?`,
      company_name ?? null, industry ?? null, employee_count ?? null, it_staff_count ?? null,
      osJson, email_platform ?? null, toolsJson, other_software ?? null,
      issuesJson, recurring_issues ?? null, problem_systems ?? null,
      has_vpn ? 1 : 0, network_equipment ?? null, infrastructure ?? null, complianceJson,
      atlas_style ?? 'balanced', atlas_clarify ? 1 : 0, completed ? 1 : 0,
      existing.id
    );
  } else {
    await db.run(
      `INSERT INTO company_profile (
        company_name, industry, employee_count, it_staff_count,
        os_types, email_platform, comm_tools, other_software,
        common_issues, recurring_issues, problem_systems,
        has_vpn, network_equipment, infrastructure, compliance_reqs,
        atlas_style, atlas_clarify, completed, company_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      company_name ?? null, industry ?? null, employee_count ?? null, it_staff_count ?? null,
      osJson, email_platform ?? null, toolsJson, other_software ?? null,
      issuesJson, recurring_issues ?? null, problem_systems ?? null,
      has_vpn ? 1 : 0, network_equipment ?? null, infrastructure ?? null, complianceJson,
      atlas_style ?? 'balanced', atlas_clarify ? 1 : 0, completed ? 1 : 0, companyId
    );
  }

  const profile = await db.get('SELECT * FROM company_profile WHERE company_id = ? LIMIT 1', companyId);
  res.json(parseProfile(profile));
});

export default router;
