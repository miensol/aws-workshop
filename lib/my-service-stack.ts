import {BastionHostLinux, InstanceClass, InstanceSize, InstanceType, IVpc} from "@aws-cdk/aws-ec2";
import {Credentials, DatabaseInstance, DatabaseInstanceEngine, MysqlEngineVersion,} from "@aws-cdk/aws-rds";
import * as cdk from '@aws-cdk/core';
import {CfnOutput} from '@aws-cdk/core';
import {ownerSpecificName, stackNameOf} from "./utils";
import {Cluster, ContainerImage, FargateService, FargateTaskDefinition, Secret} from "@aws-cdk/aws-ecs";
import {ApplicationLoadBalancer, ApplicationProtocol} from "@aws-cdk/aws-elasticloadbalancingv2";
import {CnameRecord, IPublicHostedZone} from "@aws-cdk/aws-route53";
import {Certificate, CertificateValidation} from "@aws-cdk/aws-certificatemanager";

interface MyServiceProps {
  vpc: IVpc
  awsBrightDevZone: IPublicHostedZone
}

export class MyServiceStack extends cdk.Stack {
  constructor(scope: cdk.Construct, props: MyServiceProps) {
    super(scope, stackNameOf(MyServiceStack),);

    const database = new DatabaseInstance(this, 'Database', {
      vpc: props.vpc,
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      engine: DatabaseInstanceEngine.mysql({
        version: MysqlEngineVersion.VER_5_7
      }),
      multiAz: false,
      instanceIdentifier: ownerSpecificName("my-service"),
      databaseName: "service",
      credentials: Credentials.fromGeneratedSecret("service")
    });

    const bastion = new BastionHostLinux(this, 'Bastion', {
      vpc: props.vpc,
      instanceName: ownerSpecificName('bastion')
    })

    database.connections.allowDefaultPortFrom(bastion.connections, "Bastion host connection")

    const taskDefinition = new FargateTaskDefinition(this, 'task');

    const phpMyAdminServicePort = 80;
    taskDefinition.addContainer('phpmyadmin', {
      image: ContainerImage.fromRegistry("phpmyadmin/phpmyadmin"),
      portMappings: [{
        containerPort: phpMyAdminServicePort
      }],
      environment: {
        PMA_HOST: database.dbInstanceEndpointAddress
      },
      secrets: {
        PMA_USER: Secret.fromSecretsManager(database.secret!, "username"),
        PMA_PASSWORD: Secret.fromSecretsManager(database.secret!, "password"),
      }
    })

    const phpMyAdminService = new FargateService(this, 'php my admin', {
      cluster: new Cluster(this, 'Cluster', {
        vpc: props.vpc
      }),
      taskDefinition: taskDefinition
    });

    database.connections.allowDefaultPortFrom(phpMyAdminService.connections, "php my admin")

    const loadBalancer = new ApplicationLoadBalancer(this, 'LB', {
      vpc: props.vpc,
      internetFacing: true,
    });

    const listener = loadBalancer.addListener('http', {
      port: 80,
      open: true,
    });

    const recordName = ownerSpecificName("php");
    const cnameRecord = new CnameRecord(this, 'LB DNS', {
      domainName: loadBalancer.loadBalancerDnsName,
      zone: props.awsBrightDevZone,
      recordName: recordName
    });

    const httpsListener = loadBalancer.addListener('https', {
      protocol: ApplicationProtocol.HTTPS,
      open: true,
      certificates: [new Certificate(this, 'certificate', {
        domainName: `${recordName}.${props.awsBrightDevZone.zoneName}`, // piotr-...php.aws.bright.dev
        validation: CertificateValidation.fromDns(props.awsBrightDevZone)
      })]
    });

    listener.addTargets('phpMyMyAdmin', {
      port: phpMyAdminServicePort,
      targets: [phpMyAdminService]
    })

    httpsListener.addTargets('phpMyAdmin', {
      port: phpMyAdminServicePort,
      targets: [phpMyAdminService]
    })

    new CfnOutput(this, 'LB DnsName', {
      value: loadBalancer.loadBalancerDnsName
    })

  }
}
