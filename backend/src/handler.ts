import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { routeRequest } from './router';
import { initConfig } from './config';

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  await initConfig();
  const userId =
    (event.requestContext.authorizer?.jwt?.claims?.sub as string) || 'unknown';

  const method = event.requestContext.http.method;
  const path = event.rawPath;
  const query: Record<string, string> = {};
  if (event.queryStringParameters) {
    Object.assign(query, event.queryStringParameters);
  }

  let body: unknown = null;
  if (event.body) {
    try {
      body = JSON.parse(event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString()
        : event.body);
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }
  }

  const result = await routeRequest({ method, path, params: {}, query, body, userId });

  return {
    statusCode: result.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: result.body != null ? JSON.stringify(result.body) : '',
  };
}
