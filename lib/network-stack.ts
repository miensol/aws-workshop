import { Fn } from "aws-cdk-lib";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { IPublicHostedZone, PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { stackNameOf } from "./utils";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  readonly vpc: IVpc;
  readonly awsBrightDevZone: IPublicHostedZone;

  constructor(scope: Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack), );

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 1
    })

    this.awsBrightDevZone =  PublicHostedZone.fromHostedZoneAttributes(this, 'aws.bright.dev', {
      hostedZoneId: Fn.importValue("BrightTraining:aws-bright-dev"),
      zoneName: 'aws.bright.dev'
    });
  }
}
