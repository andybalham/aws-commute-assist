import dotenv from 'dotenv';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  awsRegion: process.env.AWS_REGION || 'eu-west-2',
  dynamoDbEndpoint: process.env.DYNAMODB_ENDPOINT,
  dynamoDbTableName: process.env.DYNAMODB_TABLE_NAME || 'commute-profiles',
  darwinApiKey: process.env.DARWIN_API_KEY || '',
  tflAppId: process.env.TFL_APP_ID || '',
  tflAppKey: process.env.TFL_APP_KEY || '',
};

let _initialized = false;

async function fetchSsmParam(client: SSMClient, name: string): Promise<string> {
  const result = await client.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );
  return result.Parameter?.Value ?? '';
}

export async function initConfig(): Promise<void> {
  if (_initialized) return;
  _initialized = true;

  const ssmPrefix = process.env.SSM_PREFIX;
  if (!ssmPrefix) return; // local dev — use .env values

  const ssm = new SSMClient({ region: config.awsRegion });
  const [darwinApiKey, tflAppId, tflAppKey] = await Promise.all([
    fetchSsmParam(ssm, `${ssmPrefix}/darwin-api-key`),
    fetchSsmParam(ssm, `${ssmPrefix}/tfl-app-id`),
    fetchSsmParam(ssm, `${ssmPrefix}/tfl-app-key`),
  ]);

  config.darwinApiKey = darwinApiKey;
  config.tflAppId = tflAppId;
  config.tflAppKey = tflAppKey;
}
