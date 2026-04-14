'use client';

import { useState, useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  PEOPLE,
  DEMO_SLOTS,
  PERSON_COLORS,
  getMockActivities,
  type DemoActivity,
  getActivityColor,
  getTypeTextColor,
  formatSlot,
} from '@/components/dnd-demo/demo-data';

export default function Demo2HelloPangea() {
  const [activities, setActivities] = useState<DemoActivity[]>(getMockActivities);
  const [moves, setMoves] = useState(0);

  const getActivity = (person: string, time: string): DemoActivity | undefined =>
    activities.find((a) => a.person === person && a.start === time);

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const [srcPerson, srcTime] = source.droppableId.split('-');
    const [destPerson, destTime] = destination.droppableId.split('-');

    const srcActivity = activities.find(
      (a) => a.person === srcPerson && a.start === srcTime,
    );
    const destActivity = activities.find(
      (a) => a.person === destPerson && a.start === destTime,
    );

    if (!srcActivity) return;

    setActivities((prev) => {
      const next = prev.map((a) => {
        // Move source activity to destination slot
        if (a.id === srcActivity.id) {
          return { ...a, person: destPerson, start: destTime, end: destTime.replace(/^\d+/, (m) => String(parseInt(m) + 1)) };
        }
        // Swap: move destination activity to source slot
        if (destActivity && a.id === destActivity.id) {
          return { ...a, person: srcPerson, start: srcTime, end: srcTime.replace(/^\d+/, (m) => String(parseInt(m) + 1)) };
        }
        return a;
      });
      return next;
    });

    setMoves((m) => m + 1);
  }, [activities]);

  const handleReset = () => {
    setActivities(getMockActivities());
    setMoves(0);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 0 2rem' }}>
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          color: 'white',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
            Demo 2: @hello-pangea/dnd (Library)
          </h1>
          <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.85, marginTop: '0.2rem' }}>
            Long-press to drag on touch &middot; Drop on occupied cell to swap
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '0.4rem 0.9rem',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            Moves: {moves}
          </span>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: 'white',
              padding: '0.4rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              minHeight: 44,
              minWidth: 80,
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          padding: '0.75rem',
        }}
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 3,
              tableLayout: 'fixed',
              minWidth: 600,
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 3,
                    background: '#f8fafc',
                    padding: '0.6rem 0.4rem',
                    width: 60,
                    minWidth: 60,
                  }}
                />
                {PEOPLE.map((person) => (
                  <th
                    key={person}
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 3,
                      background: PERSON_COLORS[person].bg,
                      color: PERSON_COLORS[person].border,
                      padding: '0.7rem 0.4rem',
                      borderRadius: '0.5rem 0.5rem 0 0',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      textAlign: 'center',
                      borderBottom: `3px solid ${PERSON_COLORS[person].border}`,
                    }}
                  >
                    {person}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_SLOTS.map((time) => (
                <tr key={time}>
                  {/* Time label */}
                  <td
                    style={{
                      padding: '0.5rem 0.3rem',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: '#64748b',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      width: 60,
                      minWidth: 60,
                    }}
                  >
                    {formatSlot(time)}
                  </td>
                  {/* Person columns */}
                  {PEOPLE.map((person) => {
                    const droppableId = `${person}-${time}`;
                    const activity = getActivity(person, time);

                    return (
                      <td
                        key={droppableId}
                        style={{
                          padding: 0,
                          border: 'none',
                          verticalAlign: 'top',
                        }}
                      >
                        <Droppable droppableId={droppableId} type="ACTIVITY">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              style={{
                                minHeight: 64,
                                borderRadius: '0.5rem',
                                background: snapshot.isDraggingOver
                                  ? '#eff6ff'
                                  : activity
                                    ? 'white'
                                    : '#f1f5f9',
                                border: snapshot.isDraggingOver
                                  ? '2px dashed #3b82f6'
                                  : '1px solid #e2e8f0',
                                transition: 'background 0.15s, border 0.15s',
                                position: 'relative',
                              }}
                            >
                              {activity ? (
                                <Draggable
                                  draggableId={activity.id}
                                  index={0}
                                >
                                  {(dragProvided, dragSnapshot) => {
                                    const dragStyle = dragProvided.draggableProps.style as React.CSSProperties | undefined;
                                    const isFixed = dragStyle?.position === 'fixed';
                                    return (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        style={{
                                          ...dragStyle,
                                          ...(isFixed
                                            ? {
                                                width: (dragStyle as React.CSSProperties).width,
                                                height: (dragStyle as React.CSSProperties).height,
                                                zIndex: 9999,
                                                opacity: 0.9,
                                                boxShadow: '0 8px 25px rgba(0,0,0,0.18)',
                                                borderRadius: '0.5rem',
                                              }
                                            : {}),
                                          background: getActivityColor(activity.type),
                                          borderLeft: `4px solid ${PERSON_COLORS[person].border}`,
                                          borderRadius: '0.4rem',
                                          padding: '0.55rem 0.65rem',
                                          margin: 3,
                                          minHeight: 52,
                                          display: 'flex',
                                          alignItems: 'center',
                                          cursor: 'grab',
                                          userSelect: 'none',
                                          WebkitUserSelect: 'none',
                                          opacity:
                                            dragSnapshot.isDragging && !dragSnapshot.draggingOver
                                              ? 0.5
                                              : 1,
                                        }}
                                      >
                                        <div style={{ flex: 1 }}>
                                          <div
                                            style={{
                                              fontSize: '0.85rem',
                                              fontWeight: 600,
                                              color: getTypeTextColor(activity.type),
                                              lineHeight: 1.2,
                                            }}
                                          >
                                            {activity.title}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '0.7rem',
                                              color: '#64748b',
                                              marginTop: 2,
                                            }}
                                          >
                                            {activity.type}
                                          </div>
                                        </div>
                                        {/* Touch grip indicator */}
                                        <div
                                          style={{
                                            color: '#94a3b8',
                                            fontSize: '1.1rem',
                                            lineHeight: 1,
                                            padding: '0 0.15rem',
                                          }}
                                        >
                                          &#8942;
                                        </div>
                                      </div>
                                    );
                                  }}
                                </Draggable>
                              ) : (
                                <div
                                  style={{
                                    color: '#cbd5e1',
                                    fontSize: '1.4rem',
                                    fontWeight: 300,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 64,
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                  }}
                                >
                                  +
                                </div>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </DragDropContext>
      </div>
    </div>
  );
}
