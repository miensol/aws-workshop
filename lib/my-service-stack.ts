import {
  BastionHostLinux,
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc,
  Port,
  SubnetType
} from "@aws-cdk/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  Secret
} from "@aws-cdk/aws-ecs";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine,
  MysqlEngineVersion
} from "@aws-cdk/aws-rds";
import * as cdk from '@aws-cdk/core';
import { ownerSpecificName, stackNameOf } from "./utils";

interface MyServiceProps {
  vpc: IVpc
}

export class MyServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const databaseInstance = new DatabaseInstance(this, 'Database', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_5_7
      }),
      multiAz: false,
      instanceIdentifier: ownerSpecificName("my-service"),
      databaseName: "service",
      credentials: Credentials.fromGeneratedSecret("service")
    });

    const bastion = new BastionHostLinux(this, 'Bastion', {
      vpc: props.vpc,
      instanceName: ownerSpecificName('bastion')
    })

    databaseInstance.connections.allowDefaultPortFrom(bastion.connections, "Bastion host connection")

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
        PMA_USER: Secret.fromSecretsManager(databaseInstance.secret!, "user"),
        PMA_PASSWORD: Secret.fromSecretsManager(databaseInstance.secret!, "password"),
      }
    })
    const fargateService = new FargateService(this, 'PhpMyAdmin', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc,
      }),
      taskDefinition: taskDefinition,
      assignPublicIp: true
    });

    fargateService.connections.allowFromAnyIpv4(Port.tcp(80))

    databaseInstance.connections.allowDefaultPortFrom(fargateService.connections, "PhpMyAdmin")
  }
}
