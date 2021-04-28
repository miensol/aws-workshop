#!/usr/bin/env node
import * as cdk from "@aws-cdk/core";
import { Tags } from "@aws-cdk/core";
import 'source-map-support/register';
import { MyServiceStack } from "../lib/my-service-stack";
import { NetworkStack } from "../lib/network-stack";
import { resolveCurrentUserOwnerName } from "../lib/utils";

async function main() {
  const owner = await resolveCurrentUserOwnerName();

  const app = new cdk.App();

  const network = new NetworkStack(app);

  const myService = new MyServiceStack(app, {
    vpc: network.vpc
  })

  Tags.of(app)
    .add("owner", owner)
}

main().catch(er => {
  console.log(er)
  process.exit(1)
})
