import { CommuteProfile, SourceResult } from '../types';

export interface CommuteDataSource<TOutput = unknown> {
  key: string;
  timeoutMs: number;
  fetch(profile: CommuteProfile): Promise<TOutput>;
}

export type { SourceResult };
