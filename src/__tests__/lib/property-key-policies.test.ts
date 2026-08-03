import {
  PropertyKeyPolicyMode,
  PropertyKeyPolicyResource,
  toPropertyKeyPolicy,
  toPropertyKeyPolicyKey,
  toPropertyKeyPolicyPage,
} from '../../lib/property-key-policies';

function policy(
  overrides: Partial<{
    id: string;
    name?: string;
    suppliedId?: string;
    createdAt: string;
    mode: PropertyKeyPolicyMode;
  }> = {}
): PropertyKeyPolicyResource {
  return {
    type: 'property-key-policy',
    id: overrides.id ?? 'policy-id',
    attributes: {
      createdAt: overrides.createdAt ?? '2026-06-10T15:30:00Z',
      mode: overrides.mode ?? PropertyKeyPolicyMode.Allowlist,
      name: 'name' in overrides ? overrides.name : 'Allow policy',
      suppliedId: 'suppliedId' in overrides ? overrides.suppliedId : 'plm-123',
    },
  };
}

describe('property key policy converters', () => {
  it('maps a policy resource into a dashboard model', () => {
    const model = toPropertyKeyPolicy(
      policy({
        id: 'policy-id',
        name: 'Allow policy',
        suppliedId: 'plm-123',
        createdAt: '2026-06-10T15:30:00Z',
        mode: PropertyKeyPolicyMode.Allowlist,
      })
    );

    expect(model).toEqual({
      id: 'policy-id',
      name: 'Allow policy',
      suppliedId: 'plm-123',
      createdAt: '2026-06-10T15:30:00Z',
      mode: 'allowlist',
    });
  });

  it('maps a page of policies into dashboard rows', () => {
    const page = toPropertyKeyPolicyPage({
      cursors: { self: 'self', next: 'next' },
      data: [
        policy({
          id: 'policy-id',
          name: 'Deny policy',
          suppliedId: 'plm-456',
          createdAt: '2026-06-10T15:30:00Z',
          mode: PropertyKeyPolicyMode.Denylist,
        }),
      ],
      status: 200,
    });

    expect(page).toEqual({
      cursors: { self: 'self', next: 'next' },
      items: [
        {
          id: 'policy-id',
          name: 'Deny policy',
          suppliedId: 'plm-456',
          createdAt: '2026-06-10T15:30:00Z',
          mode: 'denylist',
        },
      ],
    });
  });

  it('maps a key resource into a dashboard key preserving key case', () => {
    const key = toPropertyKeyPolicyKey({
      type: 'property-key',
      id: 'key-id',
      attributes: { name: 'MixedCaseKey' },
    });

    expect(key).toEqual({ id: 'key-id', name: 'MixedCaseKey' });
  });
});
