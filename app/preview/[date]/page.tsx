'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Schedule } from '@/lib/types';
import { downloadPDF } from '@/lib/pdf';

export default function PreviewPage({ params }: { params: Promise<{ date: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
  }, [resolvedParams.date]);

  async function loadSchedule() {
    try {
      const res = await fetch(`/api/schedules/${resolvedParams.date}`);
      if (res.ok) {
        const data = await res.json();
        const scheduleData = data.schedule;
        setSchedule(scheduleData);

        // Generate HTML preview
        const htmlRes = await fetch('/api/generate/html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schedule: scheduleData })
        });

        if (htmlRes.ok) {
          const html = await htmlRes.text();
          setHtmlContent(html);
        }
      } else {
        throw new Error('Schedule not found');
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!schedule) return;
    try {
      await downloadPDF(schedule);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  }

  function handlePrint() {
    // Open print dialog directly - uses the same HTML as preview
    window.print();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-800">Loading...</div>
      </div>
    );
  }

  if (!schedule || !htmlContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Failed to load schedule</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white shadow-sm sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <Link href={`/editor/${schedule.date}`} className="text-blue-600 hover:text-blue-700">
                ← Back to Editor
              </Link>
              <h1 className="text-xl font-bold text-gray-900 mt-1">
                {schedule.date} - {schedule.dayName}
              </h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
              >
                Print
              </button>
              <button
                onClick={handleDownloadPDF}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="max-w-4xl mx-auto p-8 print-container">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <iframe
            srcDoc={htmlContent}
            className="w-full"
            style={{ height: 'calc(100vh - 200px)', border: 'none' }}
            title="Schedule Preview"
          />
        </div>
      </div>
    </div>
  );
}
