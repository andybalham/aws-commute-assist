import dotenv from 'dotenv';

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
