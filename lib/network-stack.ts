import { Vpc } from "aws-cdk-lib/aws-ec2";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { stackNameOf } from "./utils";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  constructor(scope: Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack), );

  }
}
