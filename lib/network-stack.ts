import { Fn } from "aws-cdk-lib";
import { IVpc, Vpc } from "aws-cdk-lib/aws-ec2";
import * as cdk from 'aws-cdk-lib';
import { IPublicHostedZone, PublicHostedZone } from "aws-cdk-lib/aws-route53";
import { stackNameOf } from "./utils";
import { Construct } from "constructs";
import { PrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery'
import { IPrivateDnsNamespace } from 'aws-cdk-lib/aws-servicediscovery/lib/private-dns-namespace'

export class NetworkStack extends cdk.Stack {
  readonly vpc: IVpc;
  readonly awsBrightDevZone: IPublicHostedZone;
  readonly privateNamespace: IPrivateDnsNamespace

  constructor(scope: Construct) {
    super(scope, stackNameOf(NetworkStack), );

    this.vpc = new Vpc(this, 'VPC', {
      natGateways: 1
    })

    this.awsBrightDevZone =  PublicHostedZone.fromHostedZoneAttributes(this, 'aws.bright.dev', {
      hostedZoneId: Fn.importValue("BrightTraining:aws-bright-dev"),
      zoneName: 'aws.bright.dev'
    });

    this.privateNamespace = new PrivateDnsNamespace(this, 'Namespace', {
      name: 'internal.ev-ride.com',
      vpc: this.vpc,
    });
  }
}
