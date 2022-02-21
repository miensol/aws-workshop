import * as cdk from 'aws-cdk-lib';
import { CfnOutput, DockerImage, Duration, Fn, RemovalPolicy } from 'aws-cdk-lib';
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import {
  BastionHostLinux,
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
} from 'aws-cdk-lib/aws-ec2';
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  LogDriver
} from 'aws-cdk-lib/aws-ecs';
import {
  ApplicationLoadBalancer,
  ApplicationProtocol,
  HttpCodeTarget,
  ListenerAction,
  ListenerCertificate
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
  Architecture,
  Code,
  Function as LambdaFunction,
  LayerVersion,
  Runtime,
  Tracing
} from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion,
} from 'aws-cdk-lib/aws-rds';
import { ARecord, CnameRecord, IPublicHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Topic } from "aws-cdk-lib/aws-sns";
import { Construct } from 'constructs';
import * as path from 'path';
import { AwsOtel } from "./aws-otel";
import { ownerSpecificName, stackNameOf } from './utils';

interface MyServiceProps {
  vpc: IVpc
  awsBrightDevZone: IPublicHostedZone
}

export class MyServiceStack extends cdk.Stack {

  constructor(scope: Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const imagesBucket = new Bucket(this, 'Images');

    const memorySize = 2048;
    const apiServerLogGroup = new LogGroup(this, 'api service logs', {
      removalPolicy: RemovalPolicy.DESTROY
    })

    const taskDefinition = new FargateTaskDefinition(this, 'api task', {
      cpu: 1024,
      memoryLimitMiB: memorySize,
    });

    const containerPort = 80;

    const apiEnvVariables = {
      IMAGES_BUCKET_NAME: imagesBucket.bucketName
    };

    taskDefinition.addContainer('api', {
      image: ContainerImage.fromAsset(path.join(__dirname, '..', '..', 'app')),
      environment: {
        ...apiEnvVariables
      },
      portMappings: [{
        containerPort: containerPort
      }],
      logging: LogDriver.awsLogs({
        streamPrefix: 'api',
        logGroup: apiServerLogGroup
      })
    });

    taskDefinition.addExtension(new AwsOtel({ logGroup: apiServerLogGroup }))

    imagesBucket.grantRead(taskDefinition.taskRole)

    const fargateService = new FargateService(this, 'api service', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc,
      }),
      taskDefinition: taskDefinition,
      healthCheckGracePeriod: Duration.seconds(10)
    });

    const slackAlarmsTopic = Topic.fromTopicArn(this, 'Bright Slack Aws Training', Fn.importValue('BrightTraining:notifications-slack-aws-training'))

    const fargateAutoScaling = fargateService.autoScaleTaskCount({
      maxCapacity: 10
    });

    fargateAutoScaling.scaleOnCpuUtilization('cpu', {
      targetUtilizationPercent: 50,
      scaleOutCooldown: Duration.seconds(30)
    })

    const loadBalancer = new ApplicationLoadBalancer(this, 'Load Balancer', {
      vpc: props.vpc,
      internetFacing: true
    });

    const highNoOf5xx = loadBalancer.metricHttpCodeTarget(HttpCodeTarget.TARGET_5XX_COUNT)
      .createAlarm(this, 'High Number of 5xx', {
        evaluationPeriods: 1,
        threshold: 5,
        alarmDescription: `High number of 5xx`
      });

    highNoOf5xx.addAlarmAction(new SnsAction(slackAlarmsTopic))
    highNoOf5xx.addOkAction(new SnsAction(slackAlarmsTopic))

    const httpListener = loadBalancer.addListener('http', {
      open: true,
      protocol: ApplicationProtocol.HTTP
    });

    new CfnOutput(this, 'Load Balancer FQDN', {
      value: loadBalancer.loadBalancerDnsName
    })

    httpListener.addAction('https redirect', {
      action: ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443'
      })
    });

    const brightDevZone = props.awsBrightDevZone;

    const apiServerRecordName = ownerSpecificName('api-server');
    const apiServerFQDN = `${apiServerRecordName}.${brightDevZone.zoneName}`;

    const certificate = new Certificate(this, 'Server Certificate', {
      domainName: apiServerFQDN,
      validation: CertificateValidation.fromDns(brightDevZone)
    });

    const httpsListener = loadBalancer.addListener('https', {
      open: true,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [ListenerCertificate.fromCertificateManager(certificate)]
    });

    const apiHttpsTargetGroup = httpsListener.addTargets('api', {
      port: containerPort,
      deregistrationDelay: Duration.seconds(10),
      healthCheck: {
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2
      }
    });

    apiHttpsTargetGroup.addTarget(fargateService)

    new CnameRecord(this, 'api server cname', {
      recordName: apiServerRecordName,
      zone: brightDevZone,
      domainName: loadBalancer.loadBalancerDnsName,
      comment: 'api public dns'
    })

    new CfnOutput(this, 'api server FQDN', {
      value: apiServerFQDN
    })

    const apiServerlessRecordName = ownerSpecificName('api-serverless');
    const apiServerlessFQDN = `${apiServerlessRecordName}.${brightDevZone.zoneName}`;

    const lambdaRuntime = Runtime.NODEJS_14_X;

    const prodDependencies = new LayerVersion(this, 'api prod dependencies', {
      compatibleRuntimes: [lambdaRuntime],
      code: Code.fromAsset(path.join(__dirname, '..', '..', 'app'), {
        exclude: ['*', '!package.json', '!package-lock.json'],
        bundling: {
          image: DockerImage.fromBuild(path.join(__dirname, '..', 'lambda-bundling-image')),
          user: 'root',
          command: ['bash', '-c', 'mkdir /asset-output/nodejs && cd $_ &&'
          + 'cp /asset-input/{package.json,package-lock.json} . &&'
          + 'npm ci --production'],
        }
      })
    });

    const awsOtelLayer = LayerVersion.fromLayerVersionArn(this, 'aws otel layer',
      `arn:aws:lambda:${this.region}:901920570463:layer:aws-otel-nodejs-amd64-ver-1-0-1:1`
      )

    const apiLambda = new LambdaFunction(this, 'api lambda', {
      code: Code.fromAsset(path.join(__dirname, '..', '..', 'app', 'dist')),
      handler: "main-lambda.handler",
      architecture: Architecture.X86_64,
      environment: {
        ...apiEnvVariables,
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler'
      },
      memorySize: memorySize,
      runtime: lambdaRuntime,
      tracing: Tracing.ACTIVE,
      layers: [awsOtelLayer, prodDependencies]
    });

    const apiServerless = new LambdaRestApi(this, 'api serverless', {
      handler: apiLambda,
      binaryMediaTypes: ['image/png'],
      domainName: {
        domainName: apiServerlessFQDN,
        certificate: new Certificate(this, 'Serverless Certificate', {
          domainName: apiServerlessFQDN,
          validation: CertificateValidation.fromDns(brightDevZone)
        }),
      }
    });

    imagesBucket.grantRead(apiLambda)

    new ARecord(this, 'api serverless cname', {
      zone: brightDevZone,
      recordName: apiServerlessRecordName,
      target: RecordTarget.fromAlias(new targets.ApiGateway(apiServerless))
    })

    new CfnOutput(this, 'api serverless FQDN', {
      value: apiServerlessFQDN
    })

    const enableDatabase = process.env.DATABASE_ENABLED?.toLocaleLowerCase() == 'true'

    if (enableDatabase) {
      const databaseInstance = new DatabaseInstance(this, 'Database', {
        vpc: props.vpc,
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
        engine: DatabaseInstanceEngine.mysql({
          version: MysqlEngineVersion.VER_8_0
        }),
        multiAz: false,
        instanceIdentifier: ownerSpecificName('my-service'),
        databaseName: 'service',
        credentials: Credentials.fromGeneratedSecret('service')
      });


      const enableBastionHost = process.env.BASTION_HOST_ENABLED?.toLocaleLowerCase() == 'true'
      if (enableBastionHost) {
        const bastion = new BastionHostLinux(this, 'Bastion', {
          vpc: props.vpc,
          instanceName: ownerSpecificName('bastion')
        })

        databaseInstance.connections.allowDefaultPortFrom(bastion.connections, 'Bastion host connection')
      }

      databaseInstance.connections.allowDefaultPortFrom(fargateService.connections, 'api')
    }
  }
}
