import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarItem, CaptureDraft, EnergyLevel, Task } from './types';
import type { ThemeName } from './theme';

const TASKS_KEY = 'kairos.mobile.tasks';
const ENERGY_KEY = 'kairos.mobile.energy';
const CAPTURE_DRAFTS_KEY = 'kairos.mobile.captureDrafts';
const CALENDAR_ITEMS_KEY = 'kairos.mobile.calendarItems';
const THEME_KEY = 'kairos.mobile.theme';
const RECENT_CAPTURES_KEY = 'kairos.mobile.recentCaptures';

export async function loadRecentCaptures(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(RECENT_CAPTURES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveRecentCaptures(entries: string[]) {
  await AsyncStorage.setItem(RECENT_CAPTURES_KEY, JSON.stringify(entries.slice(0, 8)));
}

export async function loadTheme(): Promise<ThemeName> {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  return raw === 'dark' ? 'dark' : 'light';
}

export async function saveTheme(theme: ThemeName) {
  await AsyncStorage.setItem(THEME_KEY, theme);
}

export async function loadTasks(fallback: Task[]): Promise<Task[]> {
  const raw = await AsyncStorage.getItem(TASKS_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveTasks(tasks: Task[]) {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function loadEnergy(): Promise<EnergyLevel | null> {
  const raw = await AsyncStorage.getItem(ENERGY_KEY);
  return raw === 'low' || raw === 'ok' || raw === 'sharp' ? raw : null;
}

export async function saveEnergy(energy: EnergyLevel | null) {
  if (!energy) {
    await AsyncStorage.removeItem(ENERGY_KEY);
    return;
  }
  await AsyncStorage.setItem(ENERGY_KEY, energy);
}

function isCaptureDraft(value: unknown): value is CaptureDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as CaptureDraft;
  return (
    typeof draft.id === 'string' &&
    (draft.kind === 'task' || draft.kind === 'event') &&
    typeof draft.label === 'string' &&
    typeof draft.title === 'string'
  );
}

export async function loadCaptureDrafts(fallback: CaptureDraft[]): Promise<CaptureDraft[]> {
  const raw = await AsyncStorage.getItem(CAPTURE_DRAFTS_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isCaptureDraft) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveCaptureDrafts(drafts: CaptureDraft[]) {
  await AsyncStorage.setItem(CAPTURE_DRAFTS_KEY, JSON.stringify(drafts));
}

function isCalendarItem(value: unknown): value is CalendarItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as CalendarItem;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.day === 'string' &&
    typeof item.time === 'string'
  );
}

export async function loadCalendarItems(fallback: CalendarItem[]): Promise<CalendarItem[]> {
  const raw = await AsyncStorage.getItem(CALENDAR_ITEMS_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every(isCalendarItem) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function saveCalendarItems(items: CalendarItem[]) {
  const localItems = items.filter((item) => item.source !== 'google');
  await AsyncStorage.setItem(CALENDAR_ITEMS_KEY, JSON.stringify(localItems));
}
