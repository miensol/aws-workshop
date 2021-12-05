import { IVpc, Vpc, InstanceClass,
  InstanceSize,
  InstanceType,
  BastionHostLinux,
  Port, } from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  Secret
} from "aws-cdk-lib/aws-ecs";
import * as cdk from 'aws-cdk-lib';
import { IPublicHostedZone } from "aws-cdk-lib/aws-route53";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine, MysqlEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { stackNameOf, ownerSpecificName } from "./utils";

interface MyServiceProps {
  vpc: IVpc
  awsBrightDevZone: IPublicHostedZone
}

export class MyServiceStack extends cdk.Stack {

  constructor(scope: Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const databaseInstance = new DatabaseInstance(this, 'Database', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_8_0
      }),
      multiAz: false,
      instanceIdentifier: ownerSpecificName("my-service"),
      databaseName: "service",
      credentials: Credentials.fromGeneratedSecret("service")
    });

    const enableBastionHost = process.env.BASTION_HOST_ENABLED?.toLocaleLowerCase() == 'true'
    if (enableBastionHost) {
      const bastion = new BastionHostLinux(this, 'Bastion', {
        vpc: props.vpc,
        instanceName: ownerSpecificName('bastion')
      })

      databaseInstance.connections.allowDefaultPortFrom(bastion.connections, "Bastion host connection")
    }

    const taskDefinition = new FargateTaskDefinition(this, 'PhpMyAdminTask', {});

    taskDefinition.addContainer("phpmyadmin", {
      image: ContainerImage.fromRegistry("phpmyadmin/phpmyadmin"),
      portMappings: [{
        containerPort: 80
      }],
      environment: {
        PMA_HOST: databaseInstance.dbInstanceEndpointAddress
      },
      secrets: {
        PMA_USER: Secret.fromSecretsManager(databaseInstance.secret!, "username"),
        PMA_PASSWORD: Secret.fromSecretsManager(databaseInstance.secret!, "password"),
      }
    })
    const fargateService = new FargateService(this, 'PhpMyAdmin', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc,
      }),
      taskDefinition: taskDefinition,
    });

    fargateService.connections.allowFromAnyIpv4(Port.tcp(80))

    databaseInstance.connections.allowDefaultPortFrom(fargateService.connections, "PhpMyAdmin")
  }
}
