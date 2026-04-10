import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { routeRequest } from './router';
import { initConfig } from './config';

/**
 * Emit a single-line JSON log entry. CloudWatch Logs Insights can parse these
 * directly. Never include API keys, tokens, request bodies, or PII beyond the
 * Cognito `sub` (which is an opaque user identifier, not personal data).
 */
function logEvent(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...fields }));
}

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
      logEvent({ level: 'warn', userId, method, path, error: 'invalid_json_body' });
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON body' }),
      };
    }
  }

  const start = Date.now();
  try {
    const result = await routeRequest({ method, path, params: {}, query, body, userId });

    logEvent({
      level: result.statusCode >= 500 ? 'error' : 'info',
      userId,
      method,
      path,
      statusCode: result.statusCode,
      durationMs: Date.now() - start,
    });

    return {
      statusCode: result.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: result.body != null ? JSON.stringify(result.body) : '',
    };
  } catch (err: any) {
    logEvent({
      level: 'error',
      userId,
      method,
      path,
      durationMs: Date.now() - start,
      errorType: err?.name ?? 'Error',
      errorMessage: err?.message ?? 'Unknown error',
      upstreamStatus: err?.response?.status,
    });
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
