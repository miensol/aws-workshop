import * as cdk from 'aws-cdk-lib'
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import {
  BastionHostLinux,
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  SecurityGroup,
} from 'aws-cdk-lib/aws-ec2'
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion, } from 'aws-cdk-lib/aws-rds'
import { IPublicHostedZone } from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'
import { ownerName, ownerSpecificName, stackNameOf } from './utils'
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha'
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import { IPrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery/lib/private-dns-namespace'
import { CfnApiGatewayManagedOverrides, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { LogGroup } from 'aws-cdk-lib/aws-logs'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as path from 'path'
import AccessLogSettingsProperty = CfnApiGatewayManagedOverrides.AccessLogSettingsProperty

interface MyServiceProps {
  vpc: IVpc;
  awsBrightDevZone: IPublicHostedZone
  privateNamespace: IPrivateDnsNamespace
}

export class MyServiceStack extends cdk.Stack {

  constructor (scope: Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),)

    const databaseName = 'service'
    const databaseInstance = new DatabaseInstance(this, 'Database', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_8_0
      }),
      multiAz: false,
      instanceIdentifier: ownerSpecificName('my-service'),
      databaseName: databaseName,
      credentials: Credentials.fromGeneratedSecret('service')
    })

    const allowConnectingToDatabaseSecurityGroup = new SecurityGroup(this, 'connect to database marker', {
      vpc: props.vpc
    })

    databaseInstance.connections.allowDefaultPortFrom(allowConnectingToDatabaseSecurityGroup)

    const enableBastionHost = process.env.BASTION_HOST_ENABLED?.toLocaleLowerCase() == 'true'
    if (enableBastionHost) {
      const bastion = new BastionHostLinux(this, 'Bastion', {
        vpc: props.vpc,
        instanceName: ownerSpecificName('bastion')
      })

      databaseInstance.connections.allowDefaultPortFrom(bastion.connections, 'Bastion host connection')
    }

    const httpApi = new HttpApi(this, 'api gateway', {
    })

    const apiGatewayLogGroup = new LogGroup(this, 'log group', {
      logGroupName: ownerSpecificName('api-gateway'),
      removalPolicy: RemovalPolicy.DESTROY
    })

    const defaultStage = httpApi.defaultStage!.node.defaultChild as CfnStage
    defaultStage.accessLogSettings = {
      destinationArn: apiGatewayLogGroup.logGroupArn,
      format: 'requestId=$context.requestId integrationErrorMessage = $context.integrationErrorMessage error.message = $context.error.message'
    } as AccessLogSettingsProperty

    httpApi.addRoutes({
      path: '/whoami',
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration('whoami', new NodejsFunction(this, 'whoami', {
        vpc: props.vpc,
        entry: path.join(process.cwd(), 'lib', 'whoami.lambda.ts'),
        environment: {
          OWNER_NAME: ownerName()
        }
      }))
    })

    const listTablesLambda = new NodejsFunction(this, 'list-tables', {
      vpc: props.vpc,
      securityGroups: [allowConnectingToDatabaseSecurityGroup],
      entry: path.join(process.cwd(), 'lib', 'list-tables.lambda.ts'),
      environment: {
        DATABASE_HOST: databaseInstance.dbInstanceEndpointAddress,
        DATABASE_NAME: databaseName,
        DATABASE_CREDENTIALS_SECRET_ID: databaseInstance.secret!.secretName
      }
    })
    httpApi.addRoutes({
      path: '/list-tables',
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration('list-tables', listTablesLambda)
    })

    databaseInstance.secret!.grantRead(listTablesLambda)

    new CfnOutput(this, 'phpmyadmin api gateway', {
      value: httpApi.apiEndpoint
    })
  }
}
