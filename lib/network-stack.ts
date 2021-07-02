import {IVpc, Vpc} from "@aws-cdk/aws-ec2";
import * as cdk from '@aws-cdk/core';
import {stackNameOf} from "./utils";
import {IPublicHostedZone, PublicHostedZone} from "@aws-cdk/aws-route53";

export class NetworkStack extends cdk.Stack {
  readonly vpc: IVpc;

  readonly awsBrightDevZone: IPublicHostedZone = PublicHostedZone.fromHostedZoneAttributes(this, 'aws.bright.dev zone', {
    zoneName: 'aws.bright.dev',
    hostedZoneId: 'Z02426012OGFU87SQM97H' // created and configured manually
  });

  constructor(scope: cdk.Construct, props?: cdk.StackProps) {
    super(scope, stackNameOf(NetworkStack),);

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 1
    })
  }
}
