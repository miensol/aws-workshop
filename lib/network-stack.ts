import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { stackNameOf } from "./utils";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  readonly vpc: IVpc;

  constructor(scope: Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack), );

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 1
    })
  }
}
