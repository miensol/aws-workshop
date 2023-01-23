import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { ownerSpecificName, stackNameOf } from './utils'
import { InstanceClass, InstanceSize, InstanceType, IVpc } from 'aws-cdk-lib/aws-ec2'
import { CapacityType, Cluster, KubernetesVersion } from 'aws-cdk-lib/aws-eks'
import { CfnOutput } from 'aws-cdk-lib'
import { PolicyStatement } from 'aws-cdk-lib/aws-iam'
import { Arn } from 'aws-cdk-lib'

interface EksClusterProps {
  vpc: IVpc
}

export class EKS extends cdk.Stack {
  readonly cluster: Cluster

  constructor (scope: Construct, props: EksClusterProps) {
    super(scope, stackNameOf(EKS))

    const clusterName = ownerSpecificName('cluster')
    this.cluster = new Cluster(this, 'cluster', {
      vpc: props.vpc, version: KubernetesVersion.V1_24,
      clusterName: clusterName,
    })

    // make it possible to use from web us
    this.cluster.adminRole.addToPolicy(new PolicyStatement({
      actions: ['eks:*'],
      resources: [Arn.format({
        resource: 'cluster',
        resourceName: clusterName,
        service: 'eks'
      }, this)]
    }))

    this.cluster.addNodegroupCapacity('spot-t3', {
      capacityType: CapacityType.SPOT,
      instanceTypes: [InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM), InstanceType.of(InstanceClass.T3, InstanceSize.SMALL)]
    })

    new CfnOutput(this, 'AdminRole', {
      value: this.cluster.adminRole.roleArn
    })
  }
}
