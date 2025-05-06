#!/bin/bash
# Script to generate config files for runners.
rm /home/ubuntu/.cloudide.config
echo '{{ env_vars.config_json }}' > /home/ubuntu/.cloudide.config
echo 'Setup config'