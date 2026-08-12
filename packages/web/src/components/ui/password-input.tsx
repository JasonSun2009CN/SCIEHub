import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Password field with a show/hide visibility toggle. */
export function PasswordInput({ className, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <FaEyeSlash className="h-4 w-4" /> : <FaEye className="h-4 w-4" />}
      </button>
    </div>
  );
}
