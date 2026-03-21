import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'KW Research · Maximo SEO',
  description:
    'Professional keyword research workspace. Discover high-value keywords, analyze difficulty, and plan content strategies with AI-powered insights.',
};

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-accent/[0.08] blur-[180px]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 h-[400px] w-[400px] rounded-full bg-info/[0.05] blur-[140px]" />

      <div className="page-shell max-w-3xl w-full text-center relative">
        <div className="rounded-2xl border-2 border-accent/15 bg-[linear-gradient(135deg,hsl(var(--accent-surface)),hsl(var(--surface))_50%)] p-8 sm:p-10 lg:p-12 shadow-[0_8px_40px_-8px_rgba(var(--accent-rgb),0.12),0_2px_8px_rgba(0,0,0,0.04)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-4 py-1.5 text-xs font-semibold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
            Maximo SEO
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight mt-6 gradient-text leading-tight">
            KW Research
          </h1>
          <p className="text-text-secondary text-base sm:text-lg mt-4 max-w-xl mx-auto leading-relaxed">
            A professional keyword research workspace. Discover high-value
            keywords, analyze difficulty, and build content strategies — all in
            one place.
          </p>

          <div className="flex flex-col items-center gap-3 mt-8">
            <Link
              href="/auth/login"
              className="gradient-btn inline-flex cursor-pointer items-center justify-center rounded-xl px-10 py-4 text-base font-semibold text-white transition-all duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="text-sm text-text-muted hover:text-accent transition-colors font-medium"
            >
              Create Account
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mt-8">
          {[
            {
              icon: (
                <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              ),
              title: 'Keyword Discovery',
              desc: 'Find untapped keyword opportunities with AI-assisted research.',
            },
            {
              icon: (
                <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              ),
              title: 'Difficulty Analysis',
              desc: 'Evaluate ranking difficulty and prioritize winnable keywords.',
            },
            {
              icon: (
                <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                </svg>
              ),
              title: 'Research Runs',
              desc: 'Track progress, compare results, and export polished workbooks.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border/50 bg-surface/80 p-5 text-left backdrop-blur-sm transition-all duration-200 hover:border-accent/20 hover:shadow-[0_4px_16px_-4px_rgba(var(--accent-rgb),0.1)]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/15 bg-accent/[0.06]">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-sm text-text-primary mt-3">{feature.title}</h3>
              <p className="text-text-muted text-xs mt-1.5 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        <p className="text-text-muted text-xs mt-12 opacity-50">
          Powered by Maximo SEO
        </p>
      </div>
    </div>
  );
}
