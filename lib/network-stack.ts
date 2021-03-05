import * as cdk from '@aws-cdk/core';
import { stackNameOf } from "./utils";

export class NetworkStack extends cdk.Stack {
  constructor(scope: cdk.Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack), );

  }
}
