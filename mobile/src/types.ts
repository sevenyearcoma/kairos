export type ScreenKey = 'capture' | 'today' | 'calendar' | 'focus';
export type EnergyLevel = 'low' | 'ok' | 'sharp';

export interface Task {
  id: string;
  title: string;
  bucket: 'today' | 'later';
  energy?: EnergyLevel;
  touched?: boolean;
  completed?: boolean;
}

export interface CalendarItem {
  id: string;
  title: string;
  day: string;
  time: string;
  source?: 'local' | 'google';
}

export interface CaptureDraft {
  id: string;
  kind: 'task' | 'event';
  label: string;
  title: string;
  day?: string;
  time?: string;
  audioUri?: string;
  audioSeconds?: number;
}
