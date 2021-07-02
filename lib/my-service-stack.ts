import {
  BastionHostLinux,
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc, Port
} from "@aws-cdk/aws-ec2";
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine, MysqlEngineVersion,
} from "@aws-cdk/aws-rds";
import * as cdk from '@aws-cdk/core';
import {ownerSpecificName, stackNameOf} from "./utils";
import {Cluster, ContainerImage, FargateService, FargateTaskDefinition, Secret} from "@aws-cdk/aws-ecs";

interface MyServiceProps {
  vpc: IVpc
}

export class MyServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const database = new DatabaseInstance(this, 'Database', {
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

    database.connections.allowDefaultPortFrom(bastion.connections, "Bastion host connection")

    const taskDefinition = new FargateTaskDefinition(this, 'task');

    taskDefinition.addContainer('phpmyadmin', {
      image: ContainerImage.fromRegistry("phpmyadmin/phpmyadmin"),
      portMappings: [{
        containerPort: 80
      }],
      environment: {
        PMA_HOST: database.dbInstanceEndpointAddress
      },
      secrets: {
        PMA_USER: Secret.fromSecretsManager(database.secret!, "username"),
        PMA_PASSWORD: Secret.fromSecretsManager(database.secret!, "password"),
      }
    })

    const phpMyAdminService = new FargateService(this, 'php my admin', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc
      }),
      taskDefinition: taskDefinition,
      assignPublicIp: true,
    });

    phpMyAdminService.connections.allowFromAnyIpv4(Port.tcp(80), "Http access")

    database.connections.allowDefaultPortFrom(phpMyAdminService.connections, "php my admin")

  }
}
