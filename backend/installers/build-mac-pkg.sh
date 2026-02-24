#!/bin/bash

# Build macOS .pkg installer

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create package structure
mkdir -p build/DC1Provider.pkg/Contents/Resources
mkdir -p build/DC1Provider.pkg/Contents/MacOS

# Copy scripts
cp "$SCRIPT_DIR/dc1-provider-setup.sh" build/DC1Provider.pkg/Contents/MacOS/
chmod +x build/DC1Provider.pkg/Contents/MacOS/dc1-provider-setup.sh

# Create PackageInfo
cat > build/DC1Provider.pkg/Contents/PackageInfo << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.dc1.provider</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>IFMajorVersion</key>
    <integer>1</integer>
    <key>IFMinorVersion</key>
    <integer>0</integer>
    <key>IFPkgFlagAllowBackRev</key>
    <false/>
    <key>IFPkgFlagAuthorizationAction</key>
    <string>AdminAuthorization</string>
    <key>IFPkgFlagDefaultLocation</key>
    <string>/usr/local/bin</string>
    <key>IFPkgFlagFollowLinks</key>
    <true/>
    <key>IFPkgFlagInstallFat</key>
    <false/>
    <key>IFPkgFlagIsBundle</key>
    <false/>
    <key>IFPkgFlagRelocatable</key>
    <false/>
    <key>IFPkgFlagRestartAction</key>
    <string>None</string>
    <key>IFPkgFlagRootVolumeOnly</key>
    <false/>
    <key>IFPkgFlagUseUserMask</key>
    <false/>
    <key>IFPkgFormatVersion</key>
    <real>0.10000000149011612</real>
</dict>
</plist>
EOF

# Create .pkg
cd build
xar -czf dc1-provider-setup-Mac.pkg DC1Provider.pkg/
mv dc1-provider-setup-Mac.pkg ../ 
cd ..

echo "✓ macOS installer created: dc1-provider-setup-Mac.pkg"

