import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '../config';

const client = new DynamoDBClient({
  region: config.awsRegion,
  ...(config.dynamoDbEndpoint ? { endpoint: config.dynamoDbEndpoint } : {}),
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
