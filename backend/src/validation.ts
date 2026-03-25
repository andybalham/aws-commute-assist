import { isValidCrs, isValidTflLine } from './data/stations';

export interface ValidationError {
  field: string;
  message: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLeg(
  leg: unknown,
  prefix: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isObject(leg)) {
    errors.push({ field: prefix, message: `${prefix} must be an object` });
    return errors;
  }

  if (typeof leg.originCRS !== 'string' || !leg.originCRS) {
    errors.push({ field: `${prefix}.originCRS`, message: 'originCRS is required' });
  } else if (!isValidCrs(leg.originCRS)) {
    errors.push({ field: `${prefix}.originCRS`, message: `Unknown station CRS: ${leg.originCRS}` });
  }

  if (typeof leg.destinationCRS !== 'string' || !leg.destinationCRS) {
    errors.push({ field: `${prefix}.destinationCRS`, message: 'destinationCRS is required' });
  } else if (!isValidCrs(leg.destinationCRS)) {
    errors.push({ field: `${prefix}.destinationCRS`, message: `Unknown station CRS: ${leg.destinationCRS}` });
  }

  if (typeof leg.departureTime !== 'string' || !leg.departureTime) {
    errors.push({ field: `${prefix}.departureTime`, message: 'departureTime is required' });
  } else if (!TIME_REGEX.test(leg.departureTime)) {
    errors.push({
      field: `${prefix}.departureTime`,
      message: 'departureTime must be in HH:MM format (00:00–23:59)',
    });
  }

  return errors;
}

export function validateProfile(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isObject(body)) {
    errors.push({ field: 'body', message: 'Request body must be a JSON object' });
    return errors;
  }

  if (typeof body.name !== 'string' || !body.name.trim()) {
    errors.push({ field: 'name', message: 'name is required and must be a non-empty string' });
  }

  errors.push(...validateLeg(body.outbound, 'outbound'));
  errors.push(...validateLeg(body.return, 'return'));

  if (body.tflLines !== undefined) {
    if (!Array.isArray(body.tflLines)) {
      errors.push({ field: 'tflLines', message: 'tflLines must be an array' });
    } else {
      for (const lineId of body.tflLines) {
        if (typeof lineId !== 'string' || !isValidTflLine(lineId)) {
          errors.push({ field: 'tflLines', message: `Unknown TfL line ID: ${lineId}` });
        }
      }
    }
  }

  return errors;
}
