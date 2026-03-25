import { validateProfile } from '../validation';

describe('validateProfile', () => {
  const valid = {
    name: 'My Commute',
    outbound: { originCRS: 'BTN', destinationCRS: 'VIC', departureTime: '07:30' },
    return: { originCRS: 'VIC', destinationCRS: 'BTN', departureTime: '17:30' },
    tflLines: ['victoria'],
  };

  it('passes for a valid profile', () => {
    expect(validateProfile(valid)).toEqual([]);
  });

  it('fails for non-object body', () => {
    expect(validateProfile(null)).toHaveLength(1);
    expect(validateProfile('string')).toHaveLength(1);
  });

  it('fails when name is missing', () => {
    const errors = validateProfile({ ...valid, name: '' });
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('fails for unknown CRS code', () => {
    const errors = validateProfile({
      ...valid,
      outbound: { ...valid.outbound, originCRS: 'ZZZ' },
    });
    expect(errors.some((e) => e.field === 'outbound.originCRS')).toBe(true);
  });

  it('fails for invalid departure time format', () => {
    const errors = validateProfile({
      ...valid,
      outbound: { ...valid.outbound, departureTime: '7:30' },
    });
    expect(errors.some((e) => e.field === 'outbound.departureTime')).toBe(true);
  });

  it('fails for out-of-range departure time', () => {
    const errors = validateProfile({
      ...valid,
      outbound: { ...valid.outbound, departureTime: '25:00' },
    });
    expect(errors.some((e) => e.field === 'outbound.departureTime')).toBe(true);
  });

  it('fails for non-array tflLines', () => {
    const errors = validateProfile({ ...valid, tflLines: 'victoria' });
    expect(errors.some((e) => e.field === 'tflLines')).toBe(true);
  });

  it('fails for unknown TfL line ID', () => {
    const errors = validateProfile({ ...valid, tflLines: ['fake-line'] });
    expect(errors.some((e) => e.field === 'tflLines')).toBe(true);
  });

  it('passes when tflLines is omitted', () => {
    const { tflLines, ...noTfl } = valid;
    expect(validateProfile(noTfl)).toEqual([]);
  });
});
