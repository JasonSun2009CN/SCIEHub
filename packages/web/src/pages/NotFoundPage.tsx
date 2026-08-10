import { Link } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
      <PageMeta title="Not found" />
      <FaSearch className="h-12 w-12 text-muted-foreground" />
      <h1 className="mt-6 text-6xl font-extrabold text-accent">404</h1>
      <p className="mt-4 text-lg font-medium">Page not found</p>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link to="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/feed">Browse resources</Link>
        </Button>
      </div>
    </div>
  );
}
