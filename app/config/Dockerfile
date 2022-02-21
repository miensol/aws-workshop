FROM --platform=amd64 amazon/aws-otel-collector:latest

COPY ./extracfg.txt /opt/aws/aws-otel-collector/etc/extracfg.txt

COPY ./ecs-cloudwatch-xray.yaml /etc/ecs/ecs-cloudwatch-xray.yaml

