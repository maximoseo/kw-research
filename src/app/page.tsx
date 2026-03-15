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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="page-shell max-w-2xl w-full text-center">
        {/* Hero */}
        <div className="page-hero">
          <div className="page-hero-inner">
            <span className="toolbar-chip w-fit mx-auto">Maximo SEO</span>
            <h1 className="text-4xl sm:text-[3.2rem] font-semibold tracking-tight mt-3">
              KW Research
            </h1>
            <p className="text-text-secondary text-lg mt-3 max-w-xl mx-auto">
              A professional keyword research workspace. Discover high-value
              keywords, analyze difficulty, and build content strategies — all in
              one place.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-3 mt-8">
          <div className="panel-muted rounded-xl p-5 text-left">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold text-base">Keyword Discovery</h3>
            <p className="text-text-secondary text-sm mt-1">
              Find untapped keyword opportunities with AI-assisted research and
              real-time data.
            </p>
          </div>
          <div className="panel-muted rounded-xl p-5 text-left">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold text-base">Difficulty Analysis</h3>
            <p className="text-text-secondary text-sm mt-1">
              Evaluate ranking difficulty and prioritize keywords you can
              actually win.
            </p>
          </div>
          <div className="panel-muted rounded-xl p-5 text-left">
            <div className="text-2xl mb-2">🗂️</div>
            <h3 className="font-semibold text-base">Research Runs</h3>
            <p className="text-text-secondary text-sm mt-1">
              Organize research into runs. Track progress, compare results, and
              iterate.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 mt-10">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-base font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="text-sm text-text-secondary hover:text-accent transition-colors"
          >
            Create Account
          </Link>
        </div>

        {/* Footer */}
        <p className="text-text-secondary text-xs mt-16 opacity-60">
          Powered by Maximo SEO
        </p>
      </div>
    </div>
  );
}
