import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

export interface CertificateStackProps extends cdk.StackProps {
  envName: string;
  domainName: string;
  subdomain: string;
}

/**
 * Provisions the ACM certificate for the app's custom sub-domain.
 *
 * CloudFront only accepts certificates from us-east-1, so this stack is
 * always deployed to that region regardless of where the main stack lives.
 * The certificate is consumed by the main stack via cross-region references.
 */
export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const { envName, domainName, subdomain } = props;
    const fqdn = `${subdomain}.${domainName}`;

    cdk.Tags.of(this).add('Project', 'commute-dashboard');
    cdk.Tags.of(this).add('Environment', envName);

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName,
    });

    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: fqdn,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: `ACM certificate ARN for ${fqdn}`,
    });
  }
}
