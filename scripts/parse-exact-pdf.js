const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('public/Teacher.pdf');

const PERIOD_CENTERS = [
  { period: 1, x: 124 },
  { period: 2, x: 207 },
  { period: 3, x: 289 },
  { period: 4, x: 372 },
  { period: 5, x: 454 },
  { period: 6, x: 537 },
  { period: 7, x: 619 },
  { period: 8, x: 702 },
  { period: 9, x: 784 },
];

const DAYS = [
  { day: 'Mon', dayOfWeek: 1, minY: 445, maxY: 510 },
  { day: 'Tue', dayOfWeek: 2, minY: 377, maxY: 445 },
  { day: 'Wed', dayOfWeek: 3, minY: 309, maxY: 377 },
  { day: 'Thu', dayOfWeek: 4, minY: 241, maxY: 309 },
  { day: 'Fri', dayOfWeek: 5, minY: 173, maxY: 241 },
  { day: 'Sat', dayOfWeek: 6, minY: 105, maxY: 173 },
];

function getPeriod(x) {
  let closest = null;
  let minDiff = 9999;
  for (const p of PERIOD_CENTERS) {
    const diff = Math.abs(x - p.x);
    if (diff < minDiff) {
      minDiff = diff;
      closest = p.period;
    }
  }
  return minDiff < 42 ? closest : null;
}

function getDay(y) {
  for (const d of DAYS) {
    if (y >= d.minY && y <= d.maxY) return d;
  }
  return null;
}

async function parseAll() {
  const pdfjs = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  const doc = await pdfjs.getDocument(new Uint8Array(dataBuffer)).promise;
  
  const allAssignments = [];
  const teacherSummaries = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items
      .map(it => ({
        str: it.str.trim(),
        x: it.transform[4],
        y: it.transform[5]
      }))
      .filter(it => it.str.length > 0);

    const teacherItem = items.find(it => it.y > 545 && it.y < 565 && !it.str.includes('الدرس'));
    let rawTeacher = teacherItem ? teacherItem.str : `Page ${i}`;
    // Strip (Class Teacher of ...)
    let cleanTeacher = rawTeacher.replace(/\s*\(Class Teacher.*?\)\s*/g, '').trim();

    const cells = {};
    for (const it of items) {
      if (it.x < 80 || it.y > 510 || it.y < 105) continue;
      const dayObj = getDay(it.y);
      const period = getPeriod(it.x);
      if (!dayObj || !period) continue;
      const key = `${dayObj.day}-${period}`;
      if (!cells[key]) {
        cells[key] = { day: dayObj.day, dayOfWeek: dayObj.dayOfWeek, period, textParts: [] };
      }
      cells[key].textParts.push({ str: it.str, y: it.y });
    }

    const periods = [];
    for (const k of Object.keys(cells)) {
      const c = cells[k];
      c.textParts.sort((a, b) => b.y - a.y);
      
      // Usually textParts has: [subject, class]
      // e.g. "Biology", "3 A"
      // or "Dirasat Uloom i...", "2 A"
      let subject = '';
      let className = '';
      if (c.textParts.length >= 2) {
        className = c.textParts[c.textParts.length - 1].str;
        subject = c.textParts.slice(0, -1).map(p => p.str).join(' ');
      } else if (c.textParts.length === 1) {
        subject = c.textParts[0].str;
      }

      periods.push({
        day: c.day,
        dayOfWeek: c.dayOfWeek,
        period: c.period,
        subject,
        className
      });

      allAssignments.push({
        page: i,
        teacher: cleanTeacher,
        rawTeacher,
        day: c.day,
        dayOfWeek: c.dayOfWeek,
        period: c.period,
        subject,
        className
      });
    }

    periods.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period);

    teacherSummaries.push({
      page: i,
      teacher: cleanTeacher,
      rawTeacher,
      count: periods.length,
      periods
    });
  }

  fs.writeFileSync('public/parsed_pdf_timetable.json', JSON.stringify({ teacherSummaries, allAssignments }, null, 2));
  console.log('Saved to public/parsed_pdf_timetable.json. Total assignments:', allAssignments.length);
  for (const t of teacherSummaries) {
    console.log(`Page ${t.page}: ${t.teacher} -> ${t.count} periods`);
  }
}

parseAll().catch(err => {
  console.error(err);
  process.exit(1);
});
