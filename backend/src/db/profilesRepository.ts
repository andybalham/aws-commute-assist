import {
  QueryCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from './dynamoClient';
import { config } from '../config';
import { CommuteProfile } from '../types';

const TableName = config.dynamoDbTableName;

export async function listProfiles(userId: string): Promise<CommuteProfile[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: { ':uid': userId },
    })
  );
  return (result.Items ?? []) as CommuteProfile[];
}

export async function getProfile(
  userId: string,
  profileId: string
): Promise<CommuteProfile | null> {
  const result = await docClient.send(
    new GetCommand({ TableName, Key: { userId, profileId } })
  );
  return (result.Item as CommuteProfile) ?? null;
}

export async function putProfile(profile: CommuteProfile): Promise<void> {
  await docClient.send(new PutCommand({ TableName, Item: profile }));
}

export async function deleteProfile(
  userId: string,
  profileId: string
): Promise<void> {
  await docClient.send(
    new DeleteCommand({ TableName, Key: { userId, profileId } })
  );
}

export async function activateProfile(
  userId: string,
  profileId: string
): Promise<void> {
  const profiles = await listProfiles(userId);
  const target = profiles.find((p) => p.profileId === profileId);
  if (!target) {
    throw new Error('Profile not found');
  }

  const now = new Date().toISOString();
  const transactItems = profiles.map((p) => ({
    Put: {
      TableName,
      Item: {
        ...p,
        isActive: p.profileId === profileId,
        updatedAt: now,
      },
    },
  }));

  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));
}
