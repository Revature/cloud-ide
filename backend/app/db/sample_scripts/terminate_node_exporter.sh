echo "Ending Node Exporter script"
RUNNER_IP=$(curl -s icanhazip.com)
MONITOR_VM="34.223.156.189"
curl -X DELETE http://$MONITOR_VM:9091/metrics/job/$RUNNER_IP