#!/bin/bash
# Quick validation script for the extension build

echo "=== SCE2 Extension Build Validation ==="
echo ""

# Check if manifest.json has module type
echo "1. Checking manifest.json for module type..."
if grep -q '"type": "module"' dist/manifest.json; then
    echo "   ✅ Content script configured as module"
else
    echo "   ❌ Content script NOT configured as module"
fi

# Check if web_accessible_resources includes lib/*
echo ""
echo "2. Checking web_accessible_resources..."
if grep -q '"lib/\*"' dist/manifest.json; then
    echo "   ✅ lib/* is in web_accessible_resources"
else
    echo "   ❌ lib/* NOT in web_accessible_resources"
fi

# Check if content.js exists and has imports
echo ""
echo "3. Checking content.js..."
if [ -f "dist/content.js" ]; then
    echo "   ✅ content.js exists"
    if head -10 dist/content.js | grep -q "import.*from"; then
        echo "   ✅ content.js has ES6 imports"
    else
        echo "   ⚠️  content.js has no imports (might be bundled)"
    fi
else
    echo "   ❌ content.js missing"
fi

# Check if all imported lib files exist
echo ""
echo "4. Checking lib files..."
import_files=$(grep -o "import.*from '\.\/lib\/[^']*'" dist/content.js | sed "s/.*'\.\///; s/'.*//" | sort -u)
missing=0
for file in $import_files; do
    if [ -f "dist/$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file MISSING"
        missing=$((missing + 1))
    fi
done

if [ $missing -eq 0 ]; then
    echo ""
    echo "=== ✅ ALL CHECKS PASSED ==="
    echo ""
    echo "Extension is ready to test!"
    echo ""
    echo "Next steps:"
    echo "1. Open chrome://extensions/"
    echo "2. Enable 'Developer mode'"
    echo "3. Click 'Load unpacked'"
    echo "4. Select the 'dist' folder"
    echo "5. Open test-banner.html or navigate to sce.dsmcentral.com"
else
    echo ""
    echo "=== ❌ $missing FILES MISSING ==="
fi
