import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { NetworkStack } from "../lib/network-stack";

test('Network Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new NetworkStack(app);
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
