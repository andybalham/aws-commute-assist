import { RouteContext } from '../types';
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  activateProfile,
} from '../controllers/profilesController';

// Mock the repository
jest.mock('../db/profilesRepository');
const repo = jest.requireMock('../db/profilesRepository') as {
  listProfiles: jest.Mock;
  getProfile: jest.Mock;
  putProfile: jest.Mock;
  deleteProfile: jest.Mock;
  activateProfile: jest.Mock;
};

function makeCtx(overrides: Partial<RouteContext> = {}): RouteContext {
  return {
    method: 'GET',
    path: '/api/profiles',
    params: {},
    query: {},
    body: null,
    userId: 'user-1',
    ...overrides,
  };
}

const validProfileBody = {
  name: 'My Commute',
  outbound: { originCRS: 'BTN', destinationCRS: 'VIC', departureTime: '07:30' },
  return: { originCRS: 'VIC', destinationCRS: 'BTN', departureTime: '17:30' },
  tflLines: ['victoria'],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('profilesController', () => {
  describe('listProfiles', () => {
    it('returns profiles from the repository', async () => {
      repo.listProfiles.mockResolvedValue([{ profileId: 'p1' }]);

      const res = await listProfiles(makeCtx());
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([{ profileId: 'p1' }]);
    });
  });

  describe('createProfile', () => {
    it('creates a valid profile and returns 201', async () => {
      repo.putProfile.mockResolvedValue(undefined);

      const res = await createProfile(makeCtx({ body: validProfileBody }));
      expect(res.statusCode).toBe(201);
      const body = res.body as Record<string, unknown>;
      expect(body.name).toBe('My Commute');
      expect(body.userId).toBe('user-1');
      expect(body.profileId).toBeDefined();
      expect(repo.putProfile).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for invalid body', async () => {
      const res = await createProfile(makeCtx({ body: {} }));
      expect(res.statusCode).toBe(400);
      const body = res.body as { errors: unknown[] };
      expect(body.errors.length).toBeGreaterThan(0);
    });

    it('returns 400 for invalid CRS code', async () => {
      const res = await createProfile(
        makeCtx({
          body: {
            ...validProfileBody,
            outbound: { ...validProfileBody.outbound, originCRS: 'ZZZ' },
          },
        })
      );
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid departure time', async () => {
      const res = await createProfile(
        makeCtx({
          body: {
            ...validProfileBody,
            outbound: { ...validProfileBody.outbound, departureTime: '25:00' },
          },
        })
      );
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid TfL line', async () => {
      const res = await createProfile(
        makeCtx({
          body: { ...validProfileBody, tflLines: ['invalid-line'] },
        })
      );
      expect(res.statusCode).toBe(400);
    });
  });

  describe('updateProfile', () => {
    it('updates an existing profile', async () => {
      repo.getProfile.mockResolvedValue({
        userId: 'user-1',
        profileId: 'p1',
        ...validProfileBody,
        isActive: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
      repo.putProfile.mockResolvedValue(undefined);

      const res = await updateProfile(
        makeCtx({ params: { profileId: 'p1' }, body: validProfileBody })
      );
      expect(res.statusCode).toBe(200);
      expect(repo.putProfile).toHaveBeenCalledTimes(1);
    });

    it('returns 404 if profile does not exist', async () => {
      repo.getProfile.mockResolvedValue(null);

      const res = await updateProfile(
        makeCtx({ params: { profileId: 'p1' }, body: validProfileBody })
      );
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 for invalid body on update', async () => {
      repo.getProfile.mockResolvedValue({ profileId: 'p1' });

      const res = await updateProfile(
        makeCtx({ params: { profileId: 'p1' }, body: {} })
      );
      expect(res.statusCode).toBe(400);
    });
  });

  describe('deleteProfile', () => {
    it('deletes an existing profile', async () => {
      repo.getProfile.mockResolvedValue({ profileId: 'p1' });
      repo.deleteProfile.mockResolvedValue(undefined);

      const res = await deleteProfile(makeCtx({ params: { profileId: 'p1' } }));
      expect(res.statusCode).toBe(204);
    });

    it('returns 404 if profile does not exist', async () => {
      repo.getProfile.mockResolvedValue(null);

      const res = await deleteProfile(makeCtx({ params: { profileId: 'p1' } }));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('activateProfile', () => {
    it('activates a profile', async () => {
      repo.activateProfile.mockResolvedValue(undefined);

      const res = await activateProfile(makeCtx({ params: { profileId: 'p1' } }));
      expect(res.statusCode).toBe(200);
    });

    it('returns 404 if profile not found', async () => {
      repo.activateProfile.mockRejectedValue(new Error('Profile not found'));

      const res = await activateProfile(makeCtx({ params: { profileId: 'p1' } }));
      expect(res.statusCode).toBe(404);
    });
  });
});
