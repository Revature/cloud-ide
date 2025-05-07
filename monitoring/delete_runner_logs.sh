#!/bin/bash

RUNNER_IP=$(curl icanhazip.com)
MONITOR_VM="34.223.156.189"
PUSHGATEWAY_URL="http://$MONITOR_VM:9091/metrics/job/$RUNNER_IP"

# Delete from Pushgateway
curl -X DELETE $PUSHGATEWAY_URL