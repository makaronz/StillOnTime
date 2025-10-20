#!/bin/sh

# Health check script for nginx
# This script checks if nginx is responding properly

# Check if nginx process is running
if ! pgrep nginx > /dev/null; then
    echo "nginx process is not running"
    exit 1
fi

# Check if nginx is listening on port 8080
if ! netstat -ln | grep -q ':8080'; then
    echo "nginx is not listening on port 8080"
    exit 1
fi

# Check if nginx health endpoint responds
if ! wget --no-verbose --tries=1 --spider http://localhost:8080/health; then
    echo "nginx health endpoint is not responding"
    exit 1
fi

# All checks passed
echo "nginx is healthy"
exit 0