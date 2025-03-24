#!/bin/bash
# Fix typings in storage.ts
sed -i '53s/r;/Result;/g' server/storage.ts
sed -i '54s/r>/Result>/g' server/storage.ts
sed -i '511s/r>/Result>/g' server/storage.ts
sed -i '532s/r>/Result>/g' server/storage.ts