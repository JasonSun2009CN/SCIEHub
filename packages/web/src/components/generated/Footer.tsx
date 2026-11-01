import { Link } from 'react-router-dom';
import { FaGithub, FaGraduationCap } from 'react-icons/fa';

const GITHUB_REPO = 'https://github.com/JasonSun2009CN/SCIEHub';

const PLATFORM_LINKS = [
  { to: '/free', label: 'Free resources' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/community', label: 'The Commons' },
  { to: '/paid', label: 'Paid resources' },
  { to: '/groups', label: 'Study groups' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

const ACCOUNT_LINKS = [
  { to: '/upload', label: 'Publish a resource' },
  { to: '/requests', label: 'Purchase requests' },
  { to: '/settings', label: 'Account settings' },
  { to: '/conduct', label: 'Community guidelines' },
];

export function Footer() {
  return (
    <footer className="mt-8 border-t border-border/70 bg-surface/45">
      <div className="section-shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2.5 font-bold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <FaGraduationCap className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-lg tracking-tight">
                SCIE<span className="text-accent">Hub</span>
              </span>
            </Link>
            <p className="mt-4 font-display text-2xl leading-snug text-foreground">
              Share what you know.
              <span className="text-muted-foreground"> Learn from everyone.</span>
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              A curated study-resource marketplace for IGCSE, AS/A Level, IB and AP students.
              Built by students, for students.
            </p>
          </div>

          <div>
            <h3 className="eyebrow">Explore</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {PLATFORM_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow">Account</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-muted-foreground transition-colors hover:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="eyebrow">Open source</h3>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Inspect the code, report issues or contribute a fix.
            </p>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
            >
              <FaGithub className="h-4 w-4" />
              Source on GitHub
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} SCIEHub. All rights reserved.</span>
          <span>Share responsibly — respect copyright and academic integrity.</span>
        </div>
      </div>
    </footer>
  );
}
