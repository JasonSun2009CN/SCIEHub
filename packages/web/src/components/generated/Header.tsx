import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  FaCloudUploadAlt,
  FaCog,
  FaComments,
  FaGraduationCap,
  FaMoon,
  FaSearch,
  FaShieldAlt,
  FaSignOutAlt,
  FaSun,
  FaUserCircle,
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/library', label: 'Library' },
  { to: '/community', label: 'Community' },
  { to: '/plaza', label: 'Plaza' },
  { to: '/groups', label: 'Groups' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

export function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/library?q=${encodeURIComponent(query.trim())}` : '/library');
  };

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="mx-auto flex max-w-7xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/80 shadow-soft backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-4">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow transition-transform duration-200 group-hover:-rotate-3">
              <FaGraduationCap className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-[17px] tracking-tight">
                SCIE<span className="text-accent">Hub</span>
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Study market
              </span>
            </span>
          </Link>

          <form onSubmit={onSearch} className="relative hidden flex-1 max-w-sm xl:block" role="search">
            <FaSearch
              className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, papers, subjects…"
              className="h-9 rounded-full border-border/70 bg-surface-2/50 pl-10"
              aria-label="Search"
            />
          </form>

          <nav className="ml-auto hidden items-center gap-0.5 lg:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors',
                    isActive
                      ? 'bg-accent-subtle text-accent'
                      : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 lg:ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="h-9 w-9"
            >
              {theme === 'dark' ? <FaSun className="h-4 w-4" /> : <FaMoon className="h-4 w-4" />}
            </Button>

            <Button
              variant="default"
              size="sm"
              className="hidden h-9 sm:inline-flex"
              onClick={() => navigate('/upload')}
            >
              <FaCloudUploadAlt className="h-4 w-4" aria-hidden />
              Publish
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => navigate('/upload')}
              aria-label="Publish a resource"
            >
              <FaCloudUploadAlt className="h-4 w-4" />
            </Button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="cursor-pointer rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Account menu"
                  >
                    <UserAvatar
                      nickname={user.nickname}
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/80 p-1.5 shadow-lift">
                  <DropdownMenuLabel>
                    <div className="font-semibold text-foreground">{user.nickname}</div>
                    <div className="text-xs font-normal text-muted-foreground">@{user.username}</div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <FaComments className="h-3 w-3 text-accent" />
                      Community member
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/users/${user.username}`)}>
                    <FaUserCircle className="h-4 w-4" /> Profile
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <FaCog className="h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  {user.isAdmin && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <FaShieldAlt className="h-4 w-4 text-warning" /> Admin console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout}>
                    <FaSignOutAlt className="h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" className="h-9" onClick={() => navigate('/auth')}>
                Sign in
              </Button>
            )}
          </div>
        </div>

        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-t border-border/60 px-3 py-1.5 lg:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-accent-subtle text-accent'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
