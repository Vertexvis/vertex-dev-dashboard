import { http, HttpResponse } from 'msw';
import type { Session } from 'next-iron-session';

import { installJsdomMockServer } from '../../../../test/msw/installJsdomMockServer';
import { server } from '../../../../test/msw/server';
import { CredsKey, EnvKey, NextIronRequest, TokenKey } from '../../../lib/with-session';
import {
  createPolicySwitch,
  createStreamKey,
  encodeCreds,
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

describe('policy stream keys', () => {
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

  it('includes a policy id when creating a stream key', async () => {
    const captured = captureBody();

    await expect(createStreamKey('scene-1', 'policy-1')).resolves.toBe('stream-key-1');
    expect(captured.current).toEqual({
      id: 'scene-1',
      propertyKeyPolicyId: 'policy-1',
    });
  });

  it('recreates credentials and a shareable URL for a policy switch', async () => {
    captureBody();

    const switched = await createPolicySwitch({
      sceneId: 'scene-1',
      clientId: 'client-id',
      vertexEnv: 'platdev',
      policyId: 'policy-1',
    });

    expect(switched.credentials.streamKey).toBe('stream-key-1');
    expect(switched.url).toContain('policyId=policy-1');
  });

  it('omits policyId from unrestricted share links', () => {
    expect(
      encodeCreds({
        clientId: 'client-id',
        streamKey: 'stream-key-1',
        vertexEnv: 'platdev',
        sceneId: 'scene-1',
      })
    ).not.toContain('policyId');
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
