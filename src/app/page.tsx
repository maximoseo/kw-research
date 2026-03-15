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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-[rgba(124,92,255,0.08)] blur-[150px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-[400px] w-[400px] rounded-full bg-[rgba(96,165,250,0.06)] blur-[120px]" />

      <div className="page-shell max-w-2xl w-full text-center relative">
        {/* Hero */}
        <div className="page-hero border-[rgba(124,92,255,0.12)]">
          <div className="page-hero-inner">
            <span className="toolbar-chip w-fit mx-auto border-[rgba(124,92,255,0.2)] bg-[rgba(124,92,255,0.08)] text-[#8f73ff]">
              Maximo SEO
            </span>
            <h1 className="text-4xl sm:text-[3.2rem] font-bold tracking-tight mt-3 gradient-text">
              KW Research
            </h1>
            <p className="text-text-secondary text-lg mt-3 max-w-xl mx-auto leading-relaxed">
              A professional keyword research workspace. Discover high-value
              keywords, analyze difficulty, and build content strategies — all in
              one place.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-4 md:grid-cols-3 mt-8">
          {[
            {
              icon: (
                <svg className="h-6 w-6 text-[#7c5cff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              ),
              title: 'Keyword Discovery',
              desc: 'Find untapped keyword opportunities with AI-assisted research and real-time data.',
            },
            {
              icon: (
                <svg className="h-6 w-6 text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              ),
              title: 'Difficulty Analysis',
              desc: 'Evaluate ranking difficulty and prioritize keywords you can actually win.',
            },
            {
              icon: (
                <svg className="h-6 w-6 text-[#8f73ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
                </svg>
              ),
              title: 'Research Runs',
              desc: 'Organize research into runs. Track progress, compare results, and iterate.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-[rgba(124,92,255,0.1)] bg-[rgba(20,26,49,0.6)] p-5 text-left backdrop-blur-sm transition-all duration-300 hover:border-[rgba(124,92,255,0.25)] hover:shadow-[0_8px_32px_rgba(124,92,255,0.08)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(124,92,255,0.15)] bg-[rgba(124,92,255,0.08)] mb-3">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-base text-text-primary">{feature.title}</h3>
              <p className="text-text-secondary text-sm mt-1.5 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 mt-10">
          <Link
            href="/auth/login"
            className="gradient-btn inline-flex items-center justify-center rounded-lg px-8 py-3.5 text-base font-semibold text-white transition-all duration-300"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="text-sm text-text-secondary hover:text-[#8f73ff] transition-colors"
          >
            Create Account
          </Link>
        </div>

        {/* Footer */}
        <p className="text-text-muted text-xs mt-16 opacity-60">
          Powered by Maximo SEO
        </p>
      </div>
    </div>
  );
}
