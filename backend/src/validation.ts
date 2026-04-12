import { z, ZodError } from 'zod';
import { isValidCrs, isValidTflLine } from './data/stations';

export interface ValidationError {
  field: string;
  message: string;
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const crsField = (fieldName: 'originCRS' | 'destinationCRS') =>
  z
    .string({ error: () => `${fieldName} is required` })
    .min(1, `${fieldName} is required`)
    .refine(isValidCrs, { error: (ctx) => `Unknown station CRS: ${ctx.input}` });

const LegSchema = z.object({
  originCRS: crsField('originCRS'),
  destinationCRS: crsField('destinationCRS'),
  departureTime: z
    .string({ error: () => 'departureTime is required' })
    .min(1, 'departureTime is required')
    .regex(TIME_REGEX, 'departureTime must be in HH:MM format (00:00–23:59)'),
});

export const ProfileSchema = z.object({
  name: z
    .string({ error: () => 'name is required and must be a non-empty string' })
    .refine((v) => v.trim().length > 0, 'name is required and must be a non-empty string'),
  outbound: LegSchema,
  return: LegSchema,
  tflLines: z
    .array(z.unknown(), { error: () => 'tflLines must be an array' })
    .default([])
    .superRefine((lines, ctx) => {
      for (const line of lines) {
        if (typeof line !== 'string' || !isValidTflLine(line)) {
          ctx.addIssue({ code: 'custom', message: `Unknown TfL line ID: ${String(line)}` });
        }
      }
    })
    .transform((lines) => lines as string[]),
});

export type ProfileInput = z.infer<typeof ProfileSchema>;

function zodToFieldErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

export function validateProfile(body: unknown): ValidationError[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return [{ field: 'body', message: 'Request body must be a JSON object' }];
  }
  const result = ProfileSchema.safeParse(body);
  if (result.success) return [];
  return zodToFieldErrors(result.error);
}

export function parseProfile(body: unknown): ProfileInput {
  return ProfileSchema.parse(body);
}
