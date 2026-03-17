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
    <div className="page-shell relative min-h-screen overflow-x-clip px-4 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute left-[-96px] top-14 hidden h-[240px] w-[240px] rounded-full bg-[rgba(124,92,255,0.08)] blur-[120px] sm:block" />
      <div className="pointer-events-none absolute bottom-12 right-[-64px] hidden h-[180px] w-[180px] rounded-full bg-[rgba(34,197,94,0.06)] blur-[100px] sm:block" />

      <div className="grid w-full gap-5 xl:grid-cols-[0.96fr_1.04fr] xl:items-center">
        <div className="order-2 xl:order-1">
          <section className="page-hero border-border/70">
            <div className="page-hero-inner">
              <div className="toolbar-chip w-fit border-success/18 bg-success/[0.08] text-success">
                New workspace onboarding
              </div>
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Analyst setup</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-[3rem]">
                  Create a secure account for repeatable, client-ready keyword research.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                  Set up your workspace once, then manage sites, uploads, run history, status tracking, and exports from a cleaner project structure.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Project history', 'Keep every site workspace and research run organized.'],
                  ['Protected access', 'Dashboard routes stay scoped behind authentication.'],
                  ['Operational clarity', 'Track logs, outputs, retries, and downloads in one place.'],
                ].map(([title, description]) => (
                  <div key={title} className="subtle-surface px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <div className="order-1 flex items-start xl:order-2 xl:justify-end">
          <AuthForm mode="register" />
        </div>
      </div>
    </div>
  );
}
