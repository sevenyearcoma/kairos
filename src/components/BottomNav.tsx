import React from 'react';

const BottomNav: React.FC<{ currentPath: string }> = ({ currentPath }) => {
  const navItems = [
    { label: 'capture', icon: 'mic', path: '/' },
    { label: 'today', icon: 'trip_origin', path: '/tasks' },
    { label: 'calendar', icon: 'calendar_today', path: '/calendar' },
    { label: 'focus', icon: 'spa', path: '/focus' },
  ];

  return (
    <nav className="absolute bottom-5 left-1/2 z-50 flex h-16 w-[calc(100%-3rem)] max-w-[370px] -translate-x-1/2 items-center justify-around rounded-2xl border border-charcoal/[0.06] bg-cream/75 px-3 shadow-[0_12px_35px_rgba(52,43,34,0.09)] backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const isActive = currentPath === item.path;
        return (
          <a
            key={item.path}
            href={item.path}
            className={`relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition ${isActive ? 'text-sage-deep' : 'text-charcoal/42 hover:text-charcoal/70'}`}
          >
            {isActive && <span className="absolute top-1 size-1 rounded-full bg-primary" />}
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}
            >
              {item.icon}
            </span>
            <span className="text-[9px] leading-none">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
};

export default BottomNav;
