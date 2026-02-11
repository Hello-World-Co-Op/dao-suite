# DAO Suite

DAO member dashboard suite for the Hello World Co-Op platform. Provides a dedicated interface for DAO governance, membership management, treasury viewing, token operations, and member directory.

## Features

- **Dashboard** - Member overview with account info, quick actions, and navigation
- **Proposals** - Browse, create, and vote on governance proposals with AI-assisted drafting (Think Tank)
- **Voting** - Cast votes with real-time tally updates and countdown timers
- **Membership** - View membership status, renewal flow, and payment history
- **Treasury** - View DAO treasury balances and transaction history
- **Token Balance** - View DOM token balance with burn donation support
- **Escrow** - View escrow contracts, milestones, and release status
- **Member Directory** - Browse DAO members with search, filtering, and contact requests
- **Notifications** - In-app notification system with configurable preferences
- **Settings** - Account settings, Internet Identity linking, and device management

## Architecture

This is a standalone React + Vite application deployed as an IC asset canister. It consumes shared packages from the Hello World Co-Op ecosystem:

- `@hello-world-co-op/api` - Shared API types and canister client utilities
- `@hello-world-co-op/auth` - Authentication hooks, providers, and session management
- `@hello-world-co-op/ui` - Shared UI component library

Authentication is handled by the FounderyOS suite. The dao-suite redirects unauthenticated users to the FounderyOS login page, which redirects back after successful authentication.

### Tech Stack

- **Frontend**: React 19, TypeScript, Vite 5
- **Styling**: Tailwind CSS 3, shadcn/ui components
- **State Management**: Nanostores (cross-framework compatible)
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v7
- **IC Integration**: @dfinity/agent, @dfinity/auth-client
- **Testing**: Vitest + React Testing Library (unit), Playwright (E2E)

## Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Access to `@hello-world-co-op` GitHub Packages (for shared deps)

### Installation

```bash
# Clone the repository
git clone https://github.com/Hello-World-Co-Op/dao-suite.git
cd dao-suite

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your canister IDs and configuration
```

### Development

```bash
# Start development server (port 5174)
npm run dev

# Start with auth bypass for local development
npm run dev:qa
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

### Building

```bash
# Production build (includes TypeScript check)
npm run build

# Preview production build
npm run preview
```

### Linting

```bash
npm run lint
```

## Deployment

The application is deployed as an IC asset canister. CI/CD is configured via GitHub Actions:

- **CI** (`ci.yml`): Runs lint, typecheck, test, build, and E2E on every push/PR to main
- **Deploy** (`deploy-staging.yml`): Deploys to IC staging on push to main

### Manual Deployment

```bash
# Deploy to local replica
dfx deploy --network local

# Deploy to IC staging
dfx deploy dao_suite_assets --network ic
```

### Environment Variables

See `.env.example` for all available configuration options. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_IC_HOST` | IC replica host | `http://127.0.0.1:4943` |
| `VITE_AUTH_SERVICE_CANISTER_ID` | Auth service canister | - |
| `VITE_GOVERNANCE_CANISTER_ID` | Governance canister | - |
| `VITE_TREASURY_CANISTER_ID` | Treasury canister | - |
| `VITE_FOUNDERY_OS_URL` | FounderyOS URL (for login redirect) | `http://127.0.0.1:5174` |
| `VITE_DEV_AUTH_BYPASS` | Skip auth in development | `false` |

## Project Structure

```
src/
  App.tsx                  # Root component with routing and auth guards
  main.tsx                 # Entry point
  components/              # Shared components
    ui/                    # Base UI components (shadcn/ui bridge pattern)
    ProtectedRoute.tsx     # Authentication route guard
    ErrorBoundary.tsx      # Error boundary wrapper
    Toast.tsx              # Toast notification component
    ...
  features/                # Feature modules
    proposal-creation/     # AI-assisted proposal wizard
    proposals/             # Proposal listing and filtering
    voting/                # Voting panel and tally display
    settings/              # Account settings
  pages/                   # Route-level page components
  stores/                  # Nanostores state management
    atoms/                 # Individual store atoms
  services/                # API and canister service clients
  hooks/                   # Custom React hooks
  utils/                   # Utility functions
  types/                   # TypeScript type definitions
  test/                    # Test setup and utilities
```
