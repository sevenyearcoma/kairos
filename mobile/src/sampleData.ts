import type { CalendarItem, Task } from './types';

export const initialTasks: Task[] = [
  { id: 'rent', title: 'pay the rent', bucket: 'today', energy: 'low' },
  { id: 'thesis', title: 'write 2 sentences of thesis', bucket: 'today', energy: 'sharp', touched: true },
  { id: 'mom', title: 'call mom back', bucket: 'today', energy: 'ok' },
  { id: 'plant', title: 'water the plant (gentle)', bucket: 'today', energy: 'low' },
  { id: 'receipt', title: 'send receipt photo', bucket: 'later', energy: 'ok' },
];

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const seedDay = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dayKey(d);
};

export const calendarItems: CalendarItem[] = [
  { id: 'therapy', day: seedDay(1), time: '9:30', title: 'therapy' },
  { id: 'lunch', day: seedDay(1), time: '2:00', title: 'lunch with dad' },
  { id: 'review', day: seedDay(2), time: '11:00', title: 'weekly review' },
];
