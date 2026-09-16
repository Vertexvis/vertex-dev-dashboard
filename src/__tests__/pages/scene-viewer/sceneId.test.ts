import { http, HttpResponse } from 'msw';
import type { Session } from 'next-iron-session';

import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { CredsKey, EnvKey, NextIronRequest, TokenKey } from '../../../lib/with-session';
import {
  createPolicySwitch,
  createStreamKey,
  encodeCreds,
  normalizeOptionalQueryValue,
  serverSidePropsHandler,
} from '../../../pages/scene-viewer/[sceneId]';

describe('scene viewer route', () => {
  it('does not create a stream key while serving a scene route', () => {
    const result = serverSidePropsHandler({
      query: { sceneId: 'scene-1' },
      req: createReq(),
    });

    expect(result).toEqual({
      props: {
        clientId: 'client-id',
        networkConfig: undefined,
        vertexEnv: 'platdev',
      },
    });
  });

  it('does not mutate when a supplied stream key is present', () => {
    const result = serverSidePropsHandler({
      query: { sceneId: 'scene-1', streamKey: 'provided-key' },
      req: createReq(),
    });

    expect(result).toEqual({
      props: {
        clientId: 'client-id',
        networkConfig: undefined,
        vertexEnv: 'platdev',
      },
    });
  });
});

describe('createStreamKey', () => {
  installJsdomMockServer();

  function captureBody(): { current?: Record<string, unknown> } {
    const captured: { current?: Record<string, unknown> } = {};
    server.use(
      http.post('*/api/stream-keys', async ({ request }) => {
        captured.current = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ key: 'stream-key-1', status: 200 });
      })
    );
    return captured;
  }

  it('includes propertyKeyPolicyId when a policy is applied', async () => {
    const captured = captureBody();

    const key = await createStreamKey('scene-1', 'policy-1');

    expect(key).toBe('stream-key-1');
    expect(captured.current).toEqual({
      id: 'scene-1',
      propertyKeyPolicyId: 'policy-1',
    });
  });

  it('omits propertyKeyPolicyId when no policy is applied', async () => {
    const captured = captureBody();

    const key = await createStreamKey('scene-1');

    expect(key).toBe('stream-key-1');
    expect(captured.current).toEqual({ id: 'scene-1' });
    expect(captured.current).not.toHaveProperty('propertyKeyPolicyId');
  });
});

describe('createPolicySwitch', () => {
  installJsdomMockServer();

  function captureBody(): { current?: Record<string, unknown> } {
    const captured: { current?: Record<string, unknown> } = {};
    server.use(
      http.post('*/api/stream-keys', async ({ request }) => {
        captured.current = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ key: 'switched-key', status: 200 });
      })
    );
    return captured;
  }

  it('recreates the stream key under the new policy and derives creds + url', async () => {
    // Drives the in-viewer switch: this is the core of handlePolicyChange,
    // which retains the selected item (state left untouched) while the stream
    // key, credentials, and URL are rebuilt under the new policy.
    const captured = captureBody();

    const { streamKey, credentials, url } = await createPolicySwitch({
      sceneId: 'scene-1',
      clientId: 'client-id',
      vertexEnv: 'platdev',
      policyId: 'policy-2',
    });

    // A NEW stream key POST carries the new propertyKeyPolicyId.
    expect(captured.current).toEqual({
      id: 'scene-1',
      propertyKeyPolicyId: 'policy-2',
    });
    expect(streamKey).toBe('switched-key');
    // Credentials reconnect the viewer with the new key.
    expect(credentials).toEqual({
      clientId: 'client-id',
      streamKey: 'switched-key',
      vertexEnv: 'platdev',
    });
    // URL round-trips the new key + policy for shareability.
    expect(url).toContain('streamKey=switched-key');
    expect(url).toContain('policyId=policy-2');
  });

  it('switches to the unrestricted policy (no propertyKeyPolicyId, no policyId in url)', async () => {
    const captured = captureBody();

    const { url } = await createPolicySwitch({
      sceneId: 'scene-1',
      clientId: 'client-id',
      vertexEnv: 'platdev',
    });

    expect(captured.current).toEqual({ id: 'scene-1' });
    expect(captured.current).not.toHaveProperty('propertyKeyPolicyId');
    expect(url).not.toContain('policyId');
  });
});

describe('encodeCreds', () => {
  it('round-trips policyId through the URL when present', () => {
    const url = encodeCreds({
      clientId: 'client-id',
      streamKey: 'stream-key-1',
      vertexEnv: 'platdev',
      sceneId: 'scene-1',
      policyId: 'policy-1',
    });

    expect(url).toContain('policyId=policy-1');
  });

  it('omits policyId from the URL when absent', () => {
    const url = encodeCreds({
      clientId: 'client-id',
      streamKey: 'stream-key-1',
      vertexEnv: 'platdev',
      sceneId: 'scene-1',
    });

    expect(url).not.toContain('policyId');
  });
});

describe('normalizeOptionalQueryValue', () => {
  it('normalizes absent and whitespace-only policy IDs to undefined', () => {
    expect(normalizeOptionalQueryValue()).toBeUndefined();
    expect(normalizeOptionalQueryValue('  ')).toBeUndefined();
  });

  it('trims usable policy IDs', () => {
    expect(normalizeOptionalQueryValue(' policy-1 ')).toBe('policy-1');
  });
});

function createReq(): NextIronRequest {
  const values = new Map<string, unknown>([
    [CredsKey, { id: 'client-id', secret: 'client-secret' }],
    [EnvKey, 'platdev'],
    [
      TokenKey,
      {
        expiration: Date.now() + 60 * 60 * 1000,
        token: {
          access_token: 'test-token',
          account_id: 'account-id',
          expires_in: 60 * 60,
          scopes: [],
          token_type: 'Bearer',
        },
      },
    ],
  ]);

  const session = {
    get: (key: string) => values.get(key),
  } as Session;
  return { session } as NextIronRequest;
}
