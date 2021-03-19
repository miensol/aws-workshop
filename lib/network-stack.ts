import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import { stackNameOf } from "./utils";

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.IVpc;

  constructor(scope: cdk.Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack),);

    this.vpc = new ec2.Vpc(this, 'vpc', {
      natGateways: 1,
    });
  }
}
