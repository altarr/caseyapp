#!/usr/bin/env bash
# deploy-demo-pc.sh — Deploy the BoothApp Windows demo PC via CloudFormation
#
# Usage:
#   bash infra/deploy-demo-pc.sh --key-pair <name> [--cidr <x.x.x.x/32>]
#
# Optional env vars:
#   AWS_PROFILE  (default: hackathon)
#   AWS_REGION   (default: us-east-1)
set -euo pipefail

PROFILE="${AWS_PROFILE:-default}"
REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="boothapp-shared-ec2"
TEMPLATE="$(cd "$(dirname "$0")" && pwd)/demo-pc.yaml"

KEY_PAIR=""
CIDR="0.0.0.0/0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key-pair) KEY_PAIR="$2"; shift 2;;
    --cidr)     CIDR="$2"; shift 2;;
    *)          echo "Unknown arg: $1"; exit 1;;
  esac
done

[[ -z "$KEY_PAIR" ]] && { echo "Error: --key-pair is required"; exit 1; }

echo "==> Deploying stack: $STACK_NAME"
echo "    Key pair:  $KEY_PAIR"
echo "    CIDR:      $CIDR"
echo "    Region:    $REGION"
echo "    Profile:   $PROFILE"
echo ""

aws cloudformation deploy \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides \
    KeyPairName="$KEY_PAIR" \
    AllowedCIDR="$CIDR" \
  --tags \
    Project=boothapp \
    ManagedBy=cloudformation \
  --region "$REGION" \
  --profile "$PROFILE" \
  --no-fail-on-empty-changeset

echo ""
echo "==> Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs' \
  --output table

INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text)

echo ""
echo "Done! Retrieve the Windows Administrator password with:"
echo "  aws ec2 get-password-data --instance-id $INSTANCE_ID --priv-launch-key <path-to-pem> --profile $PROFILE --region $REGION"
