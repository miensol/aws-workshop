import { Arn } from "@aws-cdk/core";
import * as cdk from "@aws-cdk/core";
import { STS } from "aws-sdk";

let _ownerName!: string

function ownerName() {
  const user = process.env.USER
  if (!_ownerName && !user) {
    throw new Error('Neither process.env.USER nor resolveCurrentUserOwnerName called')
  }

  const name = _ownerName ?? user;
  return name
}

function ownerSpecificName(resourceName: string, ownerEmail: string = ownerName()) {
  const ownerPrefix = ownerEmail
    .replace('@brightinventions.pl', '')
    .replace(/[^A-Za-z0-9-]/g, '-');
  return ownerPrefix + "-" + resourceName
}


export function stackNameOf<TC extends ({ new(...args: any[]): T }), T extends cdk.Stack>(stackClass: TC) {
  return ownerSpecificName(stackClass.name.replace(/Stack$/, ''));
}

export async function resolveCurrentUserOwnerName() {
  const result = await new STS().getCallerIdentity().promise()
  const parsed = Arn.parse(result.Arn!);
  _ownerName = parsed.resourceName!;
  return _ownerName!;
}
