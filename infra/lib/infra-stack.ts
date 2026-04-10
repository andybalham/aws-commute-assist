import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';


export interface InfraStackProps extends cdk.StackProps {
  envName: string; // 'dev' | 'prod'
  /** Parent Route 53 hosted zone domain (e.g. "example.com"). Optional — custom domain only applied when both this and subdomain are set. */
  domainName?: string;
  /** Sub-domain label (e.g. "commute-dashboard"). Combined with domainName to form the full app URL. */
  subdomain?: string;
  /** ACM certificate for the custom sub-domain. Must be provisioned in us-east-1 (see CertificateStack). */
  certificate?: acm.ICertificate;
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const { envName, domainName, subdomain, certificate } = props;
    const prefix = `commute-${envName}`;

    // Custom domain is only applied when both context values are provided
    // (dev continues to use the default *.cloudfront.net URL).
    const customDomain = domainName && subdomain ? `${subdomain}.${domainName}` : undefined;
    const appUrl = customDomain ? `https://${customDomain}` : undefined;

    // ─── Resource Tags ─────────────────────────────────────────
    cdk.Tags.of(this).add('Project', 'commute-dashboard');
    cdk.Tags.of(this).add('Environment', envName);

    // ─── Cognito ───────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${prefix}-user-pool`,
      signInAliases: { email: true },
      selfSignUpEnabled: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolDomain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `${prefix}-auth`,
      },
    });

    // App client — configured after CloudFront is created (needs callback URL)
    // We'll define it below once we have the CloudFront URL.

    // ─── S3 + CloudFront ───────────────────────────────────────

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${prefix}-frontend-${this.account}`,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      domainNames: customDomain ? [customDomain] : undefined,
      certificate: certificate,
      minimumProtocolVersion: certificate
        ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021
        : undefined,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    const cloudfrontUrl = `https://${distribution.distributionDomainName}`;

    // ─── Route 53 alias (custom domain only) ───────────────────

    if (customDomain && domainName && subdomain) {
      const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName,
      });

      const aliasTarget = route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution),
      );

      new route53.ARecord(this, 'AliasRecord', {
        zone: hostedZone,
        recordName: subdomain,
        target: aliasTarget,
      });

      new route53.AaaaRecord(this, 'AliasRecordIPv6', {
        zone: hostedZone,
        recordName: subdomain,
        target: aliasTarget,
      });
    }

    // ─── Cognito App Client (needs CloudFront URL for callbacks) ──

    const userPoolClient = userPool.addClient('AppClient', {
      userPoolClientName: `${prefix}-app-client`,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          `${cloudfrontUrl}/callback`,
          ...(appUrl ? [`${appUrl}/callback`] : []),
          'http://localhost:5173/callback', // local dev
        ],
        logoutUrls: [
          cloudfrontUrl,
          ...(appUrl ? [appUrl] : []),
          'http://localhost:5173',
        ],
      },
      authFlows: {
        userSrp: true,
      },
      generateSecret: false,
    });

    // ─── DynamoDB ──────────────────────────────────────────────

    const profilesTable = new dynamodb.Table(this, 'ProfilesTable', {
      tableName: `${prefix}-profiles`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'profileId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── ECR ───────────────────────────────────────────────────

    const ecrRepo = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: `${prefix}-backend`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 most recent images',
        },
      ],
    });

    // ─── SSM Parameter Store (placeholder secrets) ─────────────

    new ssm.StringParameter(this, 'DarwinApiKey', {
      parameterName: `/${prefix}/darwin-api-key`,
      stringValue: 'PLACEHOLDER',
      description: 'National Rail Darwin OpenLDBWS API key',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'TflAppId', {
      parameterName: `/${prefix}/tfl-app-id`,
      stringValue: 'PLACEHOLDER',
      description: 'TfL Unified API App ID',
      tier: ssm.ParameterTier.STANDARD,
    });

    new ssm.StringParameter(this, 'TflAppKey', {
      parameterName: `/${prefix}/tfl-app-key`,
      stringValue: 'PLACEHOLDER',
      description: 'TfL Unified API App Key',
      tier: ssm.ParameterTier.STANDARD,
    });

    // ─── Lambda ────────────────────────────────────────────────

    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `${prefix}-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // DynamoDB read/write on profiles table only
    profilesTable.grantReadWriteData(lambdaRole);

    // SSM Parameter Store read for secrets
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/${prefix}/*`,
      ],
    }));

    // ─── PROD BOOTSTRAP: Lambda + API Gateway temporarily commented out ───
    // The Lambda references commute-prod-backend:latest in ECR, but the ECR
    // repo is created by this same stack — so on the very first prod deploy
    // there is no image yet. Deploy this stack once with the Lambda + API
    // Gateway commented out to create the ECR repo, push a backend image,
    // then uncomment and redeploy. See CLAUDE.md → "First-Time ECR Bootstrap".

    // const backendFn = new lambda.DockerImageFunction(this, 'BackendFunction', {
    //   functionName: `${prefix}-backend`,
    //   code: lambda.DockerImageCode.fromEcr(ecrRepo, { tagOrDigest: 'latest' }),
    //   memorySize: 512,
    //   timeout: cdk.Duration.seconds(30),
    //   role: lambdaRole,
    //   environment: {
    //     DYNAMODB_TABLE_NAME: profilesTable.tableName,
    //     SSM_PREFIX: `/${prefix}`,
    //     AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    //   },
    // });

    // const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
    //   apiName: `${prefix}-api`,
    //   corsPreflight: {
    //     allowOrigins: [
    //       cloudfrontUrl,
    //       ...(appUrl ? [appUrl] : []),
    //       'http://localhost:5173',
    //     ],
    //     allowMethods: [
    //       apigatewayv2.CorsHttpMethod.GET,
    //       apigatewayv2.CorsHttpMethod.POST,
    //       apigatewayv2.CorsHttpMethod.PUT,
    //       apigatewayv2.CorsHttpMethod.PATCH,
    //       apigatewayv2.CorsHttpMethod.DELETE,
    //       apigatewayv2.CorsHttpMethod.OPTIONS,
    //     ],
    //     allowHeaders: ['Authorization', 'Content-Type'],
    //     maxAge: cdk.Duration.hours(1),
    //   },
    // });

    // const jwtAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
    //   'CognitoAuthorizer',
    //   `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
    //   {
    //     jwtAudience: [userPoolClient.userPoolClientId],
    //     identitySource: ['$request.header.Authorization'],
    //   },
    // );

    // const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
    //   'LambdaIntegration',
    //   backendFn,
    // );

    // httpApi.addRoutes({
    //   path: '/{proxy+}',
    //   methods: [
    //     apigatewayv2.HttpMethod.GET,
    //     apigatewayv2.HttpMethod.POST,
    //     apigatewayv2.HttpMethod.PUT,
    //     apigatewayv2.HttpMethod.PATCH,
    //     apigatewayv2.HttpMethod.DELETE,
    //   ],
    //   integration: lambdaIntegration,
    //   authorizer: jwtAuthorizer,
    // });

    // httpApi.addRoutes({
    //   path: '/health',
    //   methods: [apigatewayv2.HttpMethod.GET],
    //   integration: lambdaIntegration,
    // });

    // ─── CDK Outputs ───────────────────────────────────────────

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: cloudfrontUrl,
      description: 'CloudFront distribution URL',
      exportName: `${prefix}-cloudfront-url`,
    });

    if (appUrl) {
      new cdk.CfnOutput(this, 'AppUrl', {
        value: appUrl,
        description: 'Custom domain URL for the app',
        exportName: `${prefix}-app-url`,
      });
    }

    // PROD BOOTSTRAP: re-enable once Lambda + API Gateway are uncommented
    // new cdk.CfnOutput(this, 'ApiGatewayUrl', {
    //   value: httpApi.apiEndpoint,
    //   description: 'API Gateway endpoint URL',
    //   exportName: `${prefix}-api-url`,
    // });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${prefix}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
      exportName: `${prefix}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI domain',
      exportName: `${prefix}-cognito-domain`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket for frontend assets',
      exportName: `${prefix}-frontend-bucket`,
    });

    new cdk.CfnOutput(this, 'EcrRepoUri', {
      value: ecrRepo.repositoryUri,
      description: 'ECR repository URI for backend image',
      exportName: `${prefix}-ecr-repo-uri`,
    });

    new cdk.CfnOutput(this, 'ProfilesTableName', {
      value: profilesTable.tableName,
      description: 'DynamoDB profiles table name',
      exportName: `${prefix}-profiles-table`,
    });

    // PROD BOOTSTRAP: re-enable once Lambda + API Gateway are uncommented
    // new cdk.CfnOutput(this, 'LambdaFunctionName', {
    //   value: backendFn.functionName,
    //   description: 'Backend Lambda function name',
    //   exportName: `${prefix}-lambda-function`,
    // });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
      exportName: `${prefix}-cloudfront-distribution-id`,
    });
  }
}
