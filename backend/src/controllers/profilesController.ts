import crypto from 'crypto';
import { RouteContext, RouteResponse, CommuteProfile } from '../types';

export function listProfiles(_ctx: RouteContext): RouteResponse {
  return { statusCode: 200, body: [] };
}

export function createProfile(ctx: RouteContext): RouteResponse {
  const now = new Date().toISOString();
  const profile: CommuteProfile = {
    ...(ctx.body as Omit<CommuteProfile, 'userId' | 'profileId' | 'createdAt' | 'updatedAt'>),
    userId: ctx.userId,
    profileId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  return { statusCode: 201, body: profile };
}

export function updateProfile(_ctx: RouteContext): RouteResponse {
  return { statusCode: 200, body: { message: 'Profile updated (stub)' } };
}

export function deleteProfile(_ctx: RouteContext): RouteResponse {
  return { statusCode: 204, body: null };
}
