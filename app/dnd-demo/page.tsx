'use client';

import Link from 'next/link';

export default function DndDemoIndex() {
  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-stone-800 mb-2">Drag & Drop Demos</h1>
        <p className="text-stone-500 text-sm mb-6">
          Test each approach on the touchscreen. Long-press an activity to start dragging.
          Drag to an empty cell to move, drag to an occupied cell to swap.
        </p>

        <div className="space-y-4">
          <Link
            href="/dnd-demo/demo1-pointer-events"
            className="block bg-white rounded-xl border-2 border-stone-200 p-5 hover:border-blue-400 hover:shadow-md transition-colors"
            style={{ minHeight: 100 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold">NO LIBRARY</span>
              <h2 className="text-lg font-bold text-stone-800">Demo 1: Custom Pointer Events</h2>
            </div>
            <p className="text-stone-500 text-sm">
              Native pointer events with setPointerCapture, long-press activation, ghost element, elementFromPoint.
              Zero dependencies. Full control over scroll/drag separation.
            </p>
          </Link>

          <Link
            href="/dnd-demo/demo2-hello-pangea"
            className="block bg-white rounded-xl border-2 border-stone-200 p-5 hover:border-green-400 hover:shadow-md transition-colors"
            style={{ minHeight: 100 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold">LIBRARY</span>
              <h2 className="text-lg font-bold text-stone-800">Demo 2: @hello-pangea/dnd</h2>
            </div>
            <p className="text-stone-500 text-sm">
              React 19 compatible library (fork of react-beautiful-dnd). Built-in touch sensor.
              DragDropContext + Droppable cells + Draggable activities.
            </p>
          </Link>
        </div>

        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <h3 className="font-semibold text-amber-800 text-sm mb-1">How to test</h3>
          <ul className="text-amber-700 text-xs space-y-1">
            <li>1. Open each demo on the touchscreen kiosk</li>
            <li>2. Long-press (hold ~300ms) an activity to start dragging</li>
            <li>3. Drag to an empty cell to move, or an occupied cell to swap</li>
            <li>4. Note: which feels smoother? Which is more reliable?</li>
          </ul>
        </div>

        <div className="mt-4">
          <Link href="/" className="text-sm text-stone-400 hover:text-stone-600">
            &larr; Back to Daily Grid
          </Link>
        </div>
      </div>
    </div>
  );
}
