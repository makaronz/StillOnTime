#!/bin/bash

# Emergency Memory Recovery Script
# Immediate system recovery for memory exhaustion scenarios

set -e

echo "🚨 EMERGENCY MEMORY RECOVERY SCRIPT"
echo "=================================="
echo "Started at: $(date)"

# Get current memory usage
MEMORY_USAGE=$(vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+):\s+(\d+)/ and printf("%-16s % 16.2f Mi\n", "$1:", $2*$size/1048576);')
FREE_MEMORY=$(vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages free:\s+(\d+)/ and printf "%d", $2*$size/1048576;')
TOTAL_MEMORY=$(sysctl -n hw.memsize | awk '{print $1/1024/1024}')
USED_MEMORY=$((TOTAL_MEMORY - FREE_MEMORY))
MEMORY_PERCENT=$((USED_MEMORY * 100 / TOTAL_MEMORY))

echo "📊 Current Memory Status:"
echo "   Total Memory: ${TOTAL_MEMORY}MB"
echo "   Used Memory: ${USED_MEMORY}MB"
echo "   Free Memory: ${FREE_MEMORY}MB"
echo "   Usage Percent: ${MEMORY_PERCENT}%"

if [ "$MEMORY_PERCENT" -gt 90 ]; then
    echo "🚨 CRITICAL: Memory usage above 90%"

    echo "🧹 Step 1: Clear system caches..."
    sudo purge
    sleep 2

    echo "🧹 Step 2: Clear Node.js processes..."
    pkill -f "node" || true
    sleep 2

    echo "🧹 Step 3: Clear application caches..."
    rm -rf ~/Library/Caches/* 2>/dev/null || true
    rm -rf ~/Library/Application\ Support/Caches/* 2>/dev/null || true
    sleep 2

    echo "🧹 Step 4: Restart core services..."
    # Restart if needed (uncomment if required)
    # brew services restart postgresql || true
    # brew services restart redis || true

    echo "✅ Emergency recovery completed"

elif [ "$MEMORY_PERCENT" -gt 75 ]; then
    echo "⚠️ WARNING: Memory usage above 75%"

    echo "🧹 Step 1: Clear caches..."
    sudo purge
    sleep 2

    echo "🧹 Step 2: Clear application caches..."
    rm -rf ~/Library/Caches/* 2>/dev/null || true
    sleep 2

    echo "✅ Preventive recovery completed"

else
    echo "✅ Memory usage is acceptable"
fi

# Check final memory status
FREE_MEMORY_AFTER=$(vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages free:\s+(\d+)/ and printf "%d", $2*$size/1048576;')
USED_MEMORY_AFTER=$((TOTAL_MEMORY - FREE_MEMORY_AFTER))
MEMORY_PERCENT_AFTER=$((USED_MEMORY_AFTER * 100 / TOTAL_MEMORY))
MEMORY_FREED=$((FREE_MEMORY_AFTER - FREE_MEMORY))

echo ""
echo "📊 Recovery Results:"
echo "   Memory Before: ${MEMORY_PERCENT}%"
echo "   Memory After: ${MEMORY_PERCENT_AFTER}%"
echo "   Memory Freed: ${MEMORY_FREED}MB"
echo "   Free Memory: ${FREE_MEMORY_AFTER}MB"

if [ "$MEMORY_PERCENT_AFTER" -lt "$MEMORY_PERCENT" ]; then
    echo "✅ Recovery successful: Memory usage reduced by $((MEMORY_PERCENT - MEMORY_PERCENT_AFTER))%"
else
    echo "⚠️ Limited recovery: Additional steps may be needed"
fi

echo ""
echo "Recovery completed at: $(date)"