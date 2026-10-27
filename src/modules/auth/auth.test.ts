import { describe, expect, it } from 'vitest';
import {
  canAccessAdmin,
  canManageTargets,
  validateSelfUpdateGuard,
} from './service';

describe('auth module business rules', () => {
  it('grants admin access only to admin role', () => {
    expect(canAccessAdmin('admin')).toBe(true);
    expect(canAccessAdmin('target_manager')).toBe(false);
    expect(canAccessAdmin('member')).toBe(false);
  });

  it('grants target management to admin and target_manager', () => {
    expect(canManageTargets('admin')).toBe(true);
    expect(canManageTargets('target_manager')).toBe(true);
    expect(canManageTargets('member')).toBe(false);
  });

  it('prevents an admin from removing their own admin role or deactivating themselves', () => {
    const id = '10000000-0000-0000-0000-000000000001';
    expect(validateSelfUpdateGuard(id, id, 'member', true, true)).toMatch(/own admin role/);
    expect(validateSelfUpdateGuard(id, id, 'admin', false, true)).toMatch(/deactivate/);
    expect(validateSelfUpdateGuard(id, id, 'admin', true, false)).toMatch(/PSE access/);
    expect(validateSelfUpdateGuard(id, id, 'admin', true, true)).toBeNull();
  });
});
