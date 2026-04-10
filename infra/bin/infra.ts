#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { InfraStack } from '../lib/infra-stack';
import { CertificateStack } from '../lib/certificate-stack';

const app = new cdk.App();

// Environment name from CDK context: cdk deploy -c env=prod
const envName = app.node.tryGetContext('env') || 'dev';

// Custom domain context — per-env keys take precedence over global ones.
// Only applied when both values are present; dev continues to deploy with
// the default CloudFront URL when unset.
const domainName: string | undefined =
  app.node.tryGetContext(`${envName}:domainName`) ??
  app.node.tryGetContext('domainName');
const subdomain: string | undefined =
  app.node.tryGetContext(`${envName}:subdomain`) ??
  app.node.tryGetContext('subdomain');

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION;

const useCustomDomain = Boolean(domainName && subdomain);

// CloudFront requires certificates to live in us-east-1, so the cert is
// provisioned in a dedicated stack and passed via cross-region references.
const certStack = useCustomDomain
  ? new CertificateStack(app, `CommuteDashboard-${envName}-cert`, {
      envName,
      domainName: domainName!,
      subdomain: subdomain!,
      env: { account, region: 'us-east-1' },
      crossRegionReferences: true,
    })
  : undefined;

new InfraStack(app, `CommuteDashboard-${envName}`, {
  envName,
  domainName,
  subdomain,
  certificate: certStack?.certificate,
  env: { account, region },
  crossRegionReferences: useCustomDomain,
});
