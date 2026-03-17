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
    <div className="page-shell relative min-h-screen overflow-x-clip px-4 py-8 sm:px-6 sm:py-10 lg:py-14">
      <div className="pointer-events-none absolute left-[-96px] top-14 hidden h-[200px] w-[200px] rounded-full bg-accent/[0.06] blur-[100px] sm:block" />
      <div className="pointer-events-none absolute bottom-12 right-[-64px] hidden h-[160px] w-[160px] rounded-full bg-success/[0.04] blur-[80px] sm:block" />

      <div className="grid w-full gap-8 lg:grid-cols-2 lg:items-center xl:grid-cols-[0.96fr_1.04fr]">
        <div className="order-2 lg:order-1">
          <section className="page-hero border-border/70">
            <div className="page-hero-inner">
              <div className="toolbar-chip w-fit border-success/18 bg-success/[0.08] text-success">
                New workspace onboarding
              </div>
              <div className="max-w-3xl">
                <p className="eyebrow">Analyst setup</p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl lg:text-[2.5rem] lg:leading-tight">
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
                  <div key={title} className="subtle-surface px-4 py-3.5">
                    <p className="text-sm font-semibold text-text-primary">{title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-text-secondary">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
        <div className="order-1 flex items-start lg:order-2 lg:justify-end">
          <AuthForm mode="register" />
        </div>
      </div>
    </div>
  );
}
