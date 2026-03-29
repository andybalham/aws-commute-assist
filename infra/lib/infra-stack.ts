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


export interface InfraStackProps extends cdk.StackProps {
  envName: string; // 'dev' | 'prod'
}

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const { envName } = props;
    const prefix = `commute-${envName}`;

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
          'http://localhost:5173/callback', // local dev
        ],
        logoutUrls: [
          cloudfrontUrl,
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

    // Lambda function — uses a placeholder image; updated in Phase 3 via deploy script
    const backendFn = new lambda.DockerImageFunction(this, 'BackendFunction', {
      functionName: `${prefix}-backend`,
      code: lambda.DockerImageCode.fromEcr(ecrRepo, { tagOrDigest: 'latest' }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
      environment: {
        DYNAMODB_TABLE_NAME: profilesTable.tableName,
        SSM_PREFIX: `/${prefix}`,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
    });

    // ─── API Gateway (HTTP API) ────────────────────────────────

    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `${prefix}-api`,
      corsPreflight: {
        allowOrigins: [
          cloudfrontUrl,
          'http://localhost:5173',
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // JWT authorizer referencing Cognito
    const jwtAuthorizer = new apigatewayv2Authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      },
    );

    // Lambda integration
    const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'LambdaIntegration',
      backendFn,
    );

    // Proxy route — all requests go to Lambda
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
      authorizer: jwtAuthorizer,
    });

    // Health endpoint without auth (useful for monitoring)
    httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // ─── CDK Outputs ───────────────────────────────────────────

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: cloudfrontUrl,
      description: 'CloudFront distribution URL',
      exportName: `${prefix}-cloudfront-url`,
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway endpoint URL',
      exportName: `${prefix}-api-url`,
    });

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

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: backendFn.functionName,
      description: 'Backend Lambda function name',
      exportName: `${prefix}-lambda-function`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
      exportName: `${prefix}-cloudfront-distribution-id`,
    });
  }
}
