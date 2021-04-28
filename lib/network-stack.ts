import { IVpc, Vpc } from "@aws-cdk/aws-ec2";
import * as cdk from '@aws-cdk/core';
import { stackNameOf } from "./utils";

export class NetworkStack extends cdk.Stack {
  readonly vpc: IVpc;

  constructor(scope: cdk.Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack),);

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 1
    })
  }
}
