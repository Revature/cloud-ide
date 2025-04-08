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

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    report_error "Please run this script with sudo"
fi

# Install Node Exporter
NODE_EXPORTER_VERSION="1.7.0"
echo "Downloading Node Exporter version ${NODE_EXPORTER_VERSION}..."
cd /tmp || report_error "Failed to change directory to /tmp"
if ! wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz; then
    report_error "Failed to download Node Exporter"
fi

echo "Extracting Node Exporter..."
if ! tar -xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz; then
    report_error "Failed to extract Node Exporter archive"
fi

echo "Installing Node Exporter to /usr/local/bin..."
if ! mv node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/; then
    report_error "Failed to move Node Exporter executable to /usr/local/bin"
fi

if ! chmod +x /usr/local/bin/node_exporter; then
    report_error "Failed to make Node Exporter executable"
fi

# Create a system service for Node Exporter
echo "Creating Node Exporter systemd service..."
cat > /etc/systemd/system/node_exporter.service << EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=nobody
Group=nogroup
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

# Enable and start Node Exporter service
echo "Configuring Node Exporter service..."
if ! systemctl daemon-reload; then
    report_error "Failed to reload systemd manager configuration"
fi

if ! systemctl enable node_exporter; then
    report_error "Failed to enable Node Exporter service"
fi

if ! systemctl start node_exporter; then
    report_error "Failed to start Node Exporter service"
fi

# Create a separate script for the metrics push loop
echo "Creating metrics push script..."
cat > /usr/local/bin/push_metrics.sh << EOF
#!/bin/bash
# Function to report errors in a format that script_management.py can understand
report_error() {
    local error_message="\$1"
    echo "ERROR: \$error_message" >&2
    exit 1
}

# Get runner IP address
RUNNER_IP=\$(curl -s icanhazip.com)
if [ -z "\$RUNNER_IP" ]; then
    report_error "Failed to get runner IP address"
fi

MONITOR_VM="54.188.253.144"
PUSHGATEWAY_URL="http://\$MONITOR_VM:9091/metrics/job/\$RUNNER_IP"

echo "Starting metrics push loop to \$PUSHGATEWAY_URL..."
while true; do
    # Push to Pushgateway
    if ! curl -s localhost:9100/metrics | curl --data-binary @- "\$PUSHGATEWAY_URL"; then
        echo "Warning: Failed to push metrics, will retry in 10 seconds"
    fi
    # Push every 10 seconds
    sleep 10
done
EOF

# Make the push script executable
echo "Setting permissions on metrics push script..."
if ! chmod +x /usr/local/bin/push_metrics.sh; then
    report_error "Failed to make push metrics script executable"
fi

# Create a service for the push metrics script
echo "Creating metrics push systemd service..."
cat > /etc/systemd/system/push_metrics.service << EOF
[Unit]
Description=Push Node Exporter Metrics
After=node_exporter.service

[Service]
Type=simple
ExecStart=/usr/local/bin/push_metrics.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the push metrics service
echo "Configuring metrics push service..."
if ! systemctl daemon-reload; then
    report_error "Failed to reload systemd manager configuration"
fi

if ! systemctl enable push_metrics; then
    report_error "Failed to enable push metrics service"
fi

if ! systemctl start push_metrics; then
    report_error "Failed to start push metrics service"
fi

echo "Node Exporter installation and metric pushing setup completed successfully."
report_success "Node Exporter installed and configured to push metrics to $MONITOR_VM:9091"