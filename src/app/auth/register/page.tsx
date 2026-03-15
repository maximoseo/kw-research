import { redirect } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import { sanitizeRedirectPath } from '@/lib/auth';
import { getCurrentUser } from '@/server/auth/session';

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
    <div className="page-shell flex min-h-screen items-center px-4 py-12 sm:px-6">
      <div className="grid w-full gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="page-hero">
          <div className="page-hero-inner">
            <div className="toolbar-chip w-fit border-success/20 bg-success/[0.12] text-success">
              New analyst onboarding
            </div>
            <div className="max-w-3xl">
              <p className="text-lg text-text-secondary">Create a secure operator account.</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-[3.2rem]">
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
