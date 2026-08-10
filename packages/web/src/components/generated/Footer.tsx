import { Link } from 'react-router-dom';
import { FaGithub, FaGraduationCap, FaInstagram, FaLinkedinIn, FaTwitter } from 'react-icons/fa';

const PLATFORM_LINKS = [
  { to: '/feed', label: 'Resources' },
  { to: '/groups', label: 'Groups' },
  { to: '/upload', label: 'Upload' },
  { to: '/auth', label: 'Sign in' },
];

const SOCIALS = [
  { href: 'https://github.com', label: 'GitHub', Icon: FaGithub },
  { href: 'https://twitter.com', label: 'Twitter', Icon: FaTwitter },
  { href: 'https://instagram.com', label: 'Instagram', Icon: FaInstagram },
  { href: 'https://linkedin.com', label: 'LinkedIn', Icon: FaLinkedinIn },
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
              Share, Collaborate, Excel. A study-materials sharing platform for international high schoolers.
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
              <li><span className="text-muted-foreground">IB · A-Level · AP · IGCSE</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Connect</h3>
            <div className="mt-3 flex gap-2">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
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
