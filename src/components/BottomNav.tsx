import React, { useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { $language } from '../stores/app';
import { getT } from '../translations';

const BottomNav: React.FC<{ currentPath: string }> = ({ currentPath }) => {
  const language = useStore($language);
  const t = useMemo(() => getT(language), [language]);

  const navItems = [
    { label: t.nav.secretary, icon: 'chat_bubble', path: '/' },
    { label: t.nav.calendar, icon: 'calendar_today', path: '/calendar' },
    { label: t.nav.tasks, icon: 'task_alt', path: '/tasks' },
    { label: t.nav.focus, icon: 'target', path: '/focus' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-cream/80 backdrop-blur-xl border-t border-charcoal/5 px-6 flex justify-between items-center pb-6 z-50 md:hidden">
      {navItems.map((item) => {
        const isActive = currentPath === item.path;
        return (
          <a
            key={item.path}
            href={item.path}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative ${isActive ? 'text-charcoal' : 'text-charcoal/30'}`}
          >
            {isActive && <span className="absolute -top-3 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(17,212,180,0.8)]"></span>}
            <span
              className={`material-symbols-outlined text-[22px] transition-transform ${isActive ? 'scale-110' : ''}`}
              style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}` }}
            >
              {item.icon}
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-widest">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
};

export default BottomNav;
