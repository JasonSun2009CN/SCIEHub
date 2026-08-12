import { Link } from 'react-router-dom';
import { FaBug, FaCodeBranch, FaEnvelope, FaGithub, FaHeart } from 'react-icons/fa';
import { PageMeta } from '@/components/common/PageMeta';

const GITHUB_REPO = 'https://github.com/JasonSun2009CN/SCIEHub';
const CONTACT_EMAIL = 'jasonsun2009@yeah.net';

const WAYS = [
  {
    Icon: FaEnvelope,
    title: 'Suggest an improvement',
    description:
      'Spotted something that could be better? Have an idea for a new feature? Drop me an email — I read every message and really appreciate the feedback.',
    actionLabel: 'Email your suggestions',
    href: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('SCIEHub improvement suggestion')}`,
    external: false,
  },
  {
    Icon: FaBug,
    title: 'Report an issue on GitHub',
    description:
      'Found a bug, a broken link or something that feels off? File an issue on the GitHub repository so it can be tracked and fixed.',
    actionLabel: 'Open a GitHub issue',
    href: `${GITHUB_REPO}/issues`,
    external: true,
  },
  {
    Icon: FaCodeBranch,
    title: 'Contribute code',
    description:
      'Want to help build SCIEHub? Fork the repository, make your changes, and open a pull request. If everything looks good, I will review and merge it.',
    actionLabel: 'Fork the repository',
    href: GITHUB_REPO,
    external: true,
  },
];

export function ContributingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta
        title="Contribute"
        description="SCIEHub is built with community help — send suggestions, report issues, or contribute code."
      />
      <div className="text-center">
        <FaHeart className="mx-auto h-10 w-10 text-error" />
        <h1 className="mt-3 text-2xl font-bold">Help improve SCIEHub</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          SCIEHub is built for students, by students — and it only gets better with your feedback and contributions.
          Whatever you have in mind, you're very welcome to get involved.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {WAYS.map(({ Icon, title, description, actionLabel, href, external }, i) => (
          <div
            key={title}
            className="animate-fade-in-up flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <a
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noreferrer' : undefined}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
            >
              {external && <FaGithub className="h-4 w-4" />}
              {actionLabel}
            </a>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
        <h2 className="font-semibold text-foreground">A few ground rules</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>All contributions must follow the <Link to="/conduct" className="text-accent hover:underline">community guidelines</Link>.</li>
          <li>Don't upload material you don't have permission to share — respect copyright.</li>
          <li>In code contributions, keep changes focused and explain what they do in the pull request.</li>
          <li>Be kind. This is a student community.</li>
        </ul>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Questions? Email me at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">{CONTACT_EMAIL}</a>
      </p>
    </div>
  );
}
