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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      <div className="rounded-[32px] border border-border/80 bg-[linear-gradient(180deg,hsl(var(--surface))/0.98,hsl(var(--surface-raised))/0.96)] p-7 shadow-[0_40px_120px_-64px_rgba(0,0,0,0.9)] sm:p-8">
        <div className="toolbar-chip w-fit border-accent/20 bg-accent/10 text-accent">
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
          <div className="mb-4 rounded-[22px] border border-destructive/25 bg-destructive/[0.12] px-4 py-3 text-body text-destructive">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-[22px] border border-success/25 bg-success/[0.12] px-4 py-3 text-body text-success">
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

          <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending} disabled={isPending}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

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
