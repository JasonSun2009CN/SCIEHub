import { Link } from 'react-router-dom';
import { FaBook, FaGithub, FaHeart, FaTimes } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

/** Shown once after a brand-new registration to point new users at the rules. */
export function WelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="animate-fade-in-up flex flex-wrap items-center gap-4 rounded-2xl border border-accent/25 bg-accent-subtle p-4 shadow-soft">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <FaHeart className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Welcome to SCIEHub!</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Before you dive in, please read the community guidelines, and feel free to suggest improvements or report
            issues — your feedback helps the whole community.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to="/conduct">
              <FaBook className="h-3.5 w-3.5" /> Community guidelines
            </Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/contributing">
              <FaGithub className="h-3.5 w-3.5" /> Contribute
            </Link>
          </Button>
          <button
            onClick={onDismiss}
            aria-label="Dismiss welcome message"
            className="ml-1 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
