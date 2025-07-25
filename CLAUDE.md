# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Research Tree is a hierarchical research automation platform built with Next.js 15, TypeScript, and Prisma. It enables parallel execution of AI-powered research tasks using OpenAI and Google Gemini APIs, with background job processing via Inngest.

## Critical Commands

### Development
```bash
npm run dev              # Start development server with Turbopack
npx inngest-cli dev     # Run Inngest dev server (required for background jobs)
```

### Database Operations
```bash
npx prisma db push      # Push schema changes to database (development)
npx prisma migrate dev  # Create and apply migrations (production)
npm run db:seed         # Seed database with admin user (admin@example.com / admin123)
```

### Build & Deployment
```bash
npm run build           # Build for production (includes prisma generate)
npm run lint            # Run ESLint
```

### Common Fixes
```bash
npx prisma generate     # Regenerate Prisma client after schema changes
npm install             # Triggers postinstall which runs prisma generate
```

## Architecture & Key Patterns

### Authentication Flow
- Uses NextAuth.js with JWT strategy and credential provider
- Session data stored in JWT tokens, not database
- Protected routes use middleware (`src/middleware.ts`) 
- Client components use `useSession()` hook with proper loading states
- API routes verify session with `getServerSession(authOptions)`

### Research Processing Pipeline
1. **Session Creation** → User creates research session with initial prompt
2. **Node Creation** → Research node created with selected AI model (stored as `modelId`)
3. **Task Generation** → Single or multiple tasks created based on data source
4. **Inngest Processing** → Background jobs handle:
   - `research/batch.created` → Updates node status, triggers individual tasks
   - `research/task.created` → Calls OpenAI API, saves results
   - `table/generation.requested` → Uses Gemini to structure data into tables
5. **Status Updates** → Node marked complete when all tasks finish
6. **UI Polling** → Session page auto-refreshes every 5 seconds when tasks active

### Database Schema Key Relationships
- `ResearchSession` → has many `ResearchNode` (hierarchical tree)
- `ResearchNode` → has many `ResearchTask` (parallel processing)
- `ResearchNode` → has one `TableConfig` and `GeneratedTable`
- Cascade deletes configured throughout

### API Integration Patterns

#### OpenAI Integration (`src/lib/openai-client.ts`)
- Uses official `openai` npm package
- Cleans API keys with regex to remove whitespace
- `listModels()` discovers available models dynamically
- `deepResearch()` accepts model parameter for flexibility
- **Rate Limit Handling:**
  - Exponential backoff with jitter for 429 errors
  - Reads retry-after header from API responses
  - Logs rate limit details from response headers
  - Deep research models use /v1/responses endpoint with strict monthly limits

#### Gemini Integration (`src/lib/gemini-client.ts`)
- Direct REST API calls (no official SDK)
- Structured JSON output for table generation
- Large context window handles multiple research reports

#### Inngest Functions (`src/lib/inngest/functions/`)
- Step functions for reliability and observability
- Explicit error handling with status updates
- Throttling configured (10 tasks/60s)
- Reasoning models (o1, o3): Special batching (3 tasks at a time with 15s delays)
- **Timeout Limits**: While Inngest claims 2-hour support, practical limits are ~50-55 minutes before FUNCTION_INVOCATION_TIMEOUT
- **Deep Research**: Limited to 50-minute chunks; very long tasks should be broken into smaller queries
- Event-driven architecture for chaining operations

### UI State Management
- Server-side data fetching in API routes
- Client-side polling for real-time updates
- Zustand for complex client state (if needed)
- No global state for auth - use `useSession()` hook

### Common Gotchas & Solutions

0. **Deep Research Model Timeouts**: Deep research models can take 20-30 minutes
   - Vercel/serverless platforms have max timeouts (5-15 min)
   - Inngest functions timeout even with extended configuration  
   - **Solution**: Use standard models (GPT-4o) for production workloads
   - **Future**: Implement proper background job queue for deep research

1. **API Key Formatting**: OpenAI keys may have embedded newlines - always clean with `.replace(/\s+/g, '')`

2. **Next.js 15 Route Params**: All dynamic route params are Promises:
   ```typescript
   { params }: { params: Promise<{ id: string }> }
   const { id } = await params
   ```

3. **Prisma Client Generation**: Required after schema changes and on deployment
   - Build script includes `prisma generate`
   - Postinstall script ensures client exists after npm install

4. **Task Status Flow**: 
   - Task: `pending` → `processing` → `completed`/`failed`
   - Node: `pending` → `processing` → `completed` (only after ALL tasks done)

5. **Environment Variables**:
   - Vercel needs `NEXTAUTH_URL` set to production URL (not localhost)
   - `NEXTAUTH_SECRET` must be consistent across deployments
   - Database URLs: Use `POSTGRES_PRISMA_URL` for Prisma, `POSTGRES_URL_NON_POOLING` for migrations

## Testing Considerations

No test framework is currently set up. When implementing tests:
- API routes can be tested with Next.js route handlers
- Inngest functions have built-in testing capabilities
- Database operations should use transaction rollbacks

## Performance Optimization Points

1. **Database Queries**: Session endpoint includes nested relations - consider pagination for large datasets
2. **Polling Interval**: 5-second refresh may be aggressive for many concurrent users
3. **Rate Limit Management**: 
   - Standard models: 10 tasks/minute via Inngest throttling
   - Reasoning models: Batched processing (3 tasks at a time with 15s delays)
   - OpenAI API Rate limits (tier-based, not subscription-based):
     - **Tier 1 (New accounts)**: Basic limits
     - **Tier 2**: $50+ spent, 7+ days - Higher limits
     - **Tier 5**: $1,000+ spent, 30+ days - Highest limits
     - **o3-mini**: 25-50 RPM, 60K-150K TPM (tier-dependent)
     - **GPT-4o**: Higher limits than reasoning models
   - Monitor x-ratelimit headers in responses
   - Use exponential backoff for retries
   - Tier upgrades based on API spending, not time
4. **Model Selection**: 
   - Reasoning models (o1, o3) have lower RPM/TPM limits
   - Standard models (GPT-4o) better for high-volume tasks
   - API tier affects available rate limits
   - Consider cost vs quality vs rate limit tradeoffs