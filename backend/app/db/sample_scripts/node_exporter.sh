#!/bin/bash
# Script to install and run Node Exporter
# with metrics pushing to a Pushgateway

# Function to report errors in a format that script_management.py can understand
report_error() {
    local error_message="$1"
    echo "ERROR: $error_message" >&2
    exit 1
}

# Function to report success in a format that script_management.py can understand
report_success() {
    local success_message="$1"
    echo "SUCCESS: $success_message"
    exit 0
}

# Enable better error reporting with specific context
set -o pipefail  # Ensures pipeline failures are caught

echo "Starting Node Exporter installation and setup..."

# Create log directory for debugging
mkdir -p /var/log/node_exporter

EXPORTER_ARCH="arm64"

echo "Using Node Exporter architecture: $EXPORTER_ARCH"

# Check if Node Exporter is already running
if pgrep node_exporter >/dev/null; then
    echo "Node Exporter is already running, stopping it first..."
    pkill node_exporter || true
    sleep 2
fi

# Install Node Exporter
NODE_EXPORTER_VERSION="1.7.0"
DOWNLOAD_URL="https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-${EXPORTER_ARCH}.tar.gz"
ARCHIVE_NAME="node_exporter-${NODE_EXPORTER_VERSION}.linux-${EXPORTER_ARCH}.tar.gz"
EXTRACTED_DIR="node_exporter-${NODE_EXPORTER_VERSION}.linux-${EXPORTER_ARCH}"

echo "Downloading Node Exporter from: $DOWNLOAD_URL"
cd /tmp || report_error "Failed to change directory to /tmp"
if ! wget "$DOWNLOAD_URL"; then
    report_error "Failed to download Node Exporter for $EXPORTER_ARCH architecture"
fi

echo "Extracting Node Exporter..."
if ! tar -xzf "$ARCHIVE_NAME"; then
    report_error "Failed to extract Node Exporter archive"
fi

echo "Installing Node Exporter to /usr/local/bin..."
if ! cp "$EXTRACTED_DIR/node_exporter" /usr/local/bin/; then
    report_error "Failed to copy Node Exporter executable to /usr/local/bin"
fi

if ! chmod +x /usr/local/bin/node_exporter; then
    report_error "Failed to make Node Exporter executable"
fi

echo "Testing Node Exporter executable..."
if ! /usr/local/bin/node_exporter --version; then
    report_error "Node Exporter executable test failed"
fi

# Start Node Exporter directly
echo "Starting Node Exporter directly..."
nohup /usr/local/bin/node_exporter > /var/log/node_exporter/node_exporter.log 2>&1 &
NODE_EXPORTER_PID=$!
echo "Node Exporter started with PID: $NODE_EXPORTER_PID"

# Wait for Node Exporter to start
echo "Waiting for Node Exporter to start..."
for i in {1..10}; do
    if curl -s http://localhost:9100/metrics >/dev/null; then
        echo "Node Exporter is running and responding"
        break
    fi
    if [ $i -eq 10 ]; then
        # Check if process is still running
        if ! ps -p $NODE_EXPORTER_PID >/dev/null; then
            echo "Node Exporter process died. Last log entries:"
            tail -n 20 /var/log/node_exporter/node_exporter.log
            report_error "Node Exporter failed to start properly"
        fi
        report_error "Node Exporter started but is not responding on port 9100"
    fi
    echo "Waiting for Node Exporter to start (attempt $i/10)..."
    sleep 1
done

# Create metrics push script
echo "Creating metrics push script..."
cat > /usr/local/bin/push_metrics.sh << EOF
#!/bin/bash
# Script to push metrics to Pushgateway

# Get runner IP address
RUNNER_IP=\$(curl -s icanhazip.com)
if [ -z "\$RUNNER_IP" ]; then
    echo "ERROR: Failed to get runner IP address" >&2
    exit 1
fi

MONITOR_VM="54.188.253.144"
PUSHGATEWAY_URL="http://\$MONITOR_VM:9091/metrics/job/\$RUNNER_IP"

echo "Starting metrics push loop to \$PUSHGATEWAY_URL..."
while true; do
    # Push to Pushgateway
    curl -s localhost:9100/metrics | curl --data-binary @- "\$PUSHGATEWAY_URL" || true
    # Push every 10 seconds
    sleep 10
done
EOF

# Make the script executable
chmod +x /usr/local/bin/push_metrics.sh

# Start metrics push in background
echo "Starting metrics push script..."
nohup /usr/local/bin/push_metrics.sh > /var/log/node_exporter/push_metrics.log 2>&1 &
PUSH_METRICS_PID=$!
echo "Metrics push script started with PID: $PUSH_METRICS_PID"

# Save process information for troubleshooting
echo "NODE_EXPORTER_PID=$NODE_EXPORTER_PID" > /var/log/node_exporter/process_info.txt
echo "PUSH_METRICS_PID=$PUSH_METRICS_PID" >> /var/log/node_exporter/process_info.txt
echo "ARCH=$ARCH" >> /var/log/node_exporter/process_info.txt
echo "EXPORTER_ARCH=$EXPORTER_ARCH" >> /var/log/node_exporter/process_info.txt

# Write a reboot persistence script
echo "Creating service for persistence across reboots..."
cat > /etc/cron.d/node_exporter << EOF
@reboot root /usr/local/bin/node_exporter > /var/log/node_exporter/node_exporter.log 2>&1 &
@reboot root /usr/local/bin/push_metrics.sh > /var/log/node_exporter/push_metrics.log 2>&1 &
EOF

chmod 644 /etc/cron.d/node_exporter

# Verify Node Exporter is responding
echo "Verifying Node Exporter is responding..."
if ! curl -s localhost:9100/metrics >/dev/null; then
    cat /var/log/node_exporter/node_exporter.log
    report_error "Node Exporter is not responding on port 9100"
fi

# Test push connection to Pushgateway
echo "Testing connection to Pushgateway..."
RUNNER_IP=$(curl -s icanhazip.com)
MONITOR_VM="54.188.253.144"
PUSHGATEWAY_URL="http://$MONITOR_VM:9091/metrics/job/$RUNNER_IP"

if ! curl -s -m 5 "$PUSHGATEWAY_URL" >/dev/null; then
    echo "Warning: Could not connect to Pushgateway at $PUSHGATEWAY_URL (continuing anyway)"
fi

echo "Node Exporter installation and metrics pushing setup completed successfully"
report_success "Node Exporter and metrics push processes started (PIDs: $NODE_EXPORTER_PID, $PUSH_METRICS_PID)"