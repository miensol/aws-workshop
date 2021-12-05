import { IVpc, Vpc, InstanceClass,
  InstanceSize,
  InstanceType,
  BastionHostLinux,
  Port, } from "aws-cdk-lib/aws-ec2";
import {
  Cluster,
  ContainerImage,
  FargateService,
  FargateTaskDefinition,
  Secret
} from "aws-cdk-lib/aws-ecs";
import { IPublicHostedZone, CnameRecord } from "aws-cdk-lib/aws-route53";
import { ApplicationLoadBalancer, ApplicationProtocol, ListenerCertificate, ListenerAction } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as cdk from 'aws-cdk-lib';
import {
  Credentials,
  DatabaseInstance,
  DatabaseInstanceEngine, MysqlEngineVersion,
} from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import { stackNameOf, ownerSpecificName } from "./utils";
import { CfnOutput, Duration } from "aws-cdk-lib";
import { CertificateValidation, Certificate } from "aws-cdk-lib/aws-certificatemanager";

interface MyServiceProps {
  vpc: IVpc
  awsBrightDevZone: IPublicHostedZone
}

export class MyServiceStack extends cdk.Stack {

  constructor(scope: Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const databaseInstance = new DatabaseInstance(this, 'Database', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_8_0
      }),
      multiAz: false,
      instanceIdentifier: ownerSpecificName("my-service"),
      databaseName: "service",
      credentials: Credentials.fromGeneratedSecret("service")
    });

    const enableBastionHost = process.env.BASTION_HOST_ENABLED?.toLocaleLowerCase() == 'true'
    if (enableBastionHost) {
      const bastion = new BastionHostLinux(this, 'Bastion', {
        vpc: props.vpc,
        instanceName: ownerSpecificName('bastion')
      })

      databaseInstance.connections.allowDefaultPortFrom(bastion.connections, "Bastion host connection")
    }

    const taskDefinition = new FargateTaskDefinition(this, 'PhpMyAdminTask', {});

    taskDefinition.addContainer("phpmyadmin", {
      image: ContainerImage.fromRegistry("phpmyadmin/phpmyadmin"),
      portMappings: [{
        containerPort: 80
      }],
      environment: {
        PMA_HOST: databaseInstance.dbInstanceEndpointAddress
      },
      secrets: {
        PMA_USER: Secret.fromSecretsManager(databaseInstance.secret!, "username"),
        PMA_PASSWORD: Secret.fromSecretsManager(databaseInstance.secret!, "password"),
      }
    })
    const fargateService = new FargateService(this, 'PhpMyAdmin', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc,
      }),
      taskDefinition: taskDefinition,
    });

    databaseInstance.connections.allowDefaultPortFrom(fargateService.connections, "PhpMyAdmin")

    const loadBalancer = new ApplicationLoadBalancer(this, 'Load Balancer', {
      vpc: props.vpc,
      internetFacing: true
    });

    const httpListener = loadBalancer.addListener('http', {
      open: true,
      protocol: ApplicationProtocol.HTTP
    });

    new CfnOutput(this, 'Load Balancer FQDN', {
      value: loadBalancer.loadBalancerDnsName
    })

    httpListener.addAction('https redirect', {
      action: ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443'
      })
    });

    const brightDevZone = props.awsBrightDevZone;

    const phpMyAdminRecordName = ownerSpecificName('phpmyadmin');
    const phpMyAdminFQDN = `${phpMyAdminRecordName}.${brightDevZone.zoneName}`;

    const certificate = new Certificate(this, 'Certificate', {
      domainName: phpMyAdminFQDN,
      validation: CertificateValidation.fromDns(brightDevZone)
    });

    const httpsListener = loadBalancer.addListener('https', {
      open: true,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [ListenerCertificate.fromCertificateManager(certificate)]
    });

    const phpMyAdminHttpsTargetGroup = httpsListener.addTargets('phpmyadmin', {
      port: 80,
      deregistrationDelay: Duration.seconds(10)
    });

    phpMyAdminHttpsTargetGroup.addTarget(fargateService)

    new CnameRecord(this, 'phpmyadmin cname', {
      recordName: phpMyAdminRecordName,
      zone: brightDevZone,
      domainName: loadBalancer.loadBalancerDnsName,
      comment: 'phpmyadmin public dns'
    })

    new CfnOutput(this, 'phpmyadmin FQDN', {
      value: phpMyAdminFQDN
    })

  }
}
