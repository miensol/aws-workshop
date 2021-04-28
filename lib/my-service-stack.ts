import { IVpc, Vpc, InstanceClass,
  InstanceSize,
  InstanceType, } from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine, MysqlEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { stackNameOf, ownerSpecificName } from "./utils";

interface MyServiceProps {
  vpc: IVpc
}

export class MyServiceStack extends cdk.Stack {

  constructor(scope: Construct, props: MyServiceProps) {
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
  }
}
