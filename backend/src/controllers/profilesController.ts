import crypto from 'crypto';
import { RouteContext, RouteResponse, CommuteProfile } from '../types';
import * as repo from '../db/profilesRepository';
import { validateProfile } from '../validation';

export async function listProfiles(ctx: RouteContext): Promise<RouteResponse> {
  const profiles = await repo.listProfiles(ctx.userId);
  return { statusCode: 200, body: profiles };
}

export async function createProfile(ctx: RouteContext): Promise<RouteResponse> {
  const errors = validateProfile(ctx.body);
  if (errors.length > 0) {
    return { statusCode: 400, body: { errors } };
  }

  const now = new Date().toISOString();
  const body = ctx.body as Partial<CommuteProfile>;
  const profile: CommuteProfile = {
    userId: ctx.userId,
    profileId: crypto.randomUUID(),
    name: body.name!,
    outbound: body.outbound!,
    return: body.return!,
    tflLines: body.tflLines ?? [],
    isActive: false,
    createdAt: now,
    updatedAt: now,
  };

  await repo.putProfile(profile);
  return { statusCode: 201, body: profile };
}

export async function updateProfile(ctx: RouteContext): Promise<RouteResponse> {
  const { profileId } = ctx.params;

  const existing = await repo.getProfile(ctx.userId, profileId);
  if (!existing) {
    return { statusCode: 404, body: { error: 'Profile not found' } };
  }

  const errors = validateProfile(ctx.body);
  if (errors.length > 0) {
    return { statusCode: 400, body: { errors } };
  }

  const body = ctx.body as Partial<CommuteProfile>;
  const updated: CommuteProfile = {
    ...existing,
    name: body.name!,
    outbound: body.outbound!,
    return: body.return!,
    tflLines: body.tflLines ?? [],
    updatedAt: new Date().toISOString(),
  };

  await repo.putProfile(updated);
  return { statusCode: 200, body: updated };
}

export async function deleteProfile(ctx: RouteContext): Promise<RouteResponse> {
  const { profileId } = ctx.params;

  const existing = await repo.getProfile(ctx.userId, profileId);
  if (!existing) {
    return { statusCode: 404, body: { error: 'Profile not found' } };
  }

  await repo.deleteProfile(ctx.userId, profileId);
  return { statusCode: 204, body: null };
}

export async function activateProfile(ctx: RouteContext): Promise<RouteResponse> {
  const { profileId } = ctx.params;

  try {
    await repo.activateProfile(ctx.userId, profileId);
    return { statusCode: 200, body: { message: 'Profile activated' } };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Profile not found') {
      return { statusCode: 404, body: { error: 'Profile not found' } };
    }
    throw err;
  }
}
