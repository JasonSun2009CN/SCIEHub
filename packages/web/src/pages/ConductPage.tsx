import { Link } from 'react-router-dom';
import { FaBan, FaBook, FaCoins, FaCopyright, FaFlag, FaHeart, FaShieldAlt, FaStar, FaUserSlash } from 'react-icons/fa';
import { PageMeta } from '@/components/common/PageMeta';

const RULES = [
  {
    Icon: FaHeart,
    title: 'Be respectful',
    description:
      'Treat every member with kindness. No harassment, bullying, hate speech or personal attacks — in repositories, comments or anywhere else on SCIEHub.',
  },
  {
    Icon: FaCopyright,
    title: 'Respect copyright',
    description:
      'Only upload materials you are allowed to share. Don’t republish commercial exam papers, paid content or others’ work without permission.',
  },
  {
    Icon: FaUserSlash,
    title: 'No plagiarism',
    description:
      'Give credit where it’s due. Don’t copy someone else’s work and pass it off as your own, and don’t download others’ material just to re-upload it.',
  },
  {
    Icon: FaBan,
    title: 'No spam or misleading content',
    description:
      'Keep repositories genuine. No clickbait titles, scams, self-promotion, or material that doesn’t match its description.',
  },
  {
    Icon: FaCoins,
    title: 'Fair pricing',
    description:
      'Price paid resources honestly and deliver exactly what the description promises. Overpriced, bait-and-switch or fake listings are treated as violations.',
  },
  {
    Icon: FaStar,
    title: 'Honest reviews & refunds',
    description:
      'Review only resources you actually bought, and review honestly. Sellers can refund a paid order to make things right; buyers should reach out before escalating a report.',
  },
  {
    Icon: FaShieldAlt,
    title: 'Keep it appropriate',
    description:
      'This is a study community. Content must be safe for school — no explicit, violent or otherwise inappropriate material.',
  },
  {
    Icon: FaFlag,
    title: 'Report violations',
    description:
      'See something against these rules? Use the Report button on any repository or comment. Reports are reviewed by the community team.',
  },
];

export function ConductPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMeta title="Community guidelines" description="The SCIEHub community rules — be respectful, share responsibly." />
      <div className="text-center">
        <FaShieldAlt className="mx-auto h-10 w-10 text-accent" />
        <h1 className="mt-3 font-display text-3xl">Community guidelines</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          SCIEHub works because students look after each other. These ground rules keep the community respectful, useful and safe.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {RULES.map(({ Icon, title, description }, i) => (
          <div
            key={title}
            className="animate-fade-in-up rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-border/75 bg-surface/75 shadow-soft p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <FaBook className="h-4 w-4 text-accent" /> One more thing about files & trading
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Files you upload are visible to everyone who can access your repository. Be thoughtful about what you share and
          who it could help (or harm). Downloads are tracked, and paid resources stay locked until a buyer pays — then
          the buyer keeps access and the seller earns 90% of the price (10% platform fee). Buyers can review what they
          purchased, and sellers can issue refunds when something is wrong.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link to="/marketplace" className="text-accent hover:underline">Browse the marketplace →</Link>
          <Link to="/upload" className="text-accent hover:underline">Upload & sell a resource →</Link>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Questions? Email the community team at{' '}
        <a href="mailto:jasonsun2009@yeah.net" className="text-accent hover:underline">jasonsun2009@yeah.net</a>.
      </p>
    </div>
  );
}
