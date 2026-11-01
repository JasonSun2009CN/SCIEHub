import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaBookOpen,
  FaCheck,
  FaCoins,
  FaEnvelope,
  FaExclamationTriangle,
  FaGraduationCap,
  FaLock,
  FaSpinner,
  FaUser,
} from 'react-icons/fa';
import { PageMeta } from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/common/Toast';

/** If someone finds their email registered without their permission, they email this address from that email. */
const CLAIM_EMAIL = 'jasonsun2009@yeah.net';

function claimHref(email: string): string {
  const subject = 'SCIEHub: claim an account registered to my email';
  const body =
    'Hi SCIEHub team,\n\nI believe this email was registered on SCIEHub without my permission. Please help me take over or remove that account.\n\nEmail: ' +
    (email || '<my email>') +
    '\n\nThanks.';
  return `mailto:${CLAIM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function forgotHref(email: string): string {
  const subject = 'SCIEHub: reset my password';
  const body =
    'Hi SCIEHub team,\n\nI forgot my password and need it reset for my account.\n\nEmail: ' +
    (email || '<my email>') +
    '\n\nThanks.';
  return `mailto:${CLAIM_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function Field({
  icon,
  label,
  id,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  icon: React.ReactNode;
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {type === 'password' ? (
          <PasswordInput
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className="pl-10"
            required
          />
        ) : (
          <Input
            id={id}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            className="pl-10"
            required
          />
        )}
      </div>
    </div>
  );
}

const BENEFITS = [
  { Icon: FaBookOpen, text: 'A free shelf with notes, practice and past papers.' },
  { Icon: FaCoins, text: 'Publish paid packs and keep 90% of every sale.' },
  { Icon: FaCheck, text: 'One wallet for purchases, earnings and refunds.' },
];

export function AuthPage() {
  const { user, login, register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [error, setError] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [regUsername, setRegUsername] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBusy, setRegBusy] = useState(false);

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      await login(loginEmail, loginPassword);
      toast('Welcome back!', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoginBusy(false);
    }
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setEmailTaken(false);
    setRegBusy(true);
    try {
      await register({
        username: regUsername.trim(),
        nickname: regNickname.trim(),
        email: regEmail,
        password: regPassword,
      });
      toast('Account created — welcome to SCIEHub!', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      // 409 = this email is already registered — offer an account-claim path.
      setEmailTaken(err instanceof ApiError && err.status === 409);
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="section-shell py-10 sm:py-16">
      <PageMeta title="Sign in" description="Sign in or create a SCIEHub account." />
      <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_0.9fr]">
        {/* Editorial panel */}
        <div className="relative hidden overflow-hidden rounded-3xl border border-border/70 bg-surface/60 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" aria-hidden />
          <div
            className="pointer-events-none absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <Link to="/" className="inline-flex items-center gap-2.5 font-bold">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
                <FaGraduationCap className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-lg tracking-tight">
                SCIE<span className="text-accent">Hub</span>
              </span>
            </Link>
            <p className="eyebrow mt-14">The study shelf</p>
            <h1 className="mt-3 max-w-md font-display text-4xl leading-[1.05] sm:text-5xl">
              Your next grade starts with the right notes.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
              Join a marketplace built around IGCSE, AS/A Level, IB and AP — where students share
              what they know and get paid for the work that works.
            </p>
          </div>
          <ul className="relative mt-10 space-y-3">
            {BENEFITS.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Form panel */}
        <div className="mx-auto flex w-full max-w-md flex-col justify-center">
          <div className="mb-6 text-center lg:text-left">
            <p className="eyebrow">Member access</p>
            <h2 className="mt-1 font-display text-3xl">Welcome to SCIEHub</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to upload, purchase, review and join study groups.
            </p>
          </div>

          <div className="panel p-6 sm:p-7">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign in</TabsTrigger>
                <TabsTrigger value="register">Create account</TabsTrigger>
              </TabsList>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-error-subtle px-3.5 py-2.5 text-sm text-error">
                  {error}
                </p>
              )}

              <TabsContent value="login">
                <form onSubmit={onLogin} className="mt-4 space-y-4">
                  <Field
                    icon={<FaEnvelope className="h-4 w-4" />}
                    label="Email"
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={setLoginEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <Field
                    icon={<FaLock className="h-4 w-4" />}
                    label="Password"
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <Button type="submit" className="w-full" disabled={loginBusy}>
                    {loginBusy && <FaSpinner className="h-4 w-4 animate-spin" />}
                    Sign in
                    {!loginBusy && <FaArrowRight className="h-3.5 w-3.5" />}
                  </Button>
                </form>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Forgot your password?{' '}
                  <a href={forgotHref(loginEmail)} className="cursor-pointer text-accent hover:underline">
                    Contact the admin to reset it
                  </a>
                </p>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={onRegister} className="mt-4 space-y-4">
                  <Field
                    icon={<FaUser className="h-4 w-4" />}
                    label="Username"
                    id="reg-username"
                    type="text"
                    value={regUsername}
                    onChange={setRegUsername}
                    placeholder="3–20 chars, letters, digits, underscore"
                    autoComplete="username"
                  />
                  <Field
                    icon={<FaUser className="h-4 w-4" />}
                    label="Nickname"
                    id="reg-nickname"
                    type="text"
                    value={regNickname}
                    onChange={setRegNickname}
                    placeholder="How should we call you?"
                    autoComplete="nickname"
                  />
                  <Field
                    icon={<FaEnvelope className="h-4 w-4" />}
                    label="Email"
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={setRegEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                  <Field
                    icon={<FaLock className="h-4 w-4" />}
                    label="Password"
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={setRegPassword}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                  <Button type="submit" className="w-full" disabled={regBusy}>
                    {regBusy && <FaSpinner className="h-4 w-4 animate-spin" />}
                    Create account
                    {!regBusy && <FaArrowRight className="h-3.5 w-3.5" />}
                  </Button>
                </form>
                {emailTaken && (
                  <div className="mt-4 rounded-xl border border-warning/30 bg-warning-subtle p-4 text-sm">
                    <p className="flex items-start gap-2 font-medium text-warning">
                      <FaExclamationTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      {regEmail} is already registered.
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      Did someone else register this email without your permission? Use{' '}
                      <span className="font-medium">{regEmail}</span> to email the SCIEHub team and claim or remove the
                      account.
                    </p>
                    <a
                      href={claimHref(regEmail)}
                      className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-warning px-3.5 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      <FaEnvelope className="h-4 w-4" /> Claim this email
                    </a>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Was your email registered by someone else?{' '}
            <a href={claimHref('')} className="cursor-pointer text-accent hover:underline">
              Contact the SCIEHub team to claim it
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
