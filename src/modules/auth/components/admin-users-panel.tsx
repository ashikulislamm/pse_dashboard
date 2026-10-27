'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button, Card, DateText, Field, Input, Select, Tag } from '@/shared/ui';
import type { AppRole } from '@/types/database';
import { createUserAction, updateUserRoleAction } from '../actions';
import type {
  CategoryVerticalRow,
  FxRateRow,
  PublicProfileRecord,
  StageConfigRow,
} from '../repository';

export interface AdminUsersPanelProps {
  currentUserId: string;
  profiles: PublicProfileRecord[];
  stages: StageConfigRow[];
  categoryMap: CategoryVerticalRow[];
  fxRates: FxRateRow[];
}

export function AdminUsersPanel({
  currentUserId,
  profiles,
  stages,
  categoryMap,
  fxRates,
}: AdminUsersPanelProps) {
  const [creating, setCreating] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState<AppRole>('member');
  const [newIsPse, setNewIsPse] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const res = await createUserAction({
        email: newEmail,
        full_name: newName,
        password: newPassword,
        role: newRole,
        is_pse: newIsPse,
      });
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success('User created');
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('member');
      setNewIsPse(true);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (
    userId: string,
    role: AppRole,
    isPse: boolean,
    isActive: boolean,
  ) => {
    setSavingId(userId);
    try {
      const res = await updateUserRoleAction({
        userId,
        role,
        is_pse: isPse,
        is_active: isActive,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('User updated');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card
            title="Team members & access control"
            description="Manage roles (admin, target_manager, member) and PSE department visibility."
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[13px] leading-5">
                <thead className="bg-surface text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">PSE Access</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const isSelf = p.id === currentUserId;
                    const busy = savingId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className="h-11 border-b border-border last:border-b-0 hover:bg-surface-2"
                      >
                        <td className="px-3 font-medium text-foreground">
                          {p.full_name}
                          {isSelf && (
                            <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </td>
                        <td className="px-3 text-muted-foreground">{p.email}</td>
                        <td className="px-3">
                          <Select
                            aria-label={`Role for ${p.full_name}`}
                            value={p.role}
                            disabled={isSelf || busy}
                            onChange={(e) =>
                              handleUpdateUser(
                                p.id,
                                e.target.value as AppRole,
                                p.is_pse,
                                p.is_active,
                              )
                            }
                            className="h-8 w-40 text-[13px]"
                          >
                            <option value="member">member</option>
                            <option value="target_manager">target_manager</option>
                            <option value="admin">admin</option>
                          </Select>
                        </td>
                        <td className="px-3">
                          <Select
                            aria-label={`PSE access for ${p.full_name}`}
                            value={p.is_pse ? 'pse' : 'blocked'}
                            disabled={isSelf || busy}
                            onChange={(e) =>
                              handleUpdateUser(
                                p.id,
                                p.role,
                                e.target.value === 'pse',
                                p.is_active,
                              )
                            }
                            className="h-8 w-32 text-[13px]"
                          >
                            <option value="pse">PSE member</option>
                            <option value="blocked">Non-PSE (blocked)</option>
                          </Select>
                        </td>
                        <td className="px-3">
                          <Select
                            aria-label={`Status for ${p.full_name}`}
                            value={p.is_active ? 'active' : 'inactive'}
                            disabled={isSelf || busy}
                            onChange={(e) =>
                              handleUpdateUser(
                                p.id,
                                p.role,
                                p.is_pse,
                                e.target.value === 'active',
                              )
                            }
                            className="h-8 w-28 text-[13px]"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card
            title="Add team user"
            description="Create a user profile with login credentials."
          >
            {formError && (
              <div
                role="alert"
                className="mb-4 rounded-sm border border-border border-l-2 border-l-negative px-3 py-2 text-[12px] text-negative"
              >
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
              <Field id="new-name" label="Full name">
                <Input
                  id="new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </Field>
              <Field id="new-email" label="Email">
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                />
              </Field>
              <Field id="new-password" label="Initial password">
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
              <Field id="new-role" label="Role">
                <Select
                  id="new-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AppRole)}
                >
                  <option value="member">member</option>
                  <option value="target_manager">target_manager</option>
                  <option value="admin">admin</option>
                </Select>
              </Field>
              <Field id="new-pse" label="Department">
                <Select
                  id="new-pse"
                  value={newIsPse ? 'yes' : 'no'}
                  onChange={(e) => setNewIsPse(e.target.value === 'yes')}
                >
                  <option value="yes">PSE team</option>
                  <option value="no">Other department (blocked by RLS)</option>
                </Select>
              </Field>
              <Button type="submit" loading={creating} className="mt-2">
                Create user
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Pipeline stages"
          description="Reports group by stage kind (open, won, lost, junk)."
          compact
        >
          <table className="w-full border-collapse text-left text-[13px] leading-5">
            <thead className="bg-surface text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">Stage</th>
                <th className="px-2 py-1.5 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.id} className="h-9 border-b border-border last:border-b-0">
                  <td className="px-2 text-muted-foreground tabular-nums">{s.position}</td>
                  <td className="px-2 font-medium text-foreground">{s.name}</td>
                  <td className="px-2">
                    <Tag
                      tone={
                        s.kind === 'won'
                          ? 'positive'
                          : s.kind === 'lost'
                            ? 'negative'
                            : 'neutral'
                      }
                    >
                      {s.kind}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Category → Vertical mapping"
          description="Contribution categories roll up into target verticals."
          compact
        >
          <table className="w-full border-collapse text-left text-[13px] leading-5">
            <thead className="bg-surface text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 font-medium">Category</th>
                <th className="px-2 py-1.5 font-medium">Vertical</th>
              </tr>
            </thead>
            <tbody>
              {categoryMap.map((m) => (
                <tr
                  key={m.category_id}
                  className="h-9 border-b border-border last:border-b-0"
                >
                  <td className="px-2 font-medium text-foreground">{m.category_name}</td>
                  <td className="px-2 text-muted-foreground">{m.vertical_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Currencies & FX rates"
          description="Base currency is BDT (৳). Rates convert foreign deals at write time."
          compact
        >
          <table className="w-full border-collapse text-left text-[13px] leading-5">
            <thead className="bg-surface text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 font-medium">Code</th>
                <th className="px-2 py-1.5 text-right font-medium">Rate to BDT</th>
                <th className="px-2 py-1.5 font-medium">Effective</th>
              </tr>
            </thead>
            <tbody>
              {fxRates.map((fx) => (
                <tr
                  key={`${fx.currency}-${fx.effective_from}`}
                  className="h-9 border-b border-border last:border-b-0"
                >
                  <td className="px-2 font-medium text-foreground">{fx.currency}</td>
                  <td className="px-2 text-right tabular-nums">
                    {Number(fx.rate_to_base).toFixed(2)}
                  </td>
                  <td className="px-2 text-muted-foreground">
                    <DateText value={fx.effective_from} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
