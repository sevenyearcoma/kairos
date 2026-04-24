import React, { useEffect, useRef, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { $isGoogleConnected, $language, $prefs } from '../stores/app';
import { syncGoogleData, initTransientState } from '../stores/app';
import BottomNav from './BottomNav';
import Header from './Header';
import { getT } from '../translations';

declare const google: any;
const GOOGLE_CLIENT_ID = "1069276372995-f4l3c28vafgmikmjm5ng0ucrh0epv4ms.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks";

interface AppLayoutProps {
  currentPath: string;
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ currentPath, children }) => {
  const tokenClient = useRef<any>(null);
  const isGoogleConnected = useStore($isGoogleConnected);
  const language = useStore($language);
  const prefs = useStore($prefs);
  const t = useMemo(() => getT(language), [language]);

  useEffect(() => {
    initTransientState();

    const initGis = () => {
      if (typeof google !== 'undefined' && !tokenClient.current) {
        try {
          tokenClient.current = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_SCOPES,
            callback: (tokenResponse: any) => {
              if (tokenResponse?.access_token) {
                localStorage.setItem('kairos_google_token', tokenResponse.access_token);
                syncGoogleData(tokenResponse.access_token);
              }
            },
          });
        } catch (err) { console.error('GIS Init failed', err); }
      }
    };

    if (typeof google !== 'undefined') initGis();
    else {
      const script = document.querySelector('script[src*="gsi/client"]');
      if (script) script.addEventListener('load', initGis);
    }

    const token = localStorage.getItem('kairos_google_token');
    if (token) syncGoogleData(token);
  }, []);

  useEffect(() => {
    (window as any).__kairosRequestGoogleAuth = () => {
      if (tokenClient.current) tokenClient.current.requestAccessToken({ prompt: 'consent' });
    };
  });

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [prefs.theme]);

  const desktopNavItems = [
    { label: 'today', icon: 'calendar_today', path: '/tasks' },
    { label: 'capture', icon: 'mic', path: '/' },
    { label: 'focus', icon: 'timer', path: '/focus' },
    { label: 'calendar', icon: 'calendar_view_week', path: '/calendar' },
  ];

  return (
    <div className="paper-texture flex min-h-screen w-full justify-center bg-cream text-charcoal overflow-hidden transition-colors duration-400 md:block">
      <main className="relative flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-cream shadow-[0_30px_90px_rgba(52,43,34,0.18)] transition-colors duration-400 md:h-screen md:max-w-none md:rounded-none md:shadow-none">
        <aside className="hidden fixed left-0 top-0 z-40 h-screen w-64 border-r border-paper-edge/70 bg-cream px-6 py-8 md:flex md:flex-col">
          <div className="mb-12 px-2">
            <p className="font-display text-2xl font-medium leading-none text-sage-deep">kairos</p>
            <p className="mt-2 font-display text-lg font-medium leading-none text-muted-ink">breathe and begin</p>
          </div>

          <nav className="flex-1 space-y-2">
            {desktopNavItems.map((item) => {
              const active = currentPath === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`group flex items-center gap-4 rounded-lg px-4 py-3 text-lg transition duration-500 ${
                    active ? 'border-r-2 border-primary/70 text-sage-deep' : 'text-muted-ink hover:bg-beige-soft/45'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[21px]"
                    style={{ fontVariationSettings: `'FILL' ${active ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}
                  >
                    {item.icon}
                  </span>
                  <span className="font-display font-medium">{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="mt-auto flex items-center gap-3 px-2">
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-paper-edge text-sage-deep">
              <span className="material-symbols-outlined text-[21px]">person</span>
            </div>
            <div>
              <p className="text-sm font-medium text-charcoal">{prefs.userName.toLowerCase()}</p>
              <p className="text-xs text-muted-ink">{isGoogleConnected ? t.calendar.linked : 'quiet mode on'}</p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col overflow-hidden md:ml-64 md:h-screen">
        <Header currentPath={currentPath} />
        <div className="flex-1 overflow-y-auto px-4 pb-28 pt-3 scrollbar-hide md:px-12 md:pb-20 md:pt-10">
          <div className="mx-auto h-full max-w-[390px] md:max-w-none">
            {children}
          </div>
        </div>
        <BottomNav currentPath={currentPath} />
        </section>
      </main>
    </div>
  );
};

export default AppLayout;
