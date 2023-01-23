import { Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { stackNameOf } from './utils'
import { ICluster } from 'aws-cdk-lib/aws-eks'

interface ServiceStackProps {
  cluster: ICluster
}

export class ServiceStack extends Stack {

  constructor (scope: Construct, props: ServiceStackProps) {
    super(scope, stackNameOf(ServiceStack))

    props.cluster.addHelmChart('database', {
      chart: 'bitnami/postgresql',
      repository: 'https://charts.bitnami.com/bitnami'
    })
  }
}
