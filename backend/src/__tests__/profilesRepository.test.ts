import {
  listProfiles,
  getProfile,
  putProfile,
  deleteProfile,
  activateProfile,
} from '../db/profilesRepository';
import { CommuteProfile } from '../types';

// Mock the DynamoDB Document Client
const mockSend = jest.fn();
jest.mock('../db/dynamoClient', () => ({
  docClient: { send: (...args: unknown[]) => mockSend(...args) },
}));

function makeProfile(overrides: Partial<CommuteProfile> = {}): CommuteProfile {
  return {
    userId: 'user-1',
    profileId: 'profile-1',
    name: 'Test Commute',
    outbound: { originCRS: 'BTN', destinationCRS: 'VIC', departureTime: '07:30' },
    return: { originCRS: 'VIC', destinationCRS: 'BTN', departureTime: '17:30' },
    tflLines: ['victoria'],
    isActive: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockSend.mockReset();
});

describe('profilesRepository', () => {
  describe('listProfiles', () => {
    it('returns profiles for a user', async () => {
      const profiles = [makeProfile(), makeProfile({ profileId: 'profile-2' })];
      mockSend.mockResolvedValue({ Items: profiles });

      const result = await listProfiles('user-1');
      expect(result).toEqual(profiles);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no profiles exist', async () => {
      mockSend.mockResolvedValue({ Items: undefined });

      const result = await listProfiles('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getProfile', () => {
    it('returns a profile when found', async () => {
      const profile = makeProfile();
      mockSend.mockResolvedValue({ Item: profile });

      const result = await getProfile('user-1', 'profile-1');
      expect(result).toEqual(profile);
    });

    it('returns null when not found', async () => {
      mockSend.mockResolvedValue({ Item: undefined });

      const result = await getProfile('user-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('putProfile', () => {
    it('sends a PutCommand', async () => {
      mockSend.mockResolvedValue({});
      const profile = makeProfile();

      await putProfile(profile);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteProfile', () => {
    it('sends a DeleteCommand', async () => {
      mockSend.mockResolvedValue({});

      await deleteProfile('user-1', 'profile-1');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('activateProfile', () => {
    it('activates the target profile and deactivates others', async () => {
      const profiles = [
        makeProfile({ profileId: 'p1', isActive: true }),
        makeProfile({ profileId: 'p2', isActive: false }),
      ];
      // First call: listProfiles (Query), Second call: TransactWrite
      mockSend
        .mockResolvedValueOnce({ Items: profiles })
        .mockResolvedValueOnce({});

      await activateProfile('user-1', 'p2');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('throws when profile not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(activateProfile('user-1', 'nonexistent')).rejects.toThrow(
        'Profile not found'
      );
    });
  });
});
