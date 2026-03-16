// PDF generation utilities using jsPDF
// Client-side only (browser API required)

import { Schedule, Activity } from './types';

/**
 * Convert 24-hour time to AM/PM format
 */
function formatTime12Hour(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/**
 * Format date as "March 16, 2026"
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Get day name from date
 */
function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Generate a PDF from a schedule using the exact same HTML as preview
 * Call this from client-side code only
 */
export async function generatePDF(schedule: Schedule): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('PDF generation must be called from client-side');
  }

  // Use the exact same HTML as the preview
  const html = generatePrintableHTML(schedule);

  // Use html2pdf.js to convert HTML to PDF
  const html2pdf = (await import('html2pdf.js')).default;

  // Create a container with the HTML
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.width = '8in';
  container.style.background = 'white';

  const opt = {
    margin: 0.25,
    filename: `daily-grid-${schedule.date}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
  };

  return html2pdf().set(opt).from(container).outputPdf('blob');
}

/**
 * Download PDF directly to user's device
 */
export async function downloadPDF(schedule: Schedule, filename?: string): Promise<void> {
  const blob = await generatePDF(schedule);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `schedule-${schedule.date}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate HTML for printable view - Grid format with columns for each person
 */
export function generatePrintableHTML(schedule: Schedule): string {
  const people = ['Jason', 'Kay', 'Emma', 'Toby'];

  // Group activities by time slot
  const timeSlots = new Map<string, Map<string, any>>();
  for (const activity of schedule.activities) {
    const timeKey = `${activity.start}-${activity.end}`;
    if (!timeSlots.has(timeKey)) {
      timeSlots.set(timeKey, new Map());
    }
    for (const person of activity.people || []) {
      timeSlots.get(timeKey)!.set(person, activity);
    }
  }

  // Sort time slots
  const sortedSlots = Array.from(timeSlots.entries()).sort((a, b) => {
    const [aStart] = a[0].split('-');
    const [bStart] = b[0].split('-');
    return aStart.localeCompare(bStart);
  });

  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 9pt;
        line-height: 1.2;
        padding: 0.3in;
        max-width: 8in;
        margin: 0 auto;
        background: white;
      }
      .header {
        text-align: center;
        border-bottom: 2px solid #4a6fa5;
        padding-bottom: 5px;
        margin-bottom: 8px;
      }
      .header h1 {
        font-size: 18pt;
        color: #4a6fa5;
        margin-bottom: 2px;
      }
      .header .date {
        font-size: 11pt;
        color: #666;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
      }
      th {
        background: #4a6fa5;
        color: white;
        padding: 4px 4px;
        text-align: left;
        font-size: 8pt;
        font-weight: bold;
      }
      td {
        padding: 3px 4px;
        border-bottom: 1px solid #ddd;
        font-size: 8pt;
        vertical-align: top;
        width: 22%;
      }
      .time-col {
        font-weight: bold;
        color: #4a6fa5;
        width: 55px;
      }
      tr:nth-child(even) {
        background: #f9f9f9;
      }
      .legend {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #ddd;
      }
      .legend h3 {
        font-size: 12pt;
        margin-bottom: 10px;
        color: #333;
      }
      .legend-items {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 9pt;
      }
      .legend-color {
        display: inline-block;
        width: 16px;
        height: 16px;
        border-radius: 2px;
      }

      @media print {
        body {
          padding: 0.25in;
          font-size: 8pt;
        }
        .header h1 {
          font-size: 16pt;
        }
      }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Daily Grid - ${schedule.date}</title>
        ${styles}
      </head>
      <body>
        <div class="header">
          <h1>Daily Grid - ${getDayName(schedule.date)}</h1>
          <p class="date">${formatDate(schedule.date)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Jason</th>
              <th>Kay</th>
              <th>Emma</th>
              <th>Toby</th>
            </tr>
          </thead>
          <tbody>
  `;

  for (const [timeKey, personActivities] of sortedSlots) {
    const [start, end] = timeKey.split('-');
    const start12 = formatTime12Hour(start).replace(':00', '');
    const end12 = formatTime12Hour(end).replace(':00', '');
    html += `
            <tr>
              <td class="time-col">${start12} - ${end12}</td>
    `;
    for (const person of people) {
      const activity = personActivities.get(person);
      if (activity) {
        const bgColor = activity.color || '#fff';
        // Check if color is light
        const isLight = bgColor === '#f0f0f0' || bgColor === '#ffffff' || bgColor === '#fff';
        const textColor = isLight ? '#333' : '#000';
        html += `<td style="background: ${bgColor}; color: ${textColor}">${activity.title}</td>`;
      } else {
        html += `<td></td>`;
      }
    }
    html += `</tr>`;
  }

  html += `
          </tbody>
        </table>

        <div class="legend">
          <h3>Color Legend</h3>
          <div class="legend-items">
            <div class="legend-item"><span class="legend-color" style="background: #c8e6c9"></span> Routine</div>
            <div class="legend-item"><span class="legend-color" style="background: #fff9c4"></span> Meal</div>
            <div class="legend-item"><span class="legend-color" style="background: #bbdefb"></span> Personal</div>
            <div class="legend-item"><span class="legend-color" style="background: #d1c4e9"></span> Work</div>
            <div class="legend-item"><span class="legend-color" style="background: #ffe0b2"></span> Family</div>
            <div class="legend-item"><span class="legend-color" style="background: #b2dfdb"></span> School</div>
            <div class="legend-item"><span class="legend-color" style="background: #f8bbd0"></span> Activity</div>
            <div class="legend-item"><span class="legend-color" style="background: #f0f0f0"></span> Break</div>
            <div class="legend-item"><span class="legend-color" style="background: #ffffff; border: 1px solid #ccc"></span> Other</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return html;
}

/**
 * Open printable view in new window
 */
export function openPrintableView(schedule: Schedule): void {
  if (typeof window === 'undefined') return;

  const html = generatePrintableHTML(schedule);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Group activities by person
 */
function groupActivitiesByPerson(activities: Activity[]): Record<string, Activity[]> {
  const grouped: Record<string, Activity[]> = {};

  for (const activity of activities) {
    for (const person of activity.people) {
      if (!grouped[person]) {
        grouped[person] = [];
      }
      grouped[person].push(activity);
    }
  }

  // Sort activities by time for each person
  for (const person in grouped) {
    grouped[person].sort((a, b) => {
      const aTime = a.start.split(':').map(Number);
      const bTime = b.start.split(':').map(Number);
      return aTime[0] * 60 + aTime[1] - (bTime[0] * 60 + bTime[1]);
    });
  }

  return grouped;
}
