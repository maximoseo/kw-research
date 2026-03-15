import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getCurrentUser } from '@/server/auth/session';

export const metadata = {
  title: 'Login · KW Research',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(sanitizeRedirectPath(searchParams.redirect));
  }

  return (
    <div className="page-shell flex min-h-screen items-center px-4 py-12 sm:px-6">
      <div className="grid w-full gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="page-hero">
          <div className="page-hero-inner">
            <div className="toolbar-chip w-fit border-accent/20 bg-accent/10 text-accent">
              Keyword architecture control center
            </div>
            <div className="max-w-3xl">
              <p className="text-lg text-text-secondary">Professional content planning, without spreadsheet chaos.</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-[3.2rem]">
                Build professional pillar and cluster research for real businesses.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-text-secondary sm:text-base">
                Audit existing site coverage, research relevant competitors, avoid cannibalization,
                and export a polished XLSX ready for strategy, writers, or clients.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                'Protected private workspaces',
                'English and Hebrew research modes',
                'Styled Excel exports with history',
              ].map((item) => (
                <div key={item} className="panel-muted px-4 py-4 text-sm leading-6 text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="flex items-center">
          <AuthForm mode="login" />
        </div>
      </div>
    </div>
  );
}
