#!/bin/bash
# This script fixes the return type issue in storage.ts

# Create a sed script to replace 'Promise<r>' with 'Promise<Result>'
cat > fix.sed << 'EOF'
s/Promise<r>/Promise<Result>/g
EOF

# Apply the sed script to storage.ts
sed -i -f fix.sed server/storage.ts

# Clean up
rm fix.sed

# Verify changes
echo "Verifying changes in storage.ts:"
grep -A 2 "createResult" server/storage.ts
