export type ThemeName = 'light' | 'dark';

export interface Palette {
  paper: string;
  paperDeep: string;
  ink: string;
  muted: string;
  mutedStrong: string;
  faint: string;
  card: string;
  surface: string;
  surfaceSoft: string;
  surfaceStrong: string;
  sage: string;
  sageText: string;
  sageSoft: string;
  sageBorder: string;
  sageFill1: string;
  sageFill2: string;
  sageFill3: string;
  clayActive: string;
  clay: string;
  amber: string;
  orb: string;
  backdrop: string;
}

export const lightColors: Palette = {
  paper: '#f8f1e8',
  paperDeep: '#eee6da',
  ink: '#17130f',
  muted: 'rgba(23, 19, 15, 0.48)',
  mutedStrong: 'rgba(23, 19, 15, 0.56)',
  faint: 'rgba(23, 19, 15, 0.08)',
  card: 'rgba(255, 255, 255, 0.64)',
  surface: 'rgba(255, 255, 255, 0.42)',
  surfaceSoft: 'rgba(234, 227, 214, 0.55)',
  surfaceStrong: 'rgba(255, 255, 255, 0.55)',
  sage: '#91aa96',
  sageText: '#506b58',
  sageSoft: 'rgba(145, 170, 150, 0.22)',
  sageBorder: 'rgba(80, 107, 88, 0.14)',
  sageFill1: 'rgba(145, 170, 150, 0.16)',
  sageFill2: 'rgba(145, 170, 150, 0.25)',
  sageFill3: 'rgba(145, 170, 150, 0.35)',
  clayActive: 'rgba(200, 105, 94, 0.42)',
  clay: '#c8695e',
  amber: '#d9b38b',
  orb: '#c8c3bb',
  backdrop: 'rgba(23, 19, 15, 0.35)',
};

export const darkColors: Palette = {
  paper: '#1f1b17',
  paperDeep: '#17130f',
  ink: '#e8e2d5',
  muted: 'rgba(232, 226, 213, 0.48)',
  mutedStrong: 'rgba(232, 226, 213, 0.62)',
  faint: 'rgba(232, 226, 213, 0.1)',
  card: 'rgba(255, 255, 255, 0.05)',
  surface: 'rgba(255, 255, 255, 0.04)',
  surfaceSoft: 'rgba(255, 255, 255, 0.06)',
  surfaceStrong: 'rgba(255, 255, 255, 0.08)',
  sage: '#8fb39e',
  sageText: '#a9c8b5',
  sageSoft: 'rgba(143, 179, 158, 0.18)',
  sageBorder: 'rgba(143, 179, 158, 0.18)',
  sageFill1: 'rgba(143, 179, 158, 0.14)',
  sageFill2: 'rgba(143, 179, 158, 0.22)',
  sageFill3: 'rgba(143, 179, 158, 0.32)',
  clayActive: 'rgba(212, 138, 127, 0.34)',
  clay: '#d48a7f',
  amber: '#d9b38b',
  orb: '#2a2622',
  backdrop: 'rgba(0, 0, 0, 0.55)',
};

export const colors = lightColors;

export const radii = {
  card: 18,
  pill: 999,
};

export const shadow = {
  shadowColor: '#342b22',
  shadowOpacity: 0.08,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 12 },
  elevation: 4,
};
