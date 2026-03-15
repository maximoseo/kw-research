import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getCurrentUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Register · KW Research',
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(sanitizeRedirectPath(searchParams.redirect));
  }

  return (
    <div className="page-shell flex min-h-screen items-center px-4 py-12 sm:px-6 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/4 left-0 h-[400px] w-[400px] rounded-full bg-[rgba(124,92,255,0.08)] blur-[150px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-0 h-[300px] w-[300px] rounded-full bg-[rgba(96,165,250,0.06)] blur-[120px]" />

      <div className="grid w-full gap-8 xl:grid-cols-[1.05fr_0.95fr] relative">
        <section className="page-hero border-[rgba(124,92,255,0.12)]">
          <div className="page-hero-inner">
            <div className="toolbar-chip w-fit border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              New analyst onboarding
            </div>
            <div className="max-w-3xl">
              <p className="text-lg text-text-secondary">Create a secure operator account.</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-[3.2rem] gradient-text">
                Launch a repeatable keyword-research workflow for every client site.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                Each account gets its own project history, uploads, run logs, XLSX exports, and
                route-protected dashboard with clear research state.
              </p>
            </div>
          </div>
        </section>
        <div className="flex items-center">
          <AuthForm mode="register" />
        </div>
      </div>
    </div>
  );
}
