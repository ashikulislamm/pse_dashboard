import { signOutAction } from '@/modules/auth';
import { Button, Card } from '@/shared/ui';

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card
        title="Access restricted"
        description="You don't have access to this page. PSE CRM records are restricted to active Private Sector Engagement team members."
        className="w-full max-w-md"
      >
        <form action={signOutAction} className="mt-2 flex items-center justify-end">
          <Button type="submit" variant="secondary">
            Sign out and switch account
          </Button>
        </form>
      </Card>
    </div>
  );
}
