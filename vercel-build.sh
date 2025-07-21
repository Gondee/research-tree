#!/bin/bash

echo "=== Vercel Build Simulation ==="
echo "This simulates what Vercel does during deployment"
echo ""

# 1. Check environment variables
echo "1. Checking required environment variables..."
MISSING_VARS=()

# Check database vars
[ -z "$POSTGRES_URL" ] && MISSING_VARS+=("POSTGRES_URL")
[ -z "$POSTGRES_PRISMA_URL" ] && MISSING_VARS+=("POSTGRES_PRISMA_URL")

# Check auth vars
[ -z "$NEXTAUTH_URL" ] && MISSING_VARS+=("NEXTAUTH_URL")
[ -z "$NEXTAUTH_SECRET" ] && MISSING_VARS+=("NEXTAUTH_SECRET")

# Check API keys
[ -z "$OPENAI_API_KEY" ] && MISSING_VARS+=("OPENAI_API_KEY")
[ -z "$GEMINI_API_KEY" ] && MISSING_VARS+=("GEMINI_API_KEY")

# Check Inngest
[ -z "$INNGEST_EVENT_KEY" ] && MISSING_VARS+=("INNGEST_EVENT_KEY")
[ -z "$INNGEST_SIGNING_KEY" ] && MISSING_VARS+=("INNGEST_SIGNING_KEY")

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "❌ Missing environment variables:"
    printf '%s\n' "${MISSING_VARS[@]}"
    echo ""
    echo "These need to be set in Vercel dashboard!"
else
    echo "✅ All required environment variables are set"
fi

echo ""
echo "2. Installing dependencies..."
npm install

echo ""
echo "3. Generating Prisma client..."
npx prisma generate

echo ""
echo "4. Building application..."
npm run build

echo ""
echo "=== Build Complete ==="