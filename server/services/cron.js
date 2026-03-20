/**
 * ATLAS Scheduled Tasks
 * Weekly intelligence report — Monday 9am UTC
 */

import cron from 'node-cron';
import db from '../db/connection.js';
import * as atlas from './atlas.js';
import { gatherWeeklyStats } from './learning.js';
import { sendWeeklyReport } from './email.js';

export function startCronJobs() {
  // Monday at 9:00 AM UTC
  cron.schedule('0 9 * * 1', async () => {
    console.log('[ATLAS Cron] Running weekly intelligence report…');
    try {
      const stats = await gatherWeeklyStats();
      const reportText = await atlas.generateWeeklyReport(stats);
      if (!reportText) {
        console.log('[ATLAS Cron] No report generated (AI disabled?)');
        return;
      }

      // Send to all admin users
      const admins = await db.all("SELECT name, email FROM users WHERE role = 'admin' AND is_active = 1");
      for (const admin of admins) {
        await sendWeeklyReport({ to: admin.email, name: admin.name, report: reportText, stats });
      }

      console.log(`[ATLAS Cron] Weekly report sent to ${admins.length} admin(s)`);
    } catch (e) {
      console.error('[ATLAS Cron] Weekly report failed:', e.message);
    }
  }, { timezone: 'UTC' });

  console.log('✓ ATLAS cron jobs scheduled');
}
