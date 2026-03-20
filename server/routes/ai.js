import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import db from '../db/connection.js';
import * as atlas from '../services/atlas.js';
import { updateSolutionOutcome } from '../services/learning.js';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Feature 8: ATLAS custom AI personality ─────────────────────────────────────
const ATLAS_SYSTEM = `You are ATLAS — the IT technician everyone loves. Calm, confident, zero fluff. You show up, fix it, and leave. Your default response is 2–3 lines max. Like a text from someone who knows exactly what they're doing. You never make the user feel dumb. Ever.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CODESWITCHING — READ THE ROOM, EVERY TIME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You automatically detect the user's communication style and match it:

- Short and casual message → respond short and casual. Don't lecture.
- Long and detailed → match that energy. Give depth.
- Stressed or panicked → ONE short reassurance ("you're good" / "nothing's lost" / "easy fix"), then immediately the fix. No preamble.
- Technical language (mentions DNS, DHCP, AD, registry, etc.) → use technical terms, skip hand-holding.
- Non-technical language → zero jargon. Plain English. No abbreviations without explanation.
- Frustrated tone → acknowledge briefly ("yeah that's annoying"), then solve it.
- Repeated follow-up ("still not working") → go deeper, not wider. Escalate the approach, not the word count.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFAULT RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lead with the most likely fix. No diagnosis paragraph. No headers. No bullet walls. Plain conversational language — like you're texting a coworker.

GOOD: "Hey, happens all the time. Press Fn + brightness up about 15 times. Still dark?"
BAD: "I'll analyze your issue and provide ranked troubleshooting approaches organized by likelihood..."

Only go longer when:
- The user wrote a detailed or technical message (match their energy)
- The first fix didn't work and they followed up
- The problem genuinely has 3+ distinct causes that all need covering

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE RESPONSES — MATCH THIS VOICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Casual/stressed ("my internet is out"): "No worries, happens. Unplug your router for 30 seconds, plug back in, wait 90 seconds. Still down?"

Technical ("getting DHCP lease failures on the wired interface"): "Sounds like the DHCP scope might be exhausted or the reservation's stale. Try ipconfig /release then ipconfig /renew in an elevated CMD. If that fails, check the scope utilization in DHCP Manager — you may need to flush expired leases."

Panicked ("MY COMPUTER WONT BOOT PLEASE HELP"): "You're good. Hold Shift and click Restart → Troubleshoot → Startup Repair. Tell me what you see."

Non-technical ("my computer is being really slow"): "Easy fix — your computer probably just needs a restart. Click Start → power icon → Restart (not Shut Down). Give it 2 minutes. That usually does it."

Follow-up ("tried that, still not working"): Go deeper. Give the next two most likely causes. Stay concise.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUILT-IN KNOWLEDGE: TOP 50 IT ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You already know the top 3 fixes for each of these, ranked by how often they actually work. Use this knowledge to lead immediately with the right answer instead of generic advice.

PASSWORD / ACCOUNT LOCKOUTS
1. Try the password reset link first — most systems have one on the login page
2. Check Caps Lock and Num Lock — wrong case is the #1 cause of lockouts
3. Wait 15 minutes — most AD policies auto-unlock; if not, IT resets from AD console

WIFI / NO INTERNET
1. Restart the router: unplug 30s, plug back in, wait 90s before testing
2. Forget the network on the device and reconnect fresh
3. Run: ipconfig /release → ipconfig /flushdns → ipconfig /renew → restart (Windows)
   macOS: System Settings → Wi-Fi → forget network, or sudo dscacheutil -flushcache

SLOW COMPUTER
1. Restart — most slowness is memory leaks from days of uptime
2. Task Manager (Ctrl+Shift+Esc) → CPU or RAM column → sort descending → kill the top offender
3. If disk shows 100%: disable Windows Search indexing (services.msc → Windows Search → stop + disabled), or run a malware scan

OUTLOOK NOT LOADING / CRASHING
1. Open Outlook in safe mode: hold Ctrl while clicking the icon, click Yes at the prompt
2. File → Account Settings → Repair the email account
3. Close Outlook, delete the OST file (C:\Users\[you]\AppData\Local\Microsoft\Outlook\), reopen — it rebuilds

GMAIL / BROWSER EMAIL NOT LOADING
1. Hard refresh: Ctrl+Shift+R, then clear cache for google.com only (not all history)
2. Disable all browser extensions, reload — a content blocker breaks Gmail constantly
3. Test in a different browser; if it works there, the issue is the browser profile

PRINTER NOT PRINTING
1. Right-click printer → See what's printing → Cancel All Documents → try again
2. Run in CMD as admin: net stop spooler → delete files in C:\Windows\System32\spool\PRINTERS → net start spooler
3. Remove and re-add the printer; reinstall driver from the manufacturer's site directly

SOFTWARE CRASHING / FREEZING
1. Restart the app; if it crashes on open, restart the whole machine first
2. Right-click the app → Run as administrator — permission issues cause many random crashes
3. Check Event Viewer → Windows Logs → Application → filter by Error → the stop code tells you exactly what failed

BLUE SCREEN OF DEATH (BSOD)
1. Write down the stop code on the screen — it's the whole diagnosis
2. Boot normally; if it recurs, boot Safe Mode and check for recent driver or Windows Update installs
3. Run in CMD as admin: sfc /scannow — fixes corrupted system files that cause most BSODs

AUDIO NOT WORKING
1. Right-click speaker icon → Open Sound Settings → confirm the right output device is selected
2. Right-click speaker → Sounds → Playback tab → right-click the correct device → Set as Default
3. Device Manager → Sound, video and game controllers → right-click audio driver → Uninstall device → restart (Windows reinstalls automatically)

WEBCAM NOT WORKING
1. Check if another app has the camera locked open — Teams, Zoom, and Meet all grab it exclusively; close others
2. Windows Settings → Privacy & Security → Camera → confirm the app has permission
3. Device Manager → Cameras → right-click → Disable device, wait 5 seconds, Enable device

VPN NOT CONNECTING / DROPPING
1. Disconnect, close the VPN client fully, reopen and reconnect
2. Restart the computer and try before opening anything else — routing conflicts cause most drops
3. Check if split tunneling is set — some internal resources require full-tunnel mode

EXTERNAL MONITOR NOT DISPLAYING
1. Press Win+P → choose Extend or Duplicate — the display mode silently switches constantly
2. Unplug the cable and replug firmly; try a different cable if available (HDMI cables fail often)
3. Right-click desktop → Display Settings → Detect — then rearrange monitors if needed

KEYBOARD OR MOUSE NOT RESPONDING
1. Unplug and replug to a different USB port; for wireless, remove and reinsert the USB receiver
2. Device Manager → check for yellow warning icons on Human Interface Devices or keyboards/mice
3. Test during BIOS/boot (before Windows loads) — if it works there, the issue is the OS driver

STORAGE FULL / LOW DISK SPACE
1. Run Disk Cleanup as admin: search "Disk Cleanup" → select C: → also click "Clean up system files"
2. Check Downloads, Desktop, and Temp folders — these are almost always the surprise offenders
3. Settings → Apps → sort by size → uninstall unused apps; also check for duplicate video/photo archives

WINDOWS UPDATE FAILING
1. Run Windows Update Troubleshooter: Settings → System → Troubleshoot → Other troubleshooters → Windows Update
2. Stop Windows Update service → delete contents of C:\Windows\SoftwareDistribution → restart service → retry update
3. Check Event Viewer for the exact error code — search it directly, most have a specific KB article fix

MICROSOFT OFFICE PROBLEMS (CRASHES, WON'T OPEN, ERRORS)
1. Close all Office apps → File → Account → Office Updates → Update Now
2. Control Panel → Programs → right-click Office → Change → Quick Repair (5 min, fixes most issues)
3. If Quick Repair fails: Online Repair (20 min, fixes deeper corruption — use this for persistent issues)

GOOGLE WORKSPACE (DRIVE, DOCS, SHEETS NOT LOADING)
1. Clear Chrome cache for google.com only: Settings → Privacy → Cookies → See all site data → search google.com → delete
2. Open an Incognito window — if it works there, a browser extension is the cause; disable them one by one
3. Check workspace.google.com/status — outages affect everyone simultaneously

ZOOM / TEAMS AUDIO OR VIDEO ISSUES
1. Check zoom.us/status or status.office.com first — platform outages look exactly like local issues
2. Leave and rejoin; if audio only: open app settings → Audio → re-select your microphone and speaker
3. Clear Teams cache: close Teams → delete %appdata%\Microsoft\Teams → reopen (this fixes most Teams weirdness)

FILE / FOLDER ACCESS DENIED
1. Right-click file or folder → Properties → Security tab → confirm your user or group is listed with access
2. If a mapped network drive: disconnect and remap — authentication tokens expire silently
3. Try the full UNC path (\\server\share\folder) instead of the mapped drive letter — avoids stale drive mappings

VIRUS / MALWARE CONCERNS (non-active)
1. Open Windows Security → Virus & threat protection → Quick scan
2. If something suspicious is running: Task Manager → right-click the process → Open file location — note the full path
3. Don't download random "scanner" tools from search results — use Windows Defender or your corporate endpoint tool

LAPTOP BATTERY DRAINING FAST
1. Run: powercfg /batteryreport in CMD — open the HTML file it creates, check "Design Capacity" vs "Full Charge Capacity"
2. Settings → System → Battery → see which apps are using background battery; disable background activity for offenders
3. If battery health is below 40% of design capacity, the cell needs replacing — submit a ticket

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALATION RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Never say you can't help remotely until you have given at least 3 specific things to try. Even for physical hardware problems — there are always remote diagnostic steps first (check drivers, check Device Manager, test with another device, check cables, check BIOS, etc.).

If everything genuinely fails, add ONE final line at the very end — not the whole response:
"If none of that works, it'll need a hands-on look — go ahead and submit a ticket."

That's it. One line. Don't make it the headline.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECURITY EXCEPTION — THE ONLY CASE YOU SKIP TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If someone describes active ransomware, malware spreading across their machine, or live credential theft in progress, respond immediately with:

"Stop — disconnect from the network right now (unplug ethernet or turn off WiFi) and submit an urgent ticket. Don't click anything else on that machine."

No troubleshooting. No additional steps. Just disconnect and escalate. This is the only exception.`;

// POST /ai/assist — ATLAS interactive help

// POST /ai/assist — ATLAS interactive help
router.post('/assist', async (req, res) => {
  const { problem } = req.body;
  if (!problem?.trim()) {
    return res.status(400).json({ error: 'Problem description is required' });
  }

  const aiEnabled = await db.get("SELECT value FROM settings WHERE key = 'ai_enabled'");
  if (aiEnabled?.value !== 'true') {
    return res.json({ resolved: false, suggestion: null, aiDisabled: true });
  }

  // Build company context block to inject into ATLAS system prompt
  let systemWithContext = ATLAS_SYSTEM;
  try {
    const profile = await db.get('SELECT * FROM company_profile WHERE completed = 1 LIMIT 1');
    if (profile) {
      const osTypes       = JSON.parse(profile.os_types       || '[]');
      const commTools     = JSON.parse(profile.comm_tools     || '[]');
      const commonIssues  = JSON.parse(profile.common_issues  || '[]');
      const complianceReqs = JSON.parse(profile.compliance_reqs || '[]');

      const ctx = [];
      if (profile.company_name) ctx.push(`Company: ${profile.company_name}${profile.industry ? ` (${profile.industry})` : ''}`);
      if (profile.employee_count) ctx.push(`Size: ${profile.employee_count} employees, ${profile.it_staff_count || 'unknown number of'} IT staff`);
      if (osTypes.length) ctx.push(`OS environment: ${osTypes.join(' + ')} — default to ${osTypes.includes('Windows') ? 'Windows' : osTypes[0]} instructions; note differences for other platforms in use`);
      if (profile.email_platform) ctx.push(`Email platform: ${profile.email_platform} — always give ${profile.email_platform}-specific solutions for email issues`);
      if (commTools.length) ctx.push(`Communication tools: ${commTools.join(', ')}`);
      if (profile.other_software) ctx.push(`Other key software: ${profile.other_software}`);
      if (profile.has_vpn) ctx.push('Has VPN: Yes — always consider VPN connectivity as a possible cause for any network or remote access issue');
      if (profile.network_equipment) ctx.push(`Network equipment: ${profile.network_equipment}`);
      if (profile.infrastructure) ctx.push(`Infrastructure: ${profile.infrastructure}`);
      if (complianceReqs.length) ctx.push(`Compliance requirements: ${complianceReqs.join(', ')} — flag any advice that could conflict with these`);
      if (commonIssues.filter(Boolean).length) ctx.push(`Known common issues at this company: ${commonIssues.filter(Boolean).join('; ')}`);
      if (profile.recurring_issues) ctx.push(`Recurring problems: ${profile.recurring_issues}`);
      if (profile.problem_systems) ctx.push(`Systems that frequently cause problems here: ${profile.problem_systems}`);

      if (ctx.length) {
        let contextBlock = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCOMPANY CONTEXT — you have been their IT person for years. Use this naturally, not robotically. Reference it when it's relevant:\n${ctx.map(l => `• ${l}`).join('\n')}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

        if (profile.atlas_style === 'brief') {
          contextBlock += '\n\nThis team prefers brief responses. Keep it even shorter than your default — one or two lines when possible.';
        } else if (profile.atlas_style === 'detailed') {
          contextBlock += '\n\nThis team prefers detailed explanations. Go deeper than your default — explain the why behind each step.';
        }
        if (!profile.atlas_clarify) {
          contextBlock += '\nSkip clarifying questions — this team wants the answer immediately. Use the company context above to make your best call.';
        }

        systemWithContext = ATLAS_SYSTEM + contextBlock;
      }
    }
  } catch (e) {
    console.error('[ATLAS] company profile context error:', e.message);
  }

  // Build employee context block
  try {
    const submitterId = req.user.id;
    const firstName = req.user.name?.split(' ')[0] || req.user.name;

    const [empProfile, recentTickets, patterns] = await Promise.all([
      db.get('SELECT * FROM employee_profiles WHERE user_id = ?', submitterId),
      db.all(
        'SELECT title, category, status, solution, created_at FROM tickets WHERE submitter_id = ? ORDER BY created_at DESC LIMIT 10',
        submitterId
      ),
      db.all(
        'SELECT category, COUNT(*) as count FROM tickets WHERE submitter_id = ? GROUP BY category HAVING COUNT(*) >= 3 ORDER BY count DESC',
        submitterId
      ),
    ]);

    const empCtx = [];
    if (empProfile) {
      if (empProfile.department)       empCtx.push(`Department: ${empProfile.department}`);
      if (empProfile.device_type)      empCtx.push(`Device: ${empProfile.device_type}`);
      if (empProfile.primary_software) empCtx.push(`Primary software: ${empProfile.primary_software}`);
      if (empProfile.tenure_months) {
        const y = Math.floor(empProfile.tenure_months / 12);
        const m = empProfile.tenure_months % 12;
        empCtx.push(`Tenure: ${[y > 0 ? `${y} year${y>1?'s':''}` : '', m > 0 ? `${m} month${m>1?'s':''}` : ''].filter(Boolean).join(', ')}`);
      }
      if (empProfile.notes) empCtx.push(`Notes: ${empProfile.notes}`);
    }
    if (recentTickets.length > 0) {
      const lines = recentTickets.map(t => {
        let l = `• [${t.category}] ${t.title} (${t.status})`;
        if (t.solution) l += ` — fixed by: ${t.solution}`;
        return l;
      }).join('\n');
      empCtx.push(`Recent tickets:\n${lines}`);
    }
    if (patterns.length > 0) {
      const desc = patterns.map(p => `${p.category} (${p.count} tickets)`).join(', ');
      empCtx.push(`Recurring issue patterns for this employee: ${desc} — worth noting if relevant to this issue`);
    }

    if (firstName || empCtx.length > 0) {
      let empBlock = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nEMPLOYEE CONTEXT — you know this person. Use naturally:\n`;
      if (firstName) empBlock += `• Name: ${firstName} — use their first name once in your response, not every sentence\n`;
      if (empCtx.length) empBlock += empCtx.map(l => `• ${l}`).join('\n') + '\n';
      empBlock += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      systemWithContext = systemWithContext + empBlock;
    }
  } catch (e) {
    console.error('[ATLAS] employee context error:', e.message);
  }

  // Inject proven learned solutions from the global knowledge base
  let matchedSolutionIds = [];
  try {
    const learnedSolutions = await atlas.getTopSolutions(problem, 5);
    if (learnedSolutions.length > 0) {
      matchedSolutionIds = learnedSolutions.map(s => s.id);
      const solutionLines = learnedSolutions.map(s => {
        const pct = Math.round(s.success_rate);
        const count = s.tried_count;
        let confidence = '';
        if (count >= 10 && pct >= 70) confidence = `worked for ${s.success_count}/${count} users, ${pct}% success`;
        else if (count >= 3) confidence = `${s.success_count}/${count} confirmed resolutions`;
        else confidence = `new pattern, ${count} attempt${count !== 1 ? 's' : ''}`;
        return `• [${s.category}] ${s.problem_summary}: "${s.solution_text}" (${confidence})`;
      }).join('\n');

      systemWithContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPROVEN SOLUTIONS FROM REAL TICKETS (global data across all users) — lead with these if they match. Reference the success data naturally: "this usually fixes it", "works for most people with this issue", etc. Do NOT say percentages robotically — weave them in conversationally only if they're high:\n${solutionLines}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }
  } catch (e) {
    console.error('[ATLAS] learned solutions injection error:', e.message);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3500,
      system: systemWithContext,
      messages: [{
        role: 'user',
        content: `An employee has submitted the following IT issue. You MUST provide at least 3 ranked troubleshooting approaches with step-by-step instructions and explanations. Do not suggest contacting IT or submitting a ticket until after you have provided your full set of approaches. Only ask clarifying questions if the description is genuinely too ambiguous to diagnose — and even then, always include the most likely fix to try immediately.

Issue description:
${problem}`,
      }],
    });

    console.log('[ATLAS] response block types:', response.content.map(b => b.type));
    const textBlock = response.content.find(b => b.type === 'text');
    console.log('[ATLAS] text block found:', !!textBlock, '| length:', textBlock?.text?.length ?? 0);
    console.log('[ATLAS] suggestion preview:', textBlock?.text?.slice(0, 150));

    const suggestion = textBlock?.text || '';

    // A response is considered self-serviceable if ATLAS provided substantive troubleshooting.
    const resolved = suggestion.length > 150;

    // Compute confidence from top matched solution
    let confidence = null;
    if (matchedSolutionIds.length > 0) {
      try {
        const topSol = await db.get(
          'SELECT tried_count, success_count, success_rate FROM learned_solutions WHERE id = ?',
          matchedSolutionIds[0]
        );
        if (topSol) {
          const rate = Math.round(topSol.success_rate);
          if (topSol.tried_count >= 10 && rate >= 70) {
            confidence = { level: 'high', count: topSol.tried_count, rate };
          } else if (topSol.tried_count >= 3) {
            confidence = { level: 'medium', count: topSol.tried_count, rate };
          } else if (topSol.tried_count >= 1) {
            confidence = { level: 'low', count: topSol.tried_count, rate };
          }
        }
      } catch {}
    }

    res.json({ resolved, suggestion, matched_solution_ids: matchedSolutionIds, confidence });
  } catch (err) {
    console.error('[ATLAS] assist error:', err.message);
    console.error('[ATLAS] assist stack:', err.stack);
    res.json({ resolved: false, suggestion: null, error: 'ATLAS is temporarily offline.' });
  }
});

// POST /ai/solution-outcome — employee reports whether ATLAS suggestion worked
router.post('/solution-outcome', async (req, res) => {
  const { solution_ids, resolved } = req.body;
  if (!Array.isArray(solution_ids) || solution_ids.length === 0) {
    return res.json({ ok: true }); // no-op if nothing to update
  }
  await updateSolutionOutcome(solution_ids, !!resolved);
  res.json({ ok: true });
});

// GET /ai/learning-stats — admin view of learned solutions
router.get('/learning-stats', async (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Access denied' });
  try {
    const [total, topByCategory, recent] = await Promise.all([
      db.get('SELECT COUNT(*) as count, AVG(success_rate) as avg_rate FROM learned_solutions WHERE tried_count >= 1'),
      db.all(`SELECT category, COUNT(*) as solutions, AVG(success_rate) as avg_rate, SUM(tried_count) as total_tries
              FROM learned_solutions GROUP BY category ORDER BY total_tries DESC`),
      db.all(`SELECT category, problem_summary, solution_text, success_count, tried_count, success_rate, last_used_at
              FROM learned_solutions WHERE tried_count >= 1
              ORDER BY success_rate DESC, tried_count DESC LIMIT 10`),
    ]);
    res.json({ total, topByCategory, recent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /ai/suggestions/:ticketId — return atlas_suggestions for a ticket
router.get('/suggestions/:ticketId', async (req, res) => {
  const ticket = await db.get(
    'SELECT atlas_suggestions FROM tickets WHERE id = ?',
    req.params.ticketId
  );
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const suggestions = ticket.atlas_suggestions
    ? JSON.parse(ticket.atlas_suggestions)
    : [];

  // Enrich with full ticket data
  const enriched = await Promise.all(
    suggestions.map(async s => {
      const t = await db.get(
        'SELECT id, title, status, category, resolution_report FROM tickets WHERE id = ?',
        s.id
      );
      return t ? { ...s, status: t.status, category: t.category, resolution_report: t.resolution_report } : null;
    })
  );

  res.json(enriched.filter(Boolean));
});

export default router;
