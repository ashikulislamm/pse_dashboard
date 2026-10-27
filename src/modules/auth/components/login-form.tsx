'use client';

import * as React from 'react';
import { Button, Card, Field, Input } from '@/shared/ui';
import { signInAction, type AuthActionState } from '../actions';

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    email: 'admin@pse.org',
    password: 'Password123!',
    role: 'admin',
  },
  {
    label: 'Safina (Target Manager)',
    email: 'safina@pse.org',
    password: 'Password123!',
    role: 'target_manager',
  },
  {
    label: 'Rahim (Member)',
    email: 'rahim@pse.org',
    password: 'Password123!',
    role: 'member',
  },
  {
    label: 'Non-PSE User (Blocked)',
    email: 'external@otherdept.org',
    password: 'Password123!',
    role: 'non-pse',
  },
];

const INITIAL_STATE: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = React.useActionState(signInAction, INITIAL_STATE);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card
        title="Sign in to PSE CRM"
        description="Enter your PSE email and password."
      >
        {state.error && (
          <div
            role="alert"
            className="mb-4 rounded-sm border border-border border-l-2 border-l-negative bg-background px-3 py-2 text-[13px] leading-5 text-negative"
          >
            {state.error}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
          <Field id="email" label="Email">
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@pse.org"
            />
          </Field>

          <Field id="password" label="Password">
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>

          <Button type="submit" loading={isPending} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>

      <Card
        title="Demo accounts"
        description="Click a role to fill demo credentials (Password123!)."
        compact
      >
        <div className="grid grid-cols-1 gap-1.5">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              onClick={() => {
                setEmail(acct.email);
                setPassword(acct.password);
              }}
              className="flex items-center justify-between rounded-sm border border-border px-2.5 py-1.5 text-left text-[12px] leading-4 hover:bg-surface-2"
            >
              <span className="font-medium text-foreground">{acct.label}</span>
              <span className="text-muted-foreground">{acct.email}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
