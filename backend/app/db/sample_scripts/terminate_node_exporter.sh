echo "Ending Node Exporter script"
RUNNER_IP=$(curl -s icanhazip.com)
MONITOR_VM="54.188.253.144"
curl -X DELETE http://$MONITOR_VM:9091/metrics/job/$RUNNER_IP