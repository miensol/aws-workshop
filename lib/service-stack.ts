import { Stack } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { stackNameOf } from './utils'
import { HelmChart, ICluster, KubernetesManifest, ServiceAccount } from 'aws-cdk-lib/aws-eks'
import { Bucket } from 'aws-cdk-lib/aws-s3'

interface ServiceStackProps {
  cluster: ICluster
}

export class ServiceStack extends Stack {

  constructor (scope: Construct, props: ServiceStackProps) {
    super(scope, stackNameOf(ServiceStack))
    // ‼️Do not do this ‼️
    // props.cluster.addHelmChart('database', {
    //   chart: 'bitnami/postgresql',
    //   repository: 'https://charts.bitnami.com/bitnami'
    // })

    const namespace = 'service'
    new HelmChart(this, 'postgres', {
      cluster: props.cluster,
      namespace: namespace,
      chart: 'postgresql',
      repository: 'https://charts.bitnami.com/bitnami',
    })

    const serviceAccount = new ServiceAccount(this, 'mypod account', {
      cluster: props.cluster,
      name: 'mypod',
      namespace: namespace
    })

    const bucket = new Bucket(this, 'Bucket')
    bucket.grantReadWrite(serviceAccount)

    const mypod = new KubernetesManifest(this, 'mypod', {
      cluster: props.cluster,
      manifest: [{
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: 'mypod',
          namespace: namespace
        },
        spec: {
          serviceAccountName: serviceAccount.serviceAccountName,
          containers: [
            {
              name: 'hello',
              image: 'paulbouwer/hello-kubernetes:1.5',
              ports: [{ containerPort: 8080 }],
            },
          ],
        },
      }]
    })

// create the resource after the service account.
    mypod.node.addDependency(serviceAccount)
  }
}
