import { apiGet, apiPut } from './client';
import { UserPreferences, Language } from '../types';

interface BackendPrefs {
  theme?: string;
  language?: string;
  extra?: Record<string, any>;
}

export async function fetchPreferences(): Promise<{ prefs: UserPreferences; language: Language }> {
  const data = await apiGet<BackendPrefs>('/api/preferences');
  const extra = data.extra || {};
  return {
    language: (data.language as Language) || 'en',
    prefs: {
      userName: extra.userName || 'User',
      assistantName: extra.assistantName || 'Kairos',
      theme: (data.theme as UserPreferences['theme']) || 'cream',
      onboardingComplete: extra.onboardingComplete || false,
    },
  };
}

export async function savePreferences(prefs: UserPreferences, language: Language): Promise<void> {
  await apiPut('/api/preferences', {
    theme: prefs.theme,
    language,
    extra: {
      userName: prefs.userName,
      assistantName: prefs.assistantName,
      onboardingComplete: prefs.onboardingComplete,
    },
  });
}
