import {
  InstanceClass,
  InstanceSize,
  InstanceType,
  IVpc
} from "@aws-cdk/aws-ec2";
import * as cdk from '@aws-cdk/core';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine, MysqlEngineVersion,
} from "@aws-cdk/aws-rds";
import { ownerSpecificName, stackNameOf } from "./utils";

interface MyServiceProps {
  vpc: IVpc
}

export class MyServiceStack extends cdk.Stack {

  constructor(scope: cdk.Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const instance = new DatabaseInstance(this, 'Database', {
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

    const bastion = new BastionHostLinux(this, 'Bastion', {
      vpc: props.vpc,
      instanceName: ownerSpecificName('bastion')
    })

    instance.connections.allowFrom(bastion.connections, Port.tcp(instance.dbInstanceEndpointPort as any), "Bastion host connection")
  }
}
