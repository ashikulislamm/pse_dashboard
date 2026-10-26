import { Button, Card, Field, Input } from '@/shared/ui';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card
        title="Sign in to PSE CRM"
        description="Use your PSE team credentials to access the workspace."
        className="w-full max-w-sm"
      >
        <form className="flex flex-col gap-4">
          <Field id="email" label="Email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
          <Field id="password" label="Password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
