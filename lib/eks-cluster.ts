import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { ownerSpecificName, stackNameOf } from './utils'
import { InstanceClass, InstanceSize, InstanceType, IVpc } from 'aws-cdk-lib/aws-ec2'
import { CapacityType, Cluster, KubernetesVersion } from 'aws-cdk-lib/aws-eks'

interface EksClusterProps {
  vpc: IVpc
}

export class EksCluster extends cdk.Stack {
  readonly cluster: Cluster

  constructor (scope: Construct, props: EksClusterProps) {
    super(scope, stackNameOf(EksCluster))

    this.cluster = new Cluster(this, 'cluster', {
      vpc: props.vpc, version: KubernetesVersion.V1_24,
      clusterName: ownerSpecificName('cluster'),
    })

    this.cluster.addNodegroupCapacity('spot-t3', {
      capacityType: CapacityType.SPOT,
      instanceTypes: [InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM), InstanceType.of(InstanceClass.T3, InstanceSize.SMALL)]
    })
  }
}
