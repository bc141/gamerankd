# Security Configuration

This document outlines the security measures implemented in the Gamebox project.

## Environment Variables

### Required Environment Variables

Create a `.env.local` file in the `gamebox-web` directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Server-side keys (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ACCESS_TOKEN=your_access_token_here

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Google Site Verification
GOOGLE_SITE_VERIFICATION=your_google_verification_code
```

### Key Usage Guidelines

- **`NEXT_PUBLIC_*`** variables are safe to use in client-side code
- **`SUPABASE_SERVICE_ROLE_KEY`** must ONLY be used in server-side code (API routes, server components)
- **`SUPABASE_ACCESS_TOKEN`** is for CLI operations and CI/CD

## Security Measures

### 1. Environment File Protection
- All `.env*` files are excluded from git tracking
- `.env.example` provides a template without real values
- Security scan validates no secrets are hardcoded

### 2. Key Usage Validation
- Server-side code uses `SUPABASE_SERVICE_ROLE_KEY`
- Client-side code uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Security scan prevents server keys in client code

### 3. Database Security
- Row Level Security (RLS) policies implemented
- Service role key bypasses RLS for server operations
- Anon key respects RLS for client operations

### 4. CI/CD Security
- Automated security scanning on every PR
- Preview database isolation for testing
- No secrets exposed in build logs

## Running Security Scans

```bash
# Run security scan
npm run security-scan

# Run full CI test suite
npm run test:ci
```

## Preview Database Setup

For safe testing, each PR gets an isolated preview database:

1. **Automatic Creation**: CI creates a preview branch for each PR
2. **Isolated Data**: Preview databases use test data only
3. **Automatic Cleanup**: Preview databases are deleted when PRs are closed

## Incident Response

If secrets are compromised:

1. **Immediately rotate** all affected keys in Supabase dashboard
2. **Update** environment variables in all environments
3. **Review** git history for any committed secrets
4. **Consider** using `git filter-repo` to remove secrets from history

## Best Practices

- Never commit `.env*` files
- Use environment variables for all configuration
- Regularly rotate keys and tokens
- Monitor for unauthorized access
- Keep dependencies updated
- Run security scans before merging PRs
