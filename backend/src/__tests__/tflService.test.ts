import axios from 'axios';
import { getLineStatuses } from '../services/tflService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../config', () => ({
  config: {
    tflAppId: 'test-id',
    tflAppKey: 'test-key',
  },
}));

const MOCK_TFL_RESPONSE = {
  data: [
    {
      id: 'victoria',
      name: 'Victoria',
      lineStatuses: [
        {
          statusSeverityDescription: 'Good Service',
          reason: null,
        },
      ],
    },
    {
      id: 'district',
      name: 'District',
      lineStatuses: [
        {
          statusSeverityDescription: 'Minor Delays',
          reason: 'Minor delays due to signal failure at Earl\'s Court',
        },
      ],
    },
  ],
};

describe('tflService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns line statuses for requested lines', async () => {
    mockedAxios.get.mockResolvedValue(MOCK_TFL_RESPONSE);

    const result = await getLineStatuses(['victoria', 'district']);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.tfl.gov.uk/Line/victoria,district/Status',
      expect.objectContaining({
        params: { app_id: 'test-id', app_key: 'test-key' },
      })
    );

    expect(result).toEqual([
      {
        lineId: 'victoria',
        lineName: 'Victoria',
        status: 'Good Service',
        reason: null,
      },
      {
        lineId: 'district',
        lineName: 'District',
        status: 'Minor Delays',
        reason: "Minor delays due to signal failure at Earl's Court",
      },
    ]);
  });

  it('returns empty array for empty lineIds', async () => {
    const result = await getLineStatuses([]);
    expect(result).toEqual([]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('propagates API errors', async () => {
    mockedAxios.get.mockRejectedValue(new Error('TfL API down'));

    await expect(getLineStatuses(['victoria'])).rejects.toThrow('TfL API down');
  });
});
