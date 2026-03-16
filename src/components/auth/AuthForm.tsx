'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';

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
    <div className="w-full max-w-[560px] mx-auto">
      <div className="rounded-2xl border border-accent/12 bg-surface-raised/80 p-7 shadow-elevation backdrop-blur-xl sm:p-8">
        <div className="toolbar-chip w-fit border-accent/20 bg-accent/8 text-accent">
          {mode === 'login' ? 'Protected workspace access' : 'Create analyst account'}
        </div>
        <h2 className="mt-5 text-[2rem] font-semibold tracking-tight text-text-primary">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
        <p className="mt-3 text-body text-text-secondary mb-6 leading-6">
          {mode === 'login'
            ? 'Sign in to run keyword research, monitor processing logs, and download Excel outputs.'
            : 'Create a secure account to manage research history, uploaded workbooks, and exports.'}
        </p>

        {error ? (
          <div className="mb-4 rounded-lg border border-destructive/25 bg-destructive/[0.12] px-4 py-3 text-body text-destructive">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-lg border border-success/25 bg-success/[0.12] px-4 py-3 text-body text-success">
            {success}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' ? (
            <div className="field-group">
              <label className="field-label">Display name</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="Your name"
                required
                className="field-input"
              />
            </div>
          ) : null}

          <div className="field-group">
            <label className="field-label">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="you@example.com"
              required
              className="field-input"
            />
          </div>

          <div className="field-group">
            <label className="field-label">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="At least 6 characters"
              required
              minLength={6}
              className="field-input"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending} disabled={isPending || googleLoading}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-accent/12" />
          <span className="text-xs text-text-secondary uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-accent/12" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleGoogleSignIn}
          loading={googleLoading}
          disabled={isPending || googleLoading}
          className="mt-6 w-full flex items-center justify-center gap-2 border-accent/12 bg-accent/4 hover:bg-accent/8"
        >
          {!googleLoading && (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
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
          )}
          Continue with Google
        </Button>

        <div className="subtle-divider mt-6 pt-5 text-center text-body-sm text-text-secondary">
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
      </div>
    </div>
  );
}
