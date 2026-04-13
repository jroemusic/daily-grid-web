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
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Get day name from date
 */
export function getDayName(dateStr: string): string {
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
    image: { type: 'png' as const, quality: 1 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' as const }
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
 * Get current time in HH:MM format (client-side only)
 * This must be called from browser JavaScript to use local timezone
 */
function getCurrentTimeClientSide(): string {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Check if current time is within a time slot (client-side only)
 */
function isCurrentTimeSlotClientSide(start: string, end: string): boolean {
  const current = getCurrentTimeClientSide();
  return current >= start && current < end;
}

/**
 * Check if a time slot is upcoming (after current time) (client-side only)
 */
function isUpcomingSlotClientSide(start: string): boolean {
  const current = getCurrentTimeClientSide();
  return start > current;
}

/**
 * Get minutes until a time slot (client-side only)
 */
function getMinutesUntilClientSide(start: string): number {
  const now = new Date();
  const [hours, minutes] = start.split(':').map(Number);
  const slotTime = new Date();
  slotTime.setHours(hours, minutes, 0, 0);
  const diff = slotTime.getTime() - now.getTime();
  return Math.floor(diff / 60000); // Convert to minutes
}

/**
 * Calculate completion percentage
 */
function calculateCompletion(activities: any[]): { completed: number; total: number; percentage: number } {
  const completed = activities.filter(a => a.completed).length;
  const total = activities.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}

/**
 * Format Google Calendar event time for display
 */
function formatEventTime(dateTime: string): string {
  try {
    // Parse ISO 8601 datetime string (e.g., "2026-03-18T09:30:00-04:00")
    const date = new Date(dateTime);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    return `${hours12}:${minutesStr} ${ampm}`;
  } catch (error) {
    console.warn('Failed to parse event time:', dateTime, error);
    return '';
  }
}

/**
 * Get color-coded class based on activity type/color
 */
function getBlockTypeClass(activity: any): string {
  const color = activity.color || '#ffffff';
  const colorMap: Record<string, string> = {
    '#c8e6c9': 'block-routine',      // Green - Routine
    '#fff9c4': 'block-meal',         // Yellow - Meal
    '#bbdefb': 'block-personal',     // Blue - Personal
    '#d1c4e9': 'block-work',         // Purple - Work
    '#ffe0b2': 'block-family',       // Orange - Family
    '#b2dfdb': 'block-school',       // Teal - School
    '#f8bbd0': 'block-activity',     // Pink - Activity
    '#f0f0f0': 'block-break',        // Gray - Break
  };
  return colorMap[color] || 'block-other';
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

  // Calculate completion stats
  const completion = calculateCompletion(schedule.activities);

  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: 'Nunito', 'Segoe UI', Arial, sans-serif;
        font-size: 11pt;
        line-height: 1.4;
        padding: 0.3in;
        max-width: 8in;
        margin: 0 auto;
        background: white;
      }

      /* Header */
      .header {
        text-align: center;
        border-bottom: 3px solid #ff9f74;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      .header h1 {
        font-size: 20pt;
        color: #ff9f74;
        margin-bottom: 4px;
        font-weight: 700;
      }
      .header .date {
        font-size: 12pt;
        color: #666;
        font-weight: 500;
      }

      /* Progress Bar */
      .progress-section {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 12px 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        color: white;
      }
      .progress-bar-container {
        background: rgba(255,255,255,0.3);
        height: 24px;
        border-radius: 12px;
        overflow: hidden;
        margin-top: 8px;
      }
      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4ade80 0%, #22c55e 100%);
        border-radius: 12px;
        transition: width 0.5s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 11pt;
        color: white;
      }
      .progress-text {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
      }

      /* Next Up Section */
      .next-up {
        background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
        padding: 12px 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        border-left: 5px solid #f39c12;
      }
      .next-up h3 {
        font-size: 13pt;
        color: #2d3436;
        margin-bottom: 6px;
        font-weight: 700;
      }
      .next-up-content {
        font-size: 12pt;
        color: #2d3436;
        font-weight: 600;
      }

      /* Calendar Events Section */
      .calendar-events {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        padding: 12px 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        border-left: 5px solid #2196f3;
      }
      .calendar-events h3 {
        font-size: 13pt;
        color: #0d47a1;
        margin-bottom: 8px;
        font-weight: 700;
      }
      .calendar-event {
        background: rgba(255, 255, 255, 0.7);
        padding: 8px 12px;
        margin-bottom: 6px;
        border-radius: 6px;
        font-size: 11pt;
      }
      .calendar-event:last-child {
        margin-bottom: 0;
      }
      .calendar-event-time {
        font-weight: 700;
        color: #1976d2;
        display: inline-block;
        min-width: 100px;
      }
      .calendar-event-title {
        color: #0d47a1;
        font-weight: 600;
      }
      .calendar-event-location {
        color: #424242;
        font-size: 10pt;
        font-style: italic;
      }

      /* Meal Planning Section */
      .meal-planning {
        background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
        padding: 12px 20px;
        border-radius: 12px;
        margin-bottom: 16px;
        border-left: 5px solid #ff9800;
      }
      .meal-planning h3 {
        font-size: 13pt;
        color: #e65100;
        margin-bottom: 8px;
        font-weight: 700;
      }
      .meal-section {
        margin-bottom: 12px;
      }
      .meal-section:last-child {
        margin-bottom: 0;
      }
      .meal-section-title {
        font-size: 11pt;
        font-weight: 700;
        color: #e65100;
        margin-bottom: 4px;
      }
      .meal-item {
        background: rgba(255, 255, 255, 0.7);
        padding: 6px 10px;
        margin-bottom: 4px;
        border-radius: 6px;
        font-size: 10pt;
      }
      .meal-item:last-child {
        margin-bottom: 0;
      }
      .meal-name {
        font-weight: 600;
        color: #424242;
      }
      .meal-calories {
        color: #1976d2;
        font-size: 9pt;
        font-weight: 600;
      }
      .meal-macros {
        color: #666;
        font-size: 8pt;
      }
      .calorie-tracker {
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        padding: 10px 16px;
        border-radius: 10px;
        margin-bottom: 12px;
        border-left: 4px solid #4caf50;
      }
      .calorie-tracker h4 {
        font-size: 11pt;
        color: #1b5e20;
        margin-bottom: 6px;
        font-weight: 700;
      }
      .calorie-stats {
        display: flex;
        gap: 12px;
        font-size: 10pt;
      }
      .calorie-stat {
        background: rgba(255, 255, 255, 0.8);
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
      }
      .calorie-stat.target {
        color: #2e7d32;
      }
      .calorie-stat.consumed {
        color: #1565c0;
      }
      .calorie-stat.remaining {
        color: #c62828;
      }

      /* Table */
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        border-radius: 8px;
        overflow: hidden;
      }
      th {
        background: linear-gradient(135deg, #ff9f74 0%, #ffcf87 100%);
        color: white;
        padding: 8px 6px;
        text-align: center;
        font-size: 10pt;
        font-weight: 700;
        text-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      td {
        padding: 6px 8px;
        border-bottom: 1px solid #e0e0e0;
        font-size: 11pt;
        text-align: center;
        vertical-align: middle;
        width: 22%;
        font-weight: 500;
      }
      .time-col {
        font-weight: 700;
        color: #ff9f74;
        width: 65px;
        text-align: center;
        vertical-align: middle;
        font-size: 10pt;
      }

      /* Current Time Row - Pulse Animation */
      tr.current-time {
        background: linear-gradient(90deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 107, 107, 0.25) 50%, rgba(255, 107, 107, 0.15) 100%);
        animation: pulse 2s ease-in-out infinite;
        border-left: 4px solid #ff6b6b;
        border-right: 4px solid #ff6b6b;
      }
      @keyframes pulse {
        0%, 100% { background: linear-gradient(90deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 107, 107, 0.25) 50%, rgba(255, 107, 107, 0.15) 100%); }
        50% { background: linear-gradient(90deg, rgba(255, 107, 107, 0.25) 0%, rgba(255, 107, 107, 0.35) 50%, rgba(255, 107, 107, 0.25) 100%); }
      }
      tr.current-time td {
        font-weight: 600;
      }
      .current-indicator {
        display: inline-block;
        background: #ff6b6b;
        color: white;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 8pt;
        font-weight: 700;
        margin-left: 6px;
        animation: glow 1.5s ease-in-out infinite;
      }
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 5px rgba(255, 107, 107, 0.5); }
        50% { box-shadow: 0 0 15px rgba(255, 107, 107, 0.8); }
      }

      /* Color-Coded Block Types */
      .block-routine { background: #c8e6c9 !important; color: #1b5e20 !important; }
      .block-meal { background: #fff9c4 !important; color: #f57f17 !important; }
      .block-personal { background: #bbdefb !important; color: #0d47a1 !important; }
      .block-work { background: #d1c4e9 !important; color: #4a148c !important; }
      .block-family { background: #ffe0b2 !important; color: #e65100 !important; }
      .block-school { background: #b2dfdb !important; color: #004d40 !important; }
      .block-activity { background: #f8bbd0 !important; color: #880e4f !important; }
      .block-break { background: #f0f0f0 !important; color: #424242 !important; }
      .block-other { background: #ffffff !important; color: #212121 !important; border: 1px solid #e0e0e0 !important; }

      /* Striped rows */
      tr:nth-child(even):not(.current-time) {
        background: #f9f9f9;
      }

      /* Completed activities */
      .completed {
        text-decoration: line-through;
        opacity: 0.5;
      }

      /* Legend */
      .legend {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 2px solid #ff9f74;
      }
      .legend h3 {
        font-size: 13pt;
        margin-bottom: 12px;
        color: #2d3436;
        font-weight: 700;
      }
      .legend-items {
        display: flex;
        flex-wrap: wrap;
        gap: 18px;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10pt;
        font-weight: 500;
      }
      .legend-color {
        display: inline-block;
        width: 18px;
        height: 18px;
        border-radius: 3px;
        border: 1px solid rgba(0,0,0,0.1);
      }

      /* Quick Actions */
      .quick-actions {
        margin-top: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .quick-action-btn {
        display: inline-block;
        padding: 8px 16px;
        margin: 4px;
        border: none;
        border-radius: 6px;
        font-size: 10pt;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-complete { background: #22c55e; color: white; }
      .btn-late { background: #f59e0b; color: white; }
      .btn-copy { background: #3b82f6; color: white; }
      .quick-action-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
      }

      /* Mobile Optimization */
      @media (max-width: 768px) {
        body {
          font-size: 12pt;
          padding: 0.2in;
        }
        .header h1 {
          font-size: 18pt;
        }
        td {
          font-size: 11pt;
          padding: 8px 6px;
        }
        .time-col {
          font-size: 10pt;
          width: 55px;
        }
        th {
          font-size: 9pt;
          padding: 6px 4px;
        }
        .progress-section, .next-up {
          padding: 10px 14px;
        }
      }

      @media print {
        body {
          padding: 0.25in;
          font-size: 10pt;
        }
        .header h1 {
          font-size: 16pt;
        }
        .quick-actions {
          display: none;
        }
        tr.current-time {
          animation: none;
        }
      }
    </style>
  `;

  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Grid - ${schedule.date}</title>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
        ${styles}
      </head>
      <body>
        <div class="header">
          <h1>Daily Grid - ${getDayName(schedule.date)}</h1>
          <p class="date">${formatDate(schedule.date)}</p>
        </div>

        <!-- Progress Bar -->
        <div class="progress-section">
          <div class="progress-text">
            <span>Today's Progress</span>
            <span>${completion.completed} of ${completion.total} blocks complete</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${completion.percentage}%">${completion.percentage}%</div>
          </div>
        </div>

        <!-- Next Up Section (populated by JavaScript) -->
        <div class="next-up" id="nextUpSection" style="display: none;">
          <h3>⏰ Next Up</h3>
          <div class="next-up-content" id="nextUpContent"></div>
        </div>

        <!-- Calendar Events Section -->
        ${schedule.calendarEvents && schedule.calendarEvents.length > 0 ? `
        <div class="calendar-events">
          <h3>📅 Calendar Events</h3>
          ${schedule.calendarEvents.map((event: any) => {
            const eventTime = formatEventTime(event.start);
            const eventEndTime = formatEventTime(event.end);
            return `
              <div class="calendar-event">
                <span class="calendar-event-time">${eventTime}${eventEndTime !== eventTime ? ' - ' + eventEndTime : ''}</span>
                <span class="calendar-event-title">${event.summary || 'No title'}</span>
                ${event.location ? `<span class="calendar-event-location"> @ ${event.location}</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

        <!-- Meal Planning Section -->
        ${schedule.meals && schedule.meals.length > 0 ? `
        <div class="meal-planning">
          <h3>🍽️ Meal Plan</h3>

          ${schedule.calorieSummary ? `
          <div class="calorie-tracker">
            <h4>Jason's Calories</h4>
            <div class="calorie-stats">
              <span class="calorie-stat target">Target: ${schedule.calorieSummary.targetCalories}</span>
              <span class="calorie-stat consumed">Consumed: ${schedule.calorieSummary.totalConsumed}</span>
              <span class="calorie-stat remaining">Remaining: ${schedule.calorieSummary.targetCalories - schedule.calorieSummary.totalConsumed}</span>
            </div>
          </div>
          ` : ''}

          ${['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => {
            const mealsForType = schedule.meals!.filter((m: any) => m.mealType === mealType);
            if (mealsForType.length === 0) return '';

            const mealIcons: Record<string, string> = {
              breakfast: '🌅',
              lunch: '☀️',
              dinner: '🌙',
              snack: '🍎'
            };

            return `
              <div class="meal-section">
                <div class="meal-section-title">${mealIcons[mealType] || '🍽️'} ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</div>
                ${mealsForType.map((meal: any) => `
                  <div class="meal-item">
                    <span class="meal-name">${meal.name}</span>
                    ${meal.calories ? `<span class="meal-calories"> | ${meal.calories} cal</span>` : ''}
                    ${meal.protein ? `<span class="meal-macros"> (P: ${meal.protein}g, C: ${meal.carbs}g, F: ${meal.fat}g)</span>` : ''}
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

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
            <tr data-start="${start}" data-end="${end}" data-time-key="${timeKey}">
              <td class="time-col">${start12} - ${end12}<span class="current-indicator" style="display: none;">NOW</span></td>
    `;

    for (const person of people) {
      const activity = personActivities.get(person);
      if (activity) {
        const blockClass = getBlockTypeClass(activity);
        const completedClass = activity.completed ? 'completed' : '';

        html += `<td class="${blockClass} ${completedClass}">${activity.title}</td>`;
      } else {
        html += `<td></td>`;
      }
    }
    html += `</tr>`;
  }

  html += `
          </tbody>
        </table>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <div style="text-align: center; margin-bottom: 8px; font-weight: 700; color: #2d3436;">Quick Actions</div>
          <div style="text-align: center;">
            <button class="quick-action-btn btn-complete" onclick="markCurrentComplete()">✓ Mark Current Complete</button>
            <button class="quick-action-btn btn-late" onclick="markRunningLate()">⏱ Running 15 Min Late</button>
            <button class="quick-action-btn btn-copy" onclick="copyToTomorrow()">📋 Copy to Tomorrow</button>
          </div>
        </div>

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

        <script>
          function markCurrentComplete() {
            alert('This feature would mark the current time block as complete.\\n\\n(Note: Full functionality requires database integration)');
          }

          function markRunningLate() {
            alert('This feature would shift all remaining blocks by 15 minutes.\\n\\n(Note: Full functionality requires database integration)');
          }

          function copyToTomorrow() {
            alert('This feature would copy today\\'s schedule to tomorrow.\\n\\n(Note: Full functionality requires database integration)');
          }

          // Client-side timezone-aware current time detection
          function getCurrentTime() {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            return \`\${hours}:\${minutes}\`;
          }

          function getMinutesUntil(timeStr) {
            const now = new Date();
            const [hours, minutes] = timeStr.split(':').map(Number);
            const slotTime = new Date();
            slotTime.setHours(hours, minutes, 0, 0);
            const diff = slotTime.getTime() - now.getTime();
            return Math.floor(diff / 60000);
          }

          function formatTime12(timeStr) {
            const [hours, minutes] = timeStr.split(':');
            const h = parseInt(hours, 10);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return \`\${h12}:\${minutes} \${ampm}\`;
          }

          // Highlight current time slot and show next up
          window.addEventListener('load', function() {
            const currentTime = getCurrentTime();
            const rows = Array.from(document.querySelectorAll('tbody tr[data-time-key]'));
            let currentRow = null;
            let nextRow = null;

            // Find current and next rows
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const start = row.getAttribute('data-start');
              const end = row.getAttribute('data-end');

              if (currentTime >= start && currentTime < end) {
                currentRow = row;
                if (i + 1 < rows.length) {
                  nextRow = rows[i + 1];
                }
                break;
              }
            }

            // Highlight current row
            if (currentRow) {
              currentRow.classList.add('current-time');
              const indicator = currentRow.querySelector('.current-indicator');
              if (indicator) {
                indicator.style.display = 'inline-block';
              }
              // Auto-scroll to current row
              currentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            // Show next up section
            if (nextRow) {
              const nextStart = nextRow.getAttribute('data-start');
              const nextEnd = nextRow.getAttribute('data-end');
              const nextStart12 = formatTime12(nextStart).replace(':00', '');
              const nextEnd12 = formatTime12(nextEnd).replace(':00', '');
              const minutesUntil = getMinutesUntil(nextStart);

              // Get activity title from first non-empty cell
              const cells = nextRow.querySelectorAll('td:not(.time-col)');
              let activityTitle = 'Free time';
              for (const cell of cells) {
                if (cell.textContent && cell.textContent.trim()) {
                  activityTitle = cell.textContent.trim();
                  break;
                }
              }

              const nextUpContent = document.getElementById('nextUpContent');
              const nextUpSection = document.getElementById('nextUpSection');

              if (nextUpContent && nextUpSection) {
                nextUpContent.textContent = \`\${activityTitle} (\${nextStart12} - \${nextEnd12})\${minutesUntil > 0 ? \` - in \${minutesUntil} minutes\` : ' - starting soon!'}\`;
                nextUpSection.style.display = 'block';
              }
            }
          });
        </script>
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
