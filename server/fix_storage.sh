#!/bin/bash
sed -i '33s/Promise<r>/Promise<Result>/g' server/storage.ts
sed -i '205s/Promise<r>/Promise<Result>/g' server/storage.ts
