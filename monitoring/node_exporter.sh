#!/bin/bash

# Install Node Exporter
NODE_EXPORTER_VERSION="1.7.0"
wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
tar -xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
mv node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/

# Start Node Exporter in the background
nohup /usr/local/bin/node_exporter &

RUNNER_IP=$(curl icanhazip.com)
MONITOR_VM="54.188.253.144"
PUSHGATEWAY_URL="http://$MONITOR_VM:9091/metrics/job/$RUNNER_IP"

while true; do
    # Push to Pushgateway
    curl -s localhost:9100/metrics | curl --data-binary @- "$PUSHGATEWAY_URL"
    # Push every 10 seconds
    sleep 10
done
