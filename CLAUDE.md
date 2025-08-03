# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BrandPulse is a multi-tenant brand perception monitoring platform built with NestJS. It provides web scraping, sentiment analysis, and analytics for brand mentions across various social media platforms.

## Development Commands

### Core Commands
- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build the application 
- `npm run start:prod` - Start production server
- `npm run lint` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier

### Testing
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

## Architecture Overview

### Multi-Tenant Structure
The application uses a multi-tenant architecture where:
- Each tenant represents a company/organization
- Users belong to tenants and have roles (owner, admin, user)
- All data is scoped by tenant_id for isolation
- Authentication uses JWT with tenant context

### Key Modules
- **Auth Module** (`src/auth/`) - Multi-tenant authentication and authorization
- **Brands Module** (`src/brands/`) - Brand management within tenants
- **Scraper Jobs Module** (`src/modules/scraper-jobs/`) - Web scraping job management using Apify
- **Analytics Module** (`src/modules/analytics/`) - Sentiment analysis and reporting
- **Mentions Module** (`src/modules/mentions/`) - Social media mention management
- **Sentiment Module** (`src/modules/sentiment/`) - AI-powered sentiment analysis using OpenAI

### Data Flow
1. Users create scraper jobs for specific brands and social platforms
2. Jobs run via Apify actors to collect social media mentions
3. Mentions are processed through OpenAI for sentiment analysis
4. Analytics service aggregates data for dashboards and exports

## Database & External Services

### Supabase Integration
- **Database**: PostgreSQL via Supabase
- **Authentication**: Supabase Auth for user management
- **Two clients**: Regular client for user operations, admin client for system operations
- **Service location**: `src/modules/shared/supabase/supabase.service.ts`

### Third-Party Services
- **Apify**: Web scraping platform for social media data collection
- **OpenAI**: GPT models for sentiment analysis
- **Winston**: Structured logging with context-aware loggers

## Environment Variables
Critical environment variables (see `src/config/env.validation.ts`):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` - Database access
- `JWT_SECRET` - JWT token signing
- `APIFY_TOKEN` - Web scraping service
- `OPENAI_API_KEY` - AI sentiment analysis
- `NODE_ENV` - Environment (development/production/test)

## Security & Authentication

### Multi-Tenant Security
- All database queries MUST include tenant_id filtering
- Use `@CurrentTenant()` decorator to get tenant context
- Use `@CurrentUser()` decorator for user context
- JWT tokens contain both user and tenant information

### Guards and Decorators
- `JwtAuthGuard` - Validates JWT tokens
- `TenantGuard` - Ensures tenant-scoped access
- All protected endpoints should use both guards

## Key Patterns

### Service Structure
- Services use dependency injection for Supabase, logging, and external APIs
- Logger contexts are set per service for structured logging
- Error handling with appropriate HTTP exceptions

### Database Queries
- Always use `adminClient` for system operations
- Include tenant_id in all queries for data isolation
- Use Supabase RPC functions for complex analytics queries

### Logging
- Context-aware logging with `LoggerService.setContext()`
- Log important operations with structured data
- Different log levels: info, debug, warn, error

## Development Notes

### Code Organization
- DTOs in `dto/` subdirectories for request/response validation
- Entities in `entities/` subdirectories for type definitions
- Shared services in `src/modules/shared/`
- Common utilities in `src/common/`

### Testing Approach
- Unit tests co-located with source files (`.spec.ts`)
- E2E tests in `/test` directory
- Mock external services (Supabase, Apify, OpenAI) in tests

### Docker Support
- Multi-stage Dockerfile for production builds
- Docker Compose for local development
- Health checks included for container orchestration