import { DockerImageAsset } from "aws-cdk-lib/aws-ecr-assets";
import {
  ContainerImage,
  ITaskDefinitionExtension,
  LogDriver,
  TaskDefinition
} from "aws-cdk-lib/aws-ecs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { ILogGroup } from "aws-cdk-lib/aws-logs";

export class AwsOtel implements ITaskDefinitionExtension {
  constructor(private readonly props: { logGroup?: ILogGroup }) {
  }

  extend(taskDefinition: TaskDefinition): void {
    taskDefinition.addContainer("aws-otel-collector", {
      image: ContainerImage.fromRegistry("amazon/aws-otel-collector:latest"),
      command: ['--config=/etc/ecs/ecs-cloudwatch-xray.yaml'],
      portMappings: [{
        containerPort: 4317
      }],
      logging: LogDriver.awsLogs({
        streamPrefix: "aws-otel-collector",
        logGroup: this.props.logGroup
      })
    })

    taskDefinition.addToTaskRolePolicy(new PolicyStatement({
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
        'xray:GetSamplingStatisticSummaries',
      ],
      resources: ['*']
    }))
  }
}
