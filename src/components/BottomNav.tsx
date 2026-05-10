import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Dumbbell } from 'lucide-react';

const TABS = [
  { path: '/',         icon: Home,     label: 'Главная'   },
  { path: '/calendar', icon: Calendar, label: 'Календарь' },
  { path: '/programs', icon: Dumbbell, label: 'Программы' },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <nav className="bottom-nav" aria-label="Навигация">
      {TABS.map(({ path, icon: Icon, label }) => {
        const active = isActive(path);
        return (
          <Link
            key={path}
            to={path}
            className={`bottom-nav__tab${active ? ' bottom-nav__tab--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={20} strokeWidth={2} />
            {active && <span className="bottom-nav__label">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
