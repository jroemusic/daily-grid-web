// lib/shiftCascade.ts

import { Activity } from './types';
import { timeToMinutes, minutesToTime } from './time';

const DAY_START = '07:00';
const DAY_END = '22:00';

export function shiftActivitiesFrom(
  activities: Activity[],
  person: string,
  fromTime: string,
  shiftMinutes: number
): Activity[] {
  const fromMin = timeToMinutes(fromTime);
  const dayStartMin = timeToMinutes(DAY_START);
  const dayEndMin = timeToMinutes(DAY_END);

  return activities.map(activity => {
    if (!activity.people.includes(person)) return activity;
    const actStartMin = timeToMinutes(activity.start);
    if (actStartMin < fromMin) return activity;

    const duration = timeToMinutes(activity.end) - actStartMin;
    let newStart = actStartMin + shiftMinutes;
    let newEnd = newStart + duration;

    newStart = Math.max(dayStartMin, Math.min(dayEndMin - duration, newStart));
    newEnd = newStart + duration;

    return {
      ...activity,
      start: minutesToTime(newStart),
      end: minutesToTime(newEnd),
    };
  });
}

export function shiftSingleActivity(
  activities: Activity[],
  activityId: string,
  shiftMinutes: number
): Activity[] {
  const dayStartMin = timeToMinutes(DAY_START);
  const dayEndMin = timeToMinutes(DAY_END);

  return activities.map(activity => {
    if (activity.id !== activityId) return activity;

    const duration = timeToMinutes(activity.end) - timeToMinutes(activity.start);
    let newStart = timeToMinutes(activity.start) + shiftMinutes;
    let newEnd = newStart + duration;

    newStart = Math.max(dayStartMin, Math.min(dayEndMin - duration, newStart));
    newEnd = newStart + duration;

    return {
      ...activity,
      start: minutesToTime(newStart),
      end: minutesToTime(newEnd),
    };
  });
}

export function countAffectedActivities(
  activities: Activity[],
  person: string,
  fromTime: string
): number {
  const fromMin = timeToMinutes(fromTime);
  return activities.filter(
    a => a.people.includes(person) && timeToMinutes(a.start) >= fromMin
  ).length;
}

export function swapActivityTimes(
  activities: Activity[],
  sourceId: string,
  targetId: string
): Activity[] {
  const source = activities.find(a => a.id === sourceId);
  const target = activities.find(a => a.id === targetId);
  if (!source || !target) return activities;

  return activities.map(a => {
    if (a.id === sourceId) {
      return { ...a, start: target.start, end: target.end };
    }
    if (a.id === targetId) {
      return { ...a, start: source.start, end: source.end };
    }
    return a;
  });
}

export function moveOrSwapActivity(
  activities: Activity[],
  sourceId: string,
  newStart: string,
  newEnd: string
): Activity[] {
  const source = activities.find(a => a.id === sourceId);
  if (!source) return activities;

  const targetOccupier = activities.find(a =>
    a.id !== sourceId &&
    a.start === newStart &&
    a.people.some(p => source.people.includes(p))
  );

  if (targetOccupier) {
    return activities.map(a => {
      if (a.id === sourceId) return { ...a, start: newStart, end: newEnd };
      if (a.id === targetOccupier.id) return { ...a, start: source.start, end: source.end };
      return a;
    });
  }

  return activities.map(a => {
    if (a.id === sourceId) return { ...a, start: newStart, end: newEnd };
    return a;
  });
}
