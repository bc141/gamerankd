#!/bin/bash

# Security Scanning Script
# This script performs various security checks on the codebase

set -e

echo "🔍 Starting security scan..."

# Check for hardcoded secrets
echo "Checking for hardcoded secrets..."
if grep -r -E "(password|secret|key|token)\s*[:=]\s*['\"][^'\"]{10,}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" src/ | grep -v "process.env" | grep -v "placeholder" | grep -v "example" | grep -v "key:" | grep -v "token:" | grep -v "access_token" | grep -v "refresh_token"; then
    echo "❌ Found potential hardcoded secrets!"
    exit 1
else
    echo "✅ No hardcoded secrets found"
fi

# Check for console.log statements in production code
echo "Checking for console.log statements..."
if grep -r "console\.log" src/; then
    echo "⚠️  Found console.log statements (consider removing for production)"
else
    echo "✅ No console.log statements found"
fi

# Check for proper environment variable usage
echo "Checking environment variable usage..."
if grep -r "SUPABASE_SERVICE_ROLE_KEY" src/ | grep -v "process.env"; then
    echo "❌ Found hardcoded service role key!"
    exit 1
else
    echo "✅ Service role key properly referenced via process.env"
fi

# Check for client-side usage of server keys
echo "Checking for client-side server key usage..."
if grep -r "SUPABASE_SERVICE_ROLE_KEY" src/ --include="*.tsx" --include="*.jsx" | grep -v "route.ts" | grep -v "page.tsx" | grep -v "layout.tsx" | grep -v "sitemap.ts"; then
    echo "❌ Found server key usage in client-side code!"
    exit 1
else
    echo "✅ No server keys in client-side code"
fi

# Check for proper .env file exclusions
echo "Checking .gitignore for env files..."
if grep -q "\.env" ../.gitignore && grep -q "!\.env\.example" ../.gitignore; then
    echo "✅ .gitignore properly configured for env files"
else
    echo "❌ .gitignore not properly configured for env files"
    exit 1
fi

# Check for tracked env files
echo "Checking for tracked env files..."
if git ls-files | grep -E '\.env(\..*)?$' | grep -v '.env.example'; then
    echo "❌ Found tracked env files!"
    exit 1
else
    echo "✅ No env files tracked in git"
fi

echo "🎉 Security scan completed successfully!"
