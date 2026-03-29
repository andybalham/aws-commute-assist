#!/usr/bin/env node

// Deploy frontend SPA to S3 + CloudFront
// Usage: node deploy.mjs [env]

import { execSync } from 'child_process';

const env = process.argv[2] || 'dev';
const stackName = `CommuteDashboard-${env}`;
const region = 'eu-west-2';

function run(cmd, opts = {}) {
  console.log(`==> ${cmd}`);
  return execSync(cmd, { stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8', ...opts });
}

function getStackOutputs() {
  const json = run(
    `aws cloudformation describe-stacks --stack-name ${stackName} --region ${region} --query "Stacks[0].Outputs" --output json`,
    { capture: true }
  );
  return JSON.parse(json);
}

function getOutput(outputs, key) {
  const entry = outputs.find(o => o.OutputKey === key);
  if (!entry) {
    console.error(`CDK output "${key}" not found in stack ${stackName}`);
    process.exit(1);
  }
  return entry.OutputValue;
}

console.log(`\n==> Fetching CDK stack outputs for ${stackName}...`);
const outputs = getStackOutputs();

const bucketName = getOutput(outputs, 'FrontendBucketName');
const distributionId = getOutput(outputs, 'CloudFrontDistributionId');
const cloudfrontUrl = getOutput(outputs, 'CloudFrontUrl');
const apiUrl = getOutput(outputs, 'ApiGatewayUrl');
const userPoolId = getOutput(outputs, 'UserPoolId');
const clientId = getOutput(outputs, 'UserPoolClientId');
const cognitoDomain = getOutput(outputs, 'CognitoDomain');

console.log(`\n==> Building frontend with CDK outputs as VITE_* env vars...`);
run('npm run build', {
  env: {
    ...process.env,
    VITE_COGNITO_USER_POOL_ID: userPoolId,
    VITE_COGNITO_APP_CLIENT_ID: clientId,
    VITE_COGNITO_DOMAIN: cognitoDomain,
    VITE_API_URL: apiUrl,
    VITE_REDIRECT_URL: `${cloudfrontUrl}/callback`,
    VITE_DEV_BYPASS_AUTH: 'false',
  },
});

console.log(`\n==> Syncing dist/ to s3://${bucketName}...`);
run(`aws s3 sync dist/ s3://${bucketName} --delete --region ${region}`);

console.log(`\n==> Invalidating CloudFront cache...`);
const invalidationJson = run(
  `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*" --region ${region} --output json`,
  { capture: true }
);
const invalidationId = JSON.parse(invalidationJson).Invalidation.Id;

console.log(`\n==> Waiting for invalidation ${invalidationId}...`);
run(`aws cloudfront wait invalidation-completed --distribution-id ${distributionId} --id ${invalidationId} --region ${region}`);

console.log(`\n==> Frontend deployed successfully to ${cloudfrontUrl}`);
