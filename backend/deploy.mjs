#!/usr/bin/env node

// Deploy backend Lambda container image to AWS
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

const ecrRepoUri = getOutput(outputs, 'EcrRepoUri');
const lambdaFunction = getOutput(outputs, 'LambdaFunctionName');
const gitSha = run('git rev-parse --short HEAD', { capture: true }).trim();
const imageTag = `${ecrRepoUri}:${gitSha}`;
const imageLatest = `${ecrRepoUri}:latest`;
const ecrHost = ecrRepoUri.split('/')[0];

console.log(`\n==> Logging in to ECR...`);
const password = run(`aws ecr get-login-password --region ${region}`, { capture: true }).trim();
console.log(`==> docker login --username AWS --password-stdin ${ecrHost}`);
execSync(`docker login --username AWS --password-stdin ${ecrHost}`, { input: password, stdio: ['pipe', 'inherit', 'inherit'], encoding: 'utf8' });

console.log(`\n==> Building Docker image (tag: ${gitSha})...`);
run(`docker build --platform linux/amd64 --provenance=false -t ${imageTag} -t ${imageLatest} .`);

console.log(`\n==> Pushing to ECR...`);
run(`docker push ${imageTag}`);
run(`docker push ${imageLatest}`);

console.log(`\n==> Updating Lambda function code...`);
run(`aws lambda update-function-code --function-name ${lambdaFunction} --image-uri ${imageTag} --region ${region} --no-cli-pager`);

console.log(`\n==> Waiting for Lambda update to complete...`);
run(`aws lambda wait function-updated --function-name ${lambdaFunction} --region ${region}`);

console.log(`\n==> Backend deployed successfully (image: ${gitSha})`);
