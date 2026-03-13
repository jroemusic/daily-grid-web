// PDF generation utilities using jsPDF
// Client-side only (browser API required)

import { Schedule, Activity } from './types';

/**
 * Generate a PDF from a schedule
 * Call this from client-side code only
 */
export async function generatePDF(schedule: Schedule): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('PDF generation must be called from client-side');
  }

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'letter');

  const pageWidth = 216; // letter width in mm
  const pageHeight = 279; // letter height in mm
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let yPosition = margin;

  // Add title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`Daily Schedule - ${schedule.date}`, margin, yPosition);
  yPosition += 10;

  // Add day name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(schedule.dayName, margin, yPosition);
  yPosition += 15;

  // Group activities by person
  const activitiesByPerson = groupActivitiesByPerson(schedule.activities);

  // Print each person's schedule
  for (const [person, activities] of Object.entries(activitiesByPerson)) {
    if (activities.length === 0) continue;

    // Check if we need a new page
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = margin;
    }

    // Person header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${person}'s Schedule:`, margin, yPosition);
    yPosition += 7;

    // Activities
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    for (const activity of activities) {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }

      const timeRange = `${activity.start} - ${activity.end}`;
      const line = `${timeRange} | ${activity.title}`;

      // Handle long text
      const lines = doc.splitTextToSize(line, contentWidth);
      doc.text(lines, margin + 5, yPosition);
      yPosition += lines.length * 5 + 2;

      // Add notes if present
      if (activity.notes) {
        doc.setTextColor(100);
        const noteLines = doc.splitTextToSize(`  Note: ${activity.notes}`, contentWidth - 5);
        doc.text(noteLines, margin + 5, yPosition);
        yPosition += noteLines.length * 5 + 2;
        doc.setTextColor(0);
      }
    }

    yPosition += 10;
  }

  return new Blob([doc.output('blob')], { type: 'application/pdf' });
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
 * Generate HTML for printable view
 */
export function generatePrintableHTML(schedule: Schedule): string {
  const activitiesByPerson = groupActivitiesByPerson(schedule.activities);

  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 20px;
        line-height: 1.5;
        background: white;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
        border-bottom: 2px solid #333;
        padding-bottom: 20px;
      }
      .header h1 { font-size: 28px; margin-bottom: 5px; }
      .header p { font-size: 16px; color: #666; }
      .person-section {
        margin-bottom: 30px;
        page-break-inside: avoid;
      }
      .person-header {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
        padding-bottom: 5px;
        border-bottom: 1px solid #ccc;
      }
      .activity {
        display: flex;
        margin-bottom: 12px;
        padding: 8px;
        border-radius: 4px;
        border-left: 4px solid #ddd;
      }
      .activity-time {
        font-weight: bold;
        min-width: 120px;
        color: #333;
      }
      .activity-title {
        flex: 1;
      }
      .activity-notes {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
        font-style: italic;
      }
      @media print {
        body { padding: 0; }
        .person-section { page-break-inside: avoid; }
      }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Daily Schedule - ${schedule.date}</title>
        ${styles}
      </head>
      <body>
        <div class="header">
          <h1>Daily Schedule</h1>
          <p>${schedule.dayName}, ${schedule.date}</p>
        </div>
  `;

  for (const [person, activities] of Object.entries(activitiesByPerson)) {
    if (activities.length === 0) continue;

    html += `
      <div class="person-section">
        <div class="person-header">${person}'s Schedule</div>
    `;

    for (const activity of activities) {
      html += `
        <div class="activity" style="border-left-color: ${activity.color}">
          <div class="activity-time">${activity.start} - ${activity.end}</div>
          <div class="activity-title">${activity.title}</div>
          ${activity.notes ? `<div class="activity-notes">${activity.notes}</div>` : ''}
        </div>
      `;
    }

    html += `</div>`;
  }

  html += `
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
