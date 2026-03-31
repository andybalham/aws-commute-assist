import { getDepartures, getServiceMessages } from '../services/railService';
import { mockArrivalsAndDepartures } from '../__mocks__/darwin-ldb-node';

jest.mock('../config', () => ({
  config: {
    darwinApiKey: 'test-darwin-key',
  },
}));

describe('railService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getDepartures', () => {
    it('parses darwin-ldb-node response into TrainService array', async () => {
      mockArrivalsAndDepartures.mockResolvedValue({
        trainServices: [
          {
            std: '07:30',
            etd: 'On time',
            platform: '2',
            operator: 'Southern',
            cancelled: false,
            callingPoints: {
              to: {
                VIC: [
                  { locationName: 'Haywards Heath', crs: 'HHE', st: '07:45', et: 'On time' },
                  { locationName: 'East Croydon', crs: 'ECR', st: '08:05', et: 'On time' },
                  { locationName: 'London Victoria', crs: 'VIC', st: '08:20', et: 'On time' },
                ],
              },
            },
          },
          {
            std: '07:45',
            etd: '07:52',
            platform: '1',
            operator: 'Southern',
            cancelled: false,
            callingPoints: {
              to: {
                VIC: [
                  { locationName: 'London Victoria', crs: 'VIC', st: '08:30', et: '08:37' },
                ],
              },
            },
          },
          {
            std: '07:50',
            etd: 'Cancelled',
            platform: null,
            operator: 'Thameslink',
            cancelled: true,
            callingPoints: { to: {} },
          },
        ],
      });

      const result = await getDepartures('BTN', 'VIC', '07:30');

      expect(result.services).toHaveLength(3);

      // First service — on time
      expect(result.services[0]).toMatchObject({
        scheduledTime: '07:30',
        expectedTime: '07:30',
        platform: '2',
        operator: 'Southern',
        status: 'on-time',
      });
      expect(result.services[0].callingPoints).toContain('East Croydon');

      // Second service — delayed
      expect(result.services[1]).toMatchObject({
        scheduledTime: '07:45',
        expectedTime: '07:52',
        status: 'delayed',
      });

      // Third service — cancelled
      expect(result.services[2]).toMatchObject({
        scheduledTime: '07:50',
        status: 'cancelled',
      });
    });

    it('returns empty services when no trains available', async () => {
      mockArrivalsAndDepartures.mockResolvedValue({
        trainServices: [],
      });

      const result = await getDepartures('BTN', 'VIC', '07:30');
      expect(result.services).toHaveLength(0);
    });

    it('propagates API errors', async () => {
      mockArrivalsAndDepartures.mockRejectedValue(new Error('Darwin API error'));
      await expect(getDepartures('BTN', 'VIC', '07:30')).rejects.toThrow('Darwin API error');
    });
  });

  describe('getServiceMessages', () => {
    it('returns empty array (messages not yet supported via darwin-ldb-node)', async () => {
      mockArrivalsAndDepartures.mockResolvedValue({
        trainServices: [],
      });

      const messages = await getServiceMessages('BTN');
      expect(messages).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mockArrivalsAndDepartures.mockRejectedValue(new Error('timeout'));

      const messages = await getServiceMessages('BTN');
      expect(messages).toEqual([]);
    });
  });
});
