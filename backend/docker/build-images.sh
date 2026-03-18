#!/bin/bash
# DC1 Docker Worker Image Builder
# Run this on a machine with Docker to build all worker images.
# These images are then pulled by provider daemons.
#
# Usage:
#   ./build-images.sh                                    # Local build only
#   DC1_REGISTRY=ghcr.io/dhnpmp-tech ./build-images.sh   # Build + push to GHCR

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="${DC1_REGISTRY:-}"  # Optional: set to push to a registry

echo "=== DC1 Worker Image Builder ==="
echo ""

# 1. Base worker (CUDA + PyTorch)
echo "[1/4] Building dc1/base-worker..."
docker build -t dc1/base-worker:latest -f "$SCRIPT_DIR/Dockerfile.base" "$SCRIPT_DIR"
echo "  ✓ dc1/base-worker:latest"

# 2. Stable Diffusion worker (image generation)
echo "[2/4] Building dc1/sd-worker..."
docker build -t dc1/sd-worker:latest \
  --build-arg BASE_IMAGE=dc1/base-worker:latest \
  -f "$SCRIPT_DIR/Dockerfile.sd-worker" "$SCRIPT_DIR"
echo "  ✓ dc1/sd-worker:latest"

# 3. LLM inference worker
echo "[3/4] Building dc1/llm-worker..."
docker build -t dc1/llm-worker:latest \
  --build-arg BASE_IMAGE=dc1/base-worker:latest \
  -f "$SCRIPT_DIR/Dockerfile.llm-worker" "$SCRIPT_DIR"
echo "  ✓ dc1/llm-worker:latest"

# 4. General worker (training, rendering, benchmarks, custom compute)
echo "[4/4] Building dc1/general-worker..."
docker build -t dc1/general-worker:latest \
  --build-arg BASE_IMAGE=dc1/base-worker:latest \
  -f "$SCRIPT_DIR/Dockerfile.general-worker" "$SCRIPT_DIR"
echo "  ✓ dc1/general-worker:latest"

echo ""
echo "=== All images built ==="
docker images | grep dc1/

# Push to registry if set
if [ -n "$REGISTRY" ]; then
    echo ""
    echo "Pushing to $REGISTRY..."
    for img in base-worker sd-worker llm-worker general-worker; do
        docker tag dc1/$img:latest $REGISTRY/dc1-$img:latest
        docker push $REGISTRY/dc1-$img:latest
        echo "  ✓ $REGISTRY/dc1-$img:latest"
    done
    echo ""
    echo "Images available at:"
    echo "  $REGISTRY/dc1-base-worker:latest"
    echo "  $REGISTRY/dc1-sd-worker:latest"
    echo "  $REGISTRY/dc1-llm-worker:latest"
    echo "  $REGISTRY/dc1-general-worker:latest"
fi
