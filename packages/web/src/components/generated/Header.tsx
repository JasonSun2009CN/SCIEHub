import { useState, type FormEvent } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  FaCloudUploadAlt,
  FaCog,
  FaGraduationCap,
  FaMoon,
  FaSearch,
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
  { to: '/feed', label: 'Feed' },
  { to: '/groups', label: 'Groups' },
];

export function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/feed?q=${encodeURIComponent(query.trim())}` : '/feed');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <FaGraduationCap className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden text-lg sm:block">
            SCIE<span className="text-accent">Hub</span>
          </span>
        </Link>

        <form onSubmit={onSearch} className="relative hidden flex-1 max-w-md md:block" role="search">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search resources, groups…"
            className="h-9 pl-9"
            aria-label="Search"
          />
        </form>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <FaSun className="h-4 w-4" /> : <FaMoon className="h-4 w-4" />}
          </Button>

          <Button variant="default" size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/upload')}>
            <FaCloudUploadAlt className="h-4 w-4" aria-hidden />
            Upload
          </Button>
          <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => navigate('/upload')} aria-label="Upload">
            <FaCloudUploadAlt className="h-4 w-4" />
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                  <UserAvatar nickname={user.nickname} username={user.username} avatarUrl={user.avatarUrl} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium text-foreground">{user.nickname}</div>
                  <div className="text-xs font-normal text-muted-foreground">@{user.username}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/users/${user.username}`)}>
                  <FaUserCircle className="h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <FaCog className="h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <FaSignOutAlt className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
