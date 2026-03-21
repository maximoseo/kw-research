'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Alert, Badge, Button, Card, Field } from '@/components/ui';

type AuthMode = 'login' | 'register';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const redirectQuery = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(() => {
    const urlError = searchParams.get('error');
    if (urlError === 'oauth_callback_failed') return 'Google sign-in failed. Please try again.';
    if (urlError === 'oauth_not_configured') return 'Google sign-in is not configured. Please use email and password.';
    return null;
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [googleLoading, setGoogleLoading] = useState(false);
  const hasRedirectContext = redirectTo !== '/dashboard';

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    const params = new URLSearchParams({
      redirect: redirectTo,
    });
    window.location.href = `/api/auth/google?${params.toString()}`;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          displayName: form.displayName,
          email: form.email,
          password: form.password,
          redirectTo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        setError(payload?.error || 'Authentication failed.');
        return;
      }

      setSuccess(mode === 'login' ? 'Signed in successfully. Redirecting…' : 'Account created. Redirecting…');
      router.replace(payload?.redirectTo || redirectTo);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <Card variant="hero" padding="lg" className="border-accent/10">
        <div className="flex flex-col gap-5">
          <div>
            <Badge variant="info" className="w-fit border-accent/18 bg-accent/[0.1] text-accent">
              {mode === 'login' ? 'Protected workspace' : 'Create account'}
            </Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary sm:text-[1.75rem]">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace account'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-secondary">
              {mode === 'login'
                ? 'Access dashboards, research history, logs, and workbook exports.'
                : 'Set up a secure account to manage projects, runs, and exports.'}
            </p>
          </div>

          {hasRedirectContext ? (
            <Alert variant="info" title="Workspace recovery">
              After authentication, you will return to <span className="font-semibold text-text-primary">{redirectTo}</span>.
            </Alert>
          ) : null}

          {error ? <Alert variant="error" title="Authentication failed">{error}</Alert> : null}
          {success ? <Alert variant="success" title="Success">{success}</Alert> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' ? (
              <Field label="Display name">
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                    placeholder="Your name"
                    required
                    className="field-input pl-11"
                  />
                </div>
              </Field>
            ) : null}

            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  required
                  className="field-input pl-11"
                />
              </div>
            </Field>

            <Field label="Password" hint={mode === 'register' ? 'Minimum 6 characters' : undefined}>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="field-input pl-11"
                />
              </div>
            </Field>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Button type="submit" variant="primary" size="lg" className="w-full sm:flex-1" loading={isPending} disabled={isPending || googleLoading}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={handleGoogleSignIn}
                loading={googleLoading}
                disabled={isPending || googleLoading}
                className="w-full sm:flex-1"
                icon={
                  !googleLoading ? (
                    <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  ) : undefined
                }
              >
                Google
              </Button>
            </div>
          </form>

          <div className="border-t border-border/50 pt-4 text-center text-sm text-text-secondary">
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <Link href={`/auth/register${redirectQuery}`} className="text-accent hover:underline font-medium">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have access?{' '}
              <Link href={`/auth/login${redirectQuery}`} className="text-accent hover:underline font-medium">
                Sign in
              </Link>
            </>
          )}
          </div>

          <div className="rounded-lg border border-border/50 bg-surface-raised/[0.4] px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm text-text-muted">
              <span>Private workspace, route-protected access</span>
              <ArrowRight className="h-3.5 w-3.5 text-accent/60" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
