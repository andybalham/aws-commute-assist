import axios from 'axios';
import { getDepartures, getServiceMessages } from '../services/railService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../config', () => ({
  config: {
    darwinApiKey: 'test-darwin-key',
  },
}));

const MOCK_DEPARTURE_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetDepartureBoardResponse xmlns="http://thalesgroup.com/RTTI/2021-11-01/ldb/">
      <GetStationBoardResult>
        <lt:trainServices xmlns:lt="http://thalesgroup.com/RTTI/2021-11-01/ldb/types">
          <lt:service>
            <lt:std>07:30</lt:std>
            <lt:etd>On time</lt:etd>
            <lt:platform>2</lt:platform>
            <lt:operatorName>Southern</lt:operatorName>
            <lt:destination>
              <lt:location>
                <lt:locationName>London Victoria</lt:locationName>
                <lt:crs>VIC</lt:crs>
              </lt:location>
            </lt:destination>
            <lt:subsequentCallingPoints>
              <lt:callingPointList>
                <lt:callingPoint>
                  <lt:locationName>Haywards Heath</lt:locationName>
                  <lt:crs>HHE</lt:crs>
                </lt:callingPoint>
                <lt:callingPoint>
                  <lt:locationName>East Croydon</lt:locationName>
                  <lt:crs>ECR</lt:crs>
                </lt:callingPoint>
                <lt:callingPoint>
                  <lt:locationName>London Victoria</lt:locationName>
                  <lt:crs>VIC</lt:crs>
                </lt:callingPoint>
              </lt:callingPointList>
            </lt:subsequentCallingPoints>
          </lt:service>
          <lt:service>
            <lt:std>07:45</lt:std>
            <lt:etd>07:52</lt:etd>
            <lt:platform>1</lt:platform>
            <lt:operatorName>Southern</lt:operatorName>
            <lt:destination>
              <lt:location>
                <lt:locationName>London Victoria</lt:locationName>
                <lt:crs>VIC</lt:crs>
              </lt:location>
            </lt:destination>
            <lt:subsequentCallingPoints>
              <lt:callingPointList>
                <lt:callingPoint>
                  <lt:locationName>London Victoria</lt:locationName>
                  <lt:crs>VIC</lt:crs>
                </lt:callingPoint>
              </lt:callingPointList>
            </lt:subsequentCallingPoints>
          </lt:service>
          <lt:service>
            <lt:std>07:50</lt:std>
            <lt:etd>Cancelled</lt:etd>
            <lt:operatorName>Thameslink</lt:operatorName>
            <lt:destination>
              <lt:location>
                <lt:locationName>London Victoria</lt:locationName>
                <lt:crs>VIC</lt:crs>
              </lt:location>
            </lt:destination>
          </lt:service>
        </lt:trainServices>
      </GetStationBoardResult>
    </GetDepartureBoardResponse>
  </soap:Body>
</soap:Envelope>`;

const MOCK_MESSAGES_RESPONSE = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetStationBoardResponse xmlns="http://thalesgroup.com/RTTI/2021-11-01/ldb/">
      <GetStationBoardResult>
        <lt:nrccMessages xmlns:lt="http://thalesgroup.com/RTTI/2021-11-01/ldb/types">
          <lt:message><p>Reduced service due to staff shortages.</p></lt:message>
          <lt:message><p>Check before you travel.</p></lt:message>
        </lt:nrccMessages>
      </GetStationBoardResult>
    </GetStationBoardResponse>
  </soap:Body>
</soap:Envelope>`;

describe('railService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getDepartures', () => {
    it('parses SOAP response into TrainService array', async () => {
      mockedAxios.post.mockResolvedValue({ data: MOCK_DEPARTURE_RESPONSE });

      const result = await getDepartures('BTN', 'VIC', '07:30');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('OpenLDBWS'),
        expect.stringContaining('test-darwin-key'),
        expect.any(Object)
      );

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

    it('propagates API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('SOAP fault'));
      await expect(getDepartures('BTN', 'VIC', '07:30')).rejects.toThrow('SOAP fault');
    });
  });

  describe('getServiceMessages', () => {
    it('extracts and strips HTML from messages', async () => {
      mockedAxios.post.mockResolvedValue({ data: MOCK_MESSAGES_RESPONSE });

      const messages = await getServiceMessages('BTN');

      expect(messages).toEqual([
        'Reduced service due to staff shortages.',
        'Check before you travel.',
      ]);
    });

    it('returns empty array on error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('timeout'));

      const messages = await getServiceMessages('BTN');
      expect(messages).toEqual([]);
    });
  });
});
