#!/bin/bash

# Detect system architecture
ARCH=$(uname -m)
if [[ "$ARCH" == "x86_64" ]]; then
    ARCH="amd64"
elif [[ "$ARCH" == "aarch64" ]]; then
    ARCH="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

# Install Node Exporter
NODE_EXPORTER_VERSION="1.7.0"
wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-${ARCH}.tar.gz
tar -xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-${ARCH}.tar.gz
mv node_exporter-${NODE_EXPORTER_VERSION}.linux-${ARCH}/node_exporter /usr/local/bin/

# Start Node Exporter in the background
nohup /usr/local/bin/node_exporter &

# Determine runner IP, set gateway url
RUNNER_IP=$(curl icanhazip.com)
MONITOR_VM="34.223.156.189"
PUSHGATEWAY_URL="http://$MONITOR_VM:9091/metrics/job/$RUNNER_IP"

while true; do
    # Push to Pushgateway
    curl -s localhost:9100/metrics | curl --data-binary @- "$PUSHGATEWAY_URL"
    # Push every 10 seconds
    sleep 10
done
