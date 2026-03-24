#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';

const app = new cdk.App();

// Environment name from CDK context: cdk deploy -c env=prod
const envName = app.node.tryGetContext('env') || 'dev';

new InfraStack(app, `CommuteDashboard-${envName}`, {
  envName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
