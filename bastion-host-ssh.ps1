$env:AWS_REGION='eu-central-1'

$_, $aws_user_name = (aws sts get-caller-identity  --query='Arn' --output text) -split '/'
# Find bastion_host_instance_id bastion_host_az for bastion host of current user
$bastion_host_instance_id, $bastion_host_az = (aws ec2 describe-instances `
  --filters Name=tag:owner,Values="$aws_user_name" `
  --query "Reservations[0].Instances[0].[InstanceId,Placement.AvailabilityZone]" `
  --output text ) -split '\s+'

$key_path = New-TemporaryFile

Write-Output "y" | ssh-keygen  -t rsa -b 2048 -f "$key_path" -N '""'

aws ec2-instance-connect send-ssh-public-key `
    --instance-id $bastion_host_instance_id `
    --instance-os-user ec2-user `
    --availability-zone $bastion_host_az `
    --ssh-public-key "file://$key_path.pub"

$local_port=3306

$database_private_fqdn= Read-Host -Prompt "Database endpoint hostname: "

# Open a tunnel through bastion host to database on port 3306
ssh -v -i $key_path -N `
  -L ( '{0}:{1}:3306' -f $local_port, $database_private_fqdn ) `
  -o "UserKnownHostsFile=/dev/null" -o "StrictHostKeyChecking=no" `
  -o ProxyCommand="aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p" `
  "ec2-user@$bastion_host_instance_id"
