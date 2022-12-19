#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Tags } from "aws-cdk-lib";
import 'source-map-support/register';
import { NetworkStack } from "../lib/network-stack";
import { resolveCurrentUserOwnerName } from "../lib/utils";
import { MyServiceStack } from "../lib/my-service-stack";

async function main() {
  const owner = await resolveCurrentUserOwnerName();

  const app = new cdk.App();

  const network = new NetworkStack(app);

  const myService = new MyServiceStack(app, {
    vpc: network.vpc,
    gatewayVpcLink: network.gatewayVpcLink,
    awsBrightDevZone: network.awsBrightDevZone,
    privateNamespace: network.privateNamespace
  })

  const appTags = Tags.of(app);
  appTags.add("owner", owner)
  appTags.add("auto-delete", "1d")
}

main().catch(er => {
  console.log(er)
  process.exit(1)
})
