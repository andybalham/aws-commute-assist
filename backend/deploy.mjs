#!/usr/bin/env node

// Deploy backend Lambda container image to AWS
// Usage: node deploy.mjs [env]

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

const ecrRepoUri = getOutput(outputs, 'EcrRepoUri');
const lambdaFunction = getOutput(outputs, 'LambdaFunctionName');
const gitSha = run('git rev-parse --short HEAD', { capture: true }).trim();
const imageTag = `${ecrRepoUri}:${gitSha}`;
const imageLatest = `${ecrRepoUri}:latest`;
const ecrHost = ecrRepoUri.split('/')[0];

// If Docker is configured to use amazon-ecr-credential-helper for this registry,
// it fetches tokens itself and `docker login` is unnecessary (and fails, since the
// helper doesn't implement credential storage).
function usesEcrCredHelper(host) {
  const configDir = process.env.DOCKER_CONFIG || join(homedir(), '.docker');
  try {
    const config = JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf8'));
    return config.credHelpers?.[host] === 'ecr-login' || config.credsStore === 'ecr-login';
  } catch {
    return false;
  }
}

// Env for docker commands. The ecr-login helper runs as a child of the docker CLI,
// but can't read every AWS CLI credential source (e.g. `aws login` sessions), so
// resolve credentials via the CLI and hand them over as env vars in-memory.
let dockerEnv = process.env;

if (usesEcrCredHelper(ecrHost)) {
  console.log(`\n==> Docker uses ecr-login credential helper for ${ecrHost}; skipping docker login`);
  const creds = JSON.parse(
    execSync('aws configure export-credentials --format process', { stdio: 'pipe', encoding: 'utf8' })
  );
  dockerEnv = {
    ...process.env,
    AWS_ACCESS_KEY_ID: creds.AccessKeyId,
    AWS_SECRET_ACCESS_KEY: creds.SecretAccessKey,
    ...(creds.SessionToken && { AWS_SESSION_TOKEN: creds.SessionToken }),
    AWS_REGION: region,
  };
} else {
  console.log(`\n==> Logging in to ECR...`);
  const password = run(`aws ecr get-login-password --region ${region}`, { capture: true }).trim();
  console.log(`==> docker login --username AWS --password-stdin ${ecrHost}`);
  execSync(`docker login --username AWS --password-stdin ${ecrHost}`, { input: password, stdio: ['pipe', 'inherit', 'inherit'], encoding: 'utf8' });
}

console.log(`\n==> Building Docker image (tag: ${gitSha})...`);
run(`docker build --platform linux/amd64 --provenance=false -t ${imageTag} -t ${imageLatest} .`);

console.log(`\n==> Pushing to ECR...`);
run(`docker push ${imageTag}`, { env: dockerEnv });
run(`docker push ${imageLatest}`, { env: dockerEnv });

console.log(`\n==> Updating Lambda function code...`);
run(`aws lambda update-function-code --function-name ${lambdaFunction} --image-uri ${imageTag} --region ${region} --no-cli-pager`);

console.log(`\n==> Waiting for Lambda update to complete...`);
run(`aws lambda wait function-updated --function-name ${lambdaFunction} --region ${region}`);

console.log(`\n==> Backend deployed successfully (image: ${gitSha})`);
