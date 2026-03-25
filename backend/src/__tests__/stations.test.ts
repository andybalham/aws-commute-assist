import { searchStations, getStationByCrs, isValidCrs, isValidTflLine } from '../data/stations';

describe('stations', () => {
  describe('getStationByCrs', () => {
    it('returns a station for a valid CRS', () => {
      const station = getStationByCrs('BTN');
      expect(station).toBeDefined();
      expect(station!.name).toBe('Brighton');
    });

    it('is case-insensitive', () => {
      expect(getStationByCrs('btn')).toBeDefined();
    });

    it('returns undefined for unknown CRS', () => {
      expect(getStationByCrs('ZZZ')).toBeUndefined();
    });
  });

  describe('searchStations', () => {
    it('returns results for a name prefix', () => {
      const results = searchStations('Bright');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Brighton');
    });

    it('returns results for a CRS code match', () => {
      const results = searchStations('BTN');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].crs).toBe('BTN');
    });

    it('returns results for a substring match', () => {
      const results = searchStations('Victoria');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty for empty query', () => {
      expect(searchStations('')).toEqual([]);
    });

    it('limits results to 10', () => {
      const results = searchStations('London');
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('isValidCrs', () => {
    it('returns true for valid CRS', () => {
      expect(isValidCrs('VIC')).toBe(true);
    });

    it('returns false for invalid CRS', () => {
      expect(isValidCrs('ZZZ')).toBe(false);
    });
  });

  describe('isValidTflLine', () => {
    it('returns true for valid lines', () => {
      expect(isValidTflLine('victoria')).toBe(true);
      expect(isValidTflLine('northern')).toBe(true);
    });

    it('returns false for invalid lines', () => {
      expect(isValidTflLine('fake')).toBe(false);
    });
  });
});
