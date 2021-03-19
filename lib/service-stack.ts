import * as ec2 from "@aws-cdk/aws-ec2";
import { RecordTarget } from "@aws-cdk/aws-route53";
import * as route53 from "@aws-cdk/aws-route53";
import { SubnetType } from "@aws-cdk/aws-ec2";
import { CfnOutput, Fn } from "@aws-cdk/core";
import * as cdk from '@aws-cdk/core';
import { ownerSpecificName, stackNameOf } from "./utils";

interface ServiceStackProps {
  vpc: ec2.IVpc
}

export class ServiceStack extends cdk.Stack {

  constructor(scope: cdk.Construct, props: ServiceStackProps) {
    super(scope, stackNameOf(ServiceStack));

    const bastion = new ec2.BastionHostLinux(this, 'bastion', {
      vpc: props.vpc,
      subnetSelection: {
        subnetType: SubnetType.PUBLIC
      }
    })

    const awsBrightDev = route53.PublicHostedZone.fromHostedZoneAttributes(this, 'aws.bright.dev', {
      hostedZoneId: Fn.importValue("BrightTraining:aws-bright-dev"),
      zoneName: 'aws.bright.dev'
    });

  }
}
