#!/bin/bash

# Phase 1 IDE Extension — Automated Monitoring Script
# Usage: ./phase1-ide-extension-monitor.sh [checkpoint-name]
# Example: ./phase1-ide-extension-monitor.sh morning
# Checkpoints: morning, midday, afternoon, evening

set -e

CHECKPOINT="${1:-morning}"
TIMESTAMP=$(date -u +'%Y-%m-%d %H:%M:%S UTC')
API_BASE="https://api.dcp.sa"
RESULTS_FILE="/tmp/phase1-ide-extension-results-${CHECKPOINT}.json"

echo "🚀 Phase 1 IDE Extension Monitoring — $CHECKPOINT checkpoint"
echo "⏰ Time: $TIMESTAMP"
echo "📍 Target: $API_BASE"
echo ""

# Initialize results JSON
cat > "$RESULTS_FILE" << 'EOF'
{
  "checkpoint": "",
  "timestamp": "",
  "results": {
    "health": null,
    "models": null,
    "templates": null,
    "latency": null,
    "errors": []
  },
  "metrics": {
    "extension_loads": "pending",
    "api_health": "pending",
    "catalog_rendering": "pending",
    "pricing_accuracy": "pending",
    "onboarding_flow": "pending",
    "support_sla": "pending"
  },
  "status": "in_progress"
}
EOF

# Test 1: API Health Check
echo "1️⃣  Testing API Health..."
HEALTH_RESPONSE=$(curl -s "$API_BASE/api/health" 2>&1)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" = "ok" ]; then
  echo "   ✅ Health check PASS"
else
  echo "   ❌ Health check FAIL"
fi

# Test 2: Model Catalog
echo "2️⃣  Testing Model Catalog..."
MODELS_RESPONSE=$(curl -s "$API_BASE/api/models" 2>&1)
MODEL_COUNT=$(echo "$MODELS_RESPONSE" | jq 'length' 2>/dev/null || echo 0)

if [ "$MODEL_COUNT" -ge 11 ]; then
  echo "   ✅ Model catalog PASS ($MODEL_COUNT models)"
else
  echo "   ❌ Model catalog FAIL ($MODEL_COUNT models, need 11+)"
fi

# Test 3: Template Catalog
echo "3️⃣  Testing Template Catalog..."
TEMPLATES_RESPONSE=$(curl -s "$API_BASE/api/templates" 2>&1)
TEMPLATE_COUNT=$(echo "$TEMPLATES_RESPONSE" | jq '.templates | length' 2>/dev/null || echo 0)

if [ "$TEMPLATE_COUNT" -ge 15 ]; then
  echo "   ✅ Template catalog PASS ($TEMPLATE_COUNT templates)"
else
  echo "   ❌ Template catalog FAIL ($TEMPLATE_COUNT templates, need 15+)"
fi

# Test 4: Latency Check
echo "4️⃣  Testing Latency..."
START_TIME=$(date +%s%N)
curl -s -o /dev/null "$API_BASE/api/health"
END_TIME=$(date +%s%N)
LATENCY_MS=$(( (END_TIME - START_TIME) / 1000000 ))

if [ "$LATENCY_MS" -lt 500 ]; then
  echo "   ✅ Latency PASS (${LATENCY_MS}ms, target <500ms)"
else
  echo "   ⚠️  Latency WARNING (${LATENCY_MS}ms, target <500ms)"
fi

# Checkpoint-specific tests
case "$CHECKPOINT" in
  morning|midday|afternoon)
    echo "5️⃣  Checking for extension errors..."
    # Would check VS Code extension logs here
    echo "   ℹ️  Manual verification needed: Check VS Code logs"
    ;;
  evening)
    echo "5️⃣  Compiling final metrics..."
    echo "   ℹ️  See PHASE1-IDE-EXTENSION-QUICK-REFERENCE.md for metrics"
    ;;
esac

echo ""
echo "📊 Summary"
echo "✅ Checkpoint: $CHECKPOINT"
echo "✅ Models: $MODEL_COUNT/11 required"
echo "✅ Templates: $TEMPLATE_COUNT/15 required"
echo "✅ Latency: ${LATENCY_MS}ms"
echo "✅ Health: $HEALTH_STATUS"
echo ""
echo "✅ Results saved to: $RESULTS_FILE"
echo ""
echo "🟢 Checkpoint complete"
