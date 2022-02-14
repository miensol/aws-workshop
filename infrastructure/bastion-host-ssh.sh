set -ex

export AWS_REGION=eu-central-1

aws_user_name=$(aws sts get-caller-identity --query='Arn' --output text | sed 's/.*\///')
# Fine bastion_host_instance_id bastion_host_az for bastion host of current user
read -r bastion_host_instance_id bastion_host_az <<<$(aws ec2 describe-instances \
  --filters Name=tag:owner,Values="${aws_user_name}" \
  --query "Reservations[0].Instances[0].[InstanceId,Placement.AvailabilityZone]" \
  --output text )

# Send current user ssh public key to bastion host so that it allows for connecting
aws ec2-instance-connect send-ssh-public-key \
  --instance-id "${bastion_host_instance_id}" \
  --instance-os-user ec2-user \
  --availability-zone "${bastion_host_az}" \
  --ssh-public-key "file://~/.ssh/id_rsa.pub"

local_port=3306

read -rp "Database endpoint hostname: " database_private_fqdn

# Open a tunnel through bastion host to database on port 3306
ssh -v -N -L "${local_port}:${database_private_fqdn}:3306" \
  -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" \
  -o ProxyCommand="aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p" \
  "ec2-user@${bastion_host_instance_id}"
