import { Link } from 'react-router-dom';
import { FaGithub, FaGraduationCap } from 'react-icons/fa';

const GITHUB_REPO = 'https://github.com/JasonSun2009CN/SCIEHub';

const PLATFORM_LINKS = [
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/orders', label: 'My orders' },
  { to: '/wallet', label: 'Wallet' },
  { to: '/groups', label: 'Groups' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/conduct', label: 'Community guidelines' },
  { to: '/upload', label: 'Upload & sell' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/60">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FaGraduationCap className="h-3.5 w-3.5" aria-hidden />
              </span>
              SCIE<span className="text-accent">Hub</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Share, Buy, Sell, Excel. A study-materials sharing & selling marketplace for international
              high schoolers.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">About</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><span className="text-muted-foreground">Built for students, by students.</span></li>
              <li><span className="text-muted-foreground">IB · AS/A-Level · AP · IGCSE</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Source</h3>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <FaGithub className="h-4 w-4" />
              Source on GitHub
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} SCIEHub. All rights reserved.</span>
          <span>Share responsibly — respect copyright and academic integrity.</span>
        </div>
      </div>
    </footer>
  );
}
