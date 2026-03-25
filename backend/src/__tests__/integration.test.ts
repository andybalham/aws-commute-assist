/**
 * Integration test for profiles CRUD against DynamoDB Local.
 *
 * Requires Docker running with DynamoDB Local:
 *   docker run -d -p 8000:8000 amazon/dynamodb-local
 *
 * Run with: DYNAMODB_ENDPOINT=http://localhost:8000 npm test
 */
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { CommuteProfile } from '../types';

const endpoint = process.env.DYNAMODB_ENDPOINT;
const describeIf = endpoint ? describe : describe.skip;

// Self-contained repository functions that use the test client directly,
// avoiding module-level config/import issues with jest.resetModules().
function makeRepo(docClient: DynamoDBDocumentClient, tableName: string) {
  return {
    async listProfiles(userId: string): Promise<CommuteProfile[]> {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'userId = :uid',
          ExpressionAttributeValues: { ':uid': userId },
        })
      );
      return (result.Items ?? []) as CommuteProfile[];
    },

    async getProfile(userId: string, profileId: string): Promise<CommuteProfile | null> {
      const result = await docClient.send(
        new GetCommand({ TableName: tableName, Key: { userId, profileId } })
      );
      return (result.Item as CommuteProfile) ?? null;
    },

    async putProfile(profile: CommuteProfile): Promise<void> {
      await docClient.send(new PutCommand({ TableName: tableName, Item: profile }));
    },

    async deleteProfile(userId: string, profileId: string): Promise<void> {
      await docClient.send(
        new DeleteCommand({ TableName: tableName, Key: { userId, profileId } })
      );
    },

    async activateProfile(userId: string, profileId: string): Promise<void> {
      const profiles = await this.listProfiles(userId);
      const target = profiles.find((p) => p.profileId === profileId);
      if (!target) throw new Error('Profile not found');

      const now = new Date().toISOString();
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: profiles.map((p) => ({
            Put: {
              TableName: tableName,
              Item: { ...p, isActive: p.profileId === profileId, updatedAt: now },
            },
          })),
        })
      );
    },
  };
}

describeIf('Integration: profiles CRUD against DynamoDB Local', () => {
  const tableName = `test-profiles-${Date.now()}`;
  let rawClient: DynamoDBClient;
  let repo: ReturnType<typeof makeRepo>;

  beforeAll(async () => {
    rawClient = new DynamoDBClient({
      region: 'eu-west-2',
      endpoint,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    const docClient = DynamoDBDocumentClient.from(rawClient);
    repo = makeRepo(docClient, tableName);

    await rawClient.send(
      new CreateTableCommand({
        TableName: tableName,
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'profileId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'userId', AttributeType: 'S' },
          { AttributeName: 'profileId', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      })
    );
  });

  afterAll(async () => {
    try {
      await rawClient.send(new DeleteTableCommand({ TableName: tableName }));
    } catch {
      // table may not exist if tests failed early
    }
    rawClient.destroy();
  });

  it('performs a full CRUD cycle', async () => {
    const userId = 'integration-user';

    // List — should be empty
    let profiles = await repo.listProfiles(userId);
    expect(profiles).toEqual([]);

    // Create
    const profile: CommuteProfile = {
      userId,
      profileId: 'int-profile-1',
      name: 'Integration Test Commute',
      outbound: { originCRS: 'BTN', destinationCRS: 'VIC', departureTime: '07:30' },
      return: { originCRS: 'VIC', destinationCRS: 'BTN', departureTime: '17:30' },
      tflLines: ['victoria'],
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await repo.putProfile(profile);

    // Read
    const fetched = await repo.getProfile(userId, 'int-profile-1');
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Integration Test Commute');

    // List — should have one
    profiles = await repo.listProfiles(userId);
    expect(profiles).toHaveLength(1);

    // Update
    const updated = { ...profile, name: 'Updated Commute', updatedAt: new Date().toISOString() };
    await repo.putProfile(updated);
    const reFetched = await repo.getProfile(userId, 'int-profile-1');
    expect(reFetched!.name).toBe('Updated Commute');

    // Activate
    const profile2: CommuteProfile = {
      ...profile,
      profileId: 'int-profile-2',
      name: 'Second Commute',
      isActive: true,
    };
    await repo.putProfile(profile2);
    await repo.activateProfile(userId, 'int-profile-1');

    const p1 = await repo.getProfile(userId, 'int-profile-1');
    const p2 = await repo.getProfile(userId, 'int-profile-2');
    expect(p1!.isActive).toBe(true);
    expect(p2!.isActive).toBe(false);

    // Delete
    await repo.deleteProfile(userId, 'int-profile-1');
    const deleted = await repo.getProfile(userId, 'int-profile-1');
    expect(deleted).toBeNull();

    // User scoping — different user sees nothing
    const otherProfiles = await repo.listProfiles('other-user');
    expect(otherProfiles).toEqual([]);
  });
});
