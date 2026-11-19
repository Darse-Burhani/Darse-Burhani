import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../server/src/lib/prisma';
import {
  loadSheetConfigFromDb,
  saveSheetConfiguration,
  syncDailyAttendanceToSheet,
  syncELearningAttendanceToSheet,
  sheetSyncStatus,
  elearningSheetSyncStatus,
} from '../server/src/lib/google-attendance-sync';

async function main() {
  console.log('🔄 Loading Google Sheets configuration...');
  await loadSheetConfigFromDb();

  const SPREADSHEET_ID = '1AR1lqoCbQ4NoLDvpSZbuDnBT6Zud3I5oGQ2c0aHM2yQ';

  // Ensure spreadsheetId is linked in DB config
  console.log(`🔗 Ensuring master spreadsheet is linked (${SPREADSHEET_ID})...`);
  await saveSheetConfiguration({
    spreadsheetId: SPREADSHEET_ID,
    elearningSpreadsheetId: SPREADSHEET_ID,
    enabled: true,
  });

  const today = new Date();
  console.log(`📅 Target Date: ${today.toISOString().slice(0, 10)}`);

  console.log('\n📊 1. Syncing Daily Full Attendance Log (Talabat & Faculty)...');
  try {
    const dailyRes = await syncDailyAttendanceToSheet(today);
    console.log(`✅ Daily Attendance Synced:`);
    console.log(`   - Tab: "${dailyRes.tabTitle}"`);
    console.log(`   - Rows Synced: ${dailyRes.rowsSynced}`);
    console.log(`   - URL: ${dailyRes.url}`);
  } catch (err: any) {
    console.warn(`⚠️ Daily Attendance sync error:`, err?.message || err);
  }

  console.log('\n🎓 2. Syncing E-Learning Faculty Scans...');
  try {
    const elearningRes = await syncELearningAttendanceToSheet(today);
    console.log(`✅ E-Learning Attendance Synced:`);
    console.log(`   - Tab: "${elearningRes.tabTitle}"`);
    console.log(`   - Rows Synced: ${elearningRes.rowsSynced}`);
    console.log(`   - URL: ${elearningRes.url}`);
  } catch (err: any) {
    console.warn(`⚠️ E-Learning sync error:`, err?.message || err);
  }

  console.log('\n📋 Current Sheet Status:');
  console.log('Main Sheet:', sheetSyncStatus());
  console.log('E-Learning Sheet:', elearningSheetSyncStatus());

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal sync failure:', e);
  await prisma.$disconnect();
  process.exit(1);
});
