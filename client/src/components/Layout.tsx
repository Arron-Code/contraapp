import {
  Bell, Building2, ChevronDown, CircleDollarSign, ClipboardCheck,
  FileStack, FileText, LayoutDashboard, LogOut, Menu, Search, Settings,
  Users, X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const nav = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard },
  { to: '/vertraege', label: 'Verträge', icon: FileText },
  { to: '/forderungen', label: 'Forderungen', icon: CircleDollarSign },
  { to: '/kontakte', label: 'Kontakte', icon: Building2 },
  { to: '/aufgaben', label: 'Aufgaben & Fristen', icon: ClipboardCheck },
  { to: '/dokumente', label: 'Dokumente', icon: FileStack },
  { to: '/team', label: 'Team & Audit', icon: Users },
  { to: '/einstellungen', label: 'Einstellungen', icon: Settings },
];

const titles: Record<string, [string, string]> = {
  '/': ['Guten Morgen', 'Hier ist der aktuelle Stand Ihrer Geschäfte.'],
  '/vertraege': ['Verträge', 'Alle Vereinbarungen, Laufzeiten und Fristen im Blick.'],
  '/forderungen': ['Forderungen', 'Offene Posten, Zahlungen und Mahnläufe verwalten.'],
  '/kontakte': ['Kontakte', 'Kunden, Lieferanten und Ansprechpartner zentral pflegen.'],
  '/aufgaben': ['Aufgaben & Fristen', 'Nichts verpassen und Verantwortlichkeiten klären.'],
  '/dokumente': ['Dokumente', 'Vertrags- und Forderungsunterlagen strukturiert ablegen.'],
  '/team': ['Team & Audit', 'Benutzer, Rollen und Änderungen nachvollziehen.'],
  '/einstellungen': ['Einstellungen', 'Mandant, Nummernkreise und Benachrichtigungen.'],
};

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Array<{ id: string; type: string; label: string }>>([]);
  const [title, subtitle] = titles[location.pathname] ?? titles['/']!;

  useEffect(() => {
    if (search.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api<Array<{ id: string; type: string; label: string }>>(`/dashboard/search?q=${encodeURIComponent(search)}`)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <div className="app-shell">
      <aside className={mobileOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">e</div>
          <div><strong>eriCargo</strong><span>Contract Suite</span></div>
          <button className="sidebar-close" onClick={() => setMobileOpen(false)}><X /></button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">NL</div>
          <div><strong>Nordstern Logistik</strong><span>Business Workspace</span></div>
          <ChevronDown size={16} />
        </div>
        <nav>
          <span className="nav-label">Arbeitsbereich</span>
          {nav.slice(0, 6).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)}>
              <Icon size={19} /><span>{label}</span>
              {label === 'Forderungen' && <em>5</em>}
            </NavLink>
          ))}
          <span className="nav-label second">Verwaltung</span>
          {nav.slice(6).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)}>
              <Icon size={19} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-avatar">{user?.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
          <div><strong>{user?.name}</strong><span>{user?.role}</span></div>
          <button onClick={logout} title="Abmelden"><LogOut size={17} /></button>
        </div>
      </aside>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileOpen(true)}><Menu /></button>
          <div className="search-wrap">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Verträge, Forderungen, Kontakte suchen..." />
            <kbd>⌘ K</kbd>
            {results.length > 0 && (
              <div className="search-results">
                {results.map((result) => <div key={result.id}><span>{result.type}</span>{result.label}</div>)}
              </div>
            )}
          </div>
          <button className="notification"><Bell size={19} /><span /></button>
        </header>
        <div className="page">
          <div className="page-heading">
            <div><span className="eyebrow">Freitag, 11. September 2026</span><h1>{title}{location.pathname === '/' ? `, ${user?.name.split(' ')[0]}!` : ''}</h1><p>{subtitle}</p></div>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
