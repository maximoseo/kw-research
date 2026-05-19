import Link from 'next/link';
import { Button } from '@/components/ui';

export default function ProjectNotFound() {
  return (
    <main className="page-shell flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-md space-y-4">
        <h2 className="text-heading-1 text-text-primary">Project not found</h2>
        <p className="text-body text-text-secondary">
          This project does not exist or you do not have access to it.
        </p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}
