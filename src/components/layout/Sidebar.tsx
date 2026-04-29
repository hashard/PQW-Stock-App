import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Settings } from 'lucide-react';

const links = [
  { to: '/',            label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/adjustments', label: 'Adjustments', icon: History },
  { to: '/settings',    label: 'Settings',    icon: Settings },
];

export function Sidebar() {
  return (
    <nav className="flex h-full flex-col bg-slate-900 dark:bg-slate-950 w-56 shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-4 border-b border-slate-700/50">
        <div className="rounded-lg bg-white px-3 py-2">
          <img
            src="/cropped-PQW-Logo-RGB_resized-150px.jpg.webp"
            alt="Pauline's Quilters World"
            className="h-10 w-auto object-contain"
          />
        </div>
      </div>

      {/* Nav links */}
      <ul className="flex-1 space-y-0.5 px-3 py-4">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => [
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="border-t border-slate-700/50 px-5 py-4">
        <p className="text-xs text-slate-500">v1.0 · PQW Internal</p>
      </div>
    </nav>
  );
}
