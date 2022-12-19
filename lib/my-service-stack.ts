import * as cdk from 'aws-cdk-lib'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager'
import { BastionHostLinux, InstanceClass, InstanceSize, InstanceType, IVpc, Port, } from 'aws-cdk-lib/aws-ec2'
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, Secret } from 'aws-cdk-lib/aws-ecs'
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion, } from 'aws-cdk-lib/aws-rds'
import { IPublicHostedZone } from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'
import { ownerSpecificName, stackNameOf } from './utils'
import { HttpApi, IVpcLink } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpServiceDiscoveryIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { IPrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery/lib/private-dns-namespace'
import { CfnApiGatewayManagedOverrides, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import AccessLogSettingsProperty = CfnApiGatewayManagedOverrides.AccessLogSettingsProperty
import * as http from 'http'

interface MyServiceProps {
  gatewayVpcLink: IVpcLink;
  vpc: IVpc;
  awsBrightDevZone: IPublicHostedZone
  privateNamespace: IPrivateDnsNamespace
}

export class MyServiceStack extends cdk.Stack {

  constructor (scope: Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),)

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
    })

    const enableBastionHost = process.env.BASTION_HOST_ENABLED?.toLocaleLowerCase() == 'true'
    if (enableBastionHost) {
      const bastion = new BastionHostLinux(this, 'Bastion', {
        vpc: props.vpc,
        instanceName: ownerSpecificName('bastion')
      })

      databaseInstance.connections.allowDefaultPortFrom(bastion.connections, 'Bastion host connection')
    }

    const taskDefinition = new FargateTaskDefinition(this, 'PhpMyAdminTask', {})

    taskDefinition.addContainer('phpmyadmin', {
      image: ContainerImage.fromRegistry('phpmyadmin/phpmyadmin'),
      portMappings: [{
        containerPort: 80
      }],
      environment: {
        PMA_HOST: databaseInstance.dbInstanceEndpointAddress
      },
      secrets: {
        PMA_USER: Secret.fromSecretsManager(databaseInstance.secret!, 'username'),
        PMA_PASSWORD: Secret.fromSecretsManager(databaseInstance.secret!, 'password'),
      }
    })
    const fargateService = new FargateService(this, 'PhpMyAdmin', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc,
      }),
      taskDefinition: taskDefinition,
      cloudMapOptions: {
        cloudMapNamespace: props.privateNamespace,
        name: 'phpmyadmin',
        containerPort: 80
      }
    })

    fargateService.connections.allowFromAnyIpv4(Port.tcp(80), 'Allow connecting from VPC')

    databaseInstance.connections.allowDefaultPortFrom(fargateService.connections, 'PhpMyAdmin')

    const brightDevZone = props.awsBrightDevZone

    const phpMyAdminRecordName = ownerSpecificName('phpmyadmin')
    const phpMyAdminFQDN = `${phpMyAdminRecordName}.${brightDevZone.zoneName}`

    const certificate = new Certificate(this, 'certificate', {
      domainName: `${phpMyAdminRecordName}.aws.bright.dev`,
      validation: CertificateValidation.fromDns(brightDevZone)
    })

    const httpApi = new HttpApi(this, 'api gateway', {
      defaultIntegration: new HttpServiceDiscoveryIntegration('phpmyadmin', fargateService.cloudMapService!, {
        vpcLink: props.gatewayVpcLink,
      }),
    })

    const apiGatewayLogGroup = new LogGroup(this, 'log group', {
      logGroupName: ownerSpecificName('api-gateway'),
      removalPolicy: RemovalPolicy.DESTROY
    })

    const defaultStage = httpApi.defaultStage!.node.defaultChild as CfnStage
    defaultStage.accessLogSettings = {
      destinationArn: apiGatewayLogGroup.logGroupArn,
      format: '$context.identity.sourceIp - - [$context.requestTime] "$context.httpMethod $context.routeKey $context.protocol" $context.status $context.responseLength $context.requestId $context.error.message'
    } as AccessLogSettingsProperty

    new CfnOutput(this, 'phpmyadmin FQDN', {
      value: phpMyAdminFQDN
    })
  }
}
