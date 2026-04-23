import React, { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $prefs, $language, syncGoogleData, initTransientState } from '../stores/app';
import { getT } from '../translations';
import BottomNav from './BottomNav';
import Header from './Header';

declare const google: any;
const GOOGLE_CLIENT_ID = "1069276372995-f4l3c28vafgmikmjm5ng0ucrh0epv4ms.apps.googleusercontent.com";
const GOOGLE_SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/tasks";

interface AppLayoutProps {
  currentPath: string;
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ currentPath, children }) => {
  const prefs = useStore($prefs);
  const language = useStore($language);
  const t = React.useMemo(() => getT(language), [language]);
  const tokenClient = useRef<any>(null);

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

  const navItems = [
    { label: t.nav.secretary, icon: 'chat_bubble', path: '/' },
    { label: t.nav.calendar, icon: 'calendar_today', path: '/calendar' },
    { label: t.nav.tasks, icon: 'task_alt', path: '/tasks' },
    { label: t.nav.focus, icon: 'target', path: '/focus' },
  ];

  return (
    <div className="flex h-screen w-full bg-cream text-charcoal overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 border-r border-charcoal/5 bg-white/50 sticky top-0 h-screen p-8 shrink-0 overflow-y-auto scrollbar-hide">
        <div className="flex items-center gap-3 mb-12">
          <div className="size-10 bg-charcoal rounded-xl flex items-center justify-center text-primary shadow-2xl">
            <span className="material-symbols-outlined text-xl">hourglass_empty</span>
          </div>
          <span className="font-display font-black text-2xl tracking-tighter uppercase">{prefs.assistantName}</span>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map(item => (
            <a
              key={item.path}
              href={item.path}
              className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[12px] font-extrabold uppercase tracking-widest transition-all ${
                currentPath === item.path
                  ? 'bg-charcoal text-cream shadow-xl'
                  : 'text-charcoal/40 hover:bg-charcoal/5 hover:text-charcoal'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col relative bg-white/30 h-[100dvh] overflow-hidden">
        <Header currentPath={currentPath} />
        <div className="flex-1 overflow-y-auto p-4 md:p-12 pb-32 md:pb-12 scrollbar-hide">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
        <BottomNav currentPath={currentPath} />
      </main>
    </div>
  );
};

export default AppLayout;
