/**
 * @jest-environment node
 */
import type { NextApiResponse } from 'next';

import { NextIronRequest } from '../../../lib/with-session';
import { handleFileById } from '../../../pages/api/files/[id]';

const mockGetFile = jest.fn();

jest.mock('../../../lib/vertex-api', () => ({
  getClientFromSession: jest.fn(() => ({
    files: { getFile: mockGetFile },
  })),
}));

describe('file by id route', () => {
  beforeEach(() => {
    mockGetFile.mockReset();
  });

  it('returns the single file so a deep link can hydrate the drawer', async () => {
    const file = {
      id: 'file-1',
      type: 'file',
      attributes: { name: 'alpha.jt', status: 'complete' },
    };
    mockGetFile.mockResolvedValue({ data: { data: file } });
    const res = createResponse();

    await handleFileById(
      {
        method: 'GET',
        query: { id: 'file-1' },
        session: {},
      } as unknown as NextIronRequest,
      res as unknown as NextApiResponse
    );

    expect(mockGetFile).toHaveBeenCalledWith({ id: 'file-1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(file);
  });

  it('returns a 400 when the id is missing', async () => {
    const res = createResponse();

    await handleFileById(
      { method: 'GET', query: {}, session: {} } as unknown as NextIronRequest,
      res as unknown as NextApiResponse
    );

    expect(mockGetFile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects non-GET methods', async () => {
    const res = createResponse();

    await handleFileById(
      {
        method: 'POST',
        query: { id: 'file-1' },
        session: {},
      } as unknown as NextIronRequest,
      res as unknown as NextApiResponse
    );

    expect(mockGetFile).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
  });
});

function createResponse(): {
  json: jest.Mock;
  redirect: jest.Mock;
  status: jest.Mock;
} {
  const res = {
    json: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}
