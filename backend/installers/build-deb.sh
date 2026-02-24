#!/bin/bash

# Build Linux .deb installer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create .deb structure
mkdir -p dc1-provider_1.0/DEBIAN
mkdir -p dc1-provider_1.0/usr/local/bin
mkdir -p dc1-provider_1.0/etc/dc1-provider

# Copy daemon script
cp "$SCRIPT_DIR/dc1-provider-setup.sh" dc1-provider_1.0/usr/local/bin/dc1-provider-setup
chmod +x dc1-provider_1.0/usr/local/bin/dc1-provider-setup

# Create control file
cat > dc1-provider_1.0/DEBIAN/control << 'EOF'
Package: dc1-provider
Version: 1.0
Architecture: amd64
Maintainer: DC1 <support@dc1.sa>
Description: DC1 Provider Daemon
 Automatic GPU provider setup for DC1 marketplace
Depends: docker.io, nvidia-docker2, curl
EOF

# Create postinst (post-installation script)
cat > dc1-provider_1.0/DEBIAN/postinst << 'EOF'
#!/bin/bash
set -e

# Start daemon
/usr/local/bin/dc1-provider-setup "$@"

echo "✓ DC1 Provider installed successfully"
EOF

chmod +x dc1-provider_1.0/DEBIAN/postinst

# Build .deb
dpkg-deb --build dc1-provider_1.0 dc1-provider-setup-Linux.deb
