import { IVpc, Vpc } from "@aws-cdk/aws-ec2";
import * as cdk from '@aws-cdk/core';
import { stackNameOf } from "./utils";

interface MyServiceProps {
  vpc: IVpc
}

export class MyServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

  }
}
