# Contributing to AgriSense

We welcome contributions! This document outlines the process and conventions.

## Getting Started

1. Read the [README](README.md) for project overview and setup
2. Browse [docs/](docs/) for architecture, API, and design docs
3. Check `AGENTS.md` for detailed development commands and quirks

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes following the conventions below
4. Run validation commands (lint, type-check, tests)
5. Commit with a descriptive message (see conventions below)
6. Push and open a Pull Request against `main`
7. Ensure CI passes (lint, test, build)

## Coding Conventions

### General
- Write clear, self-documenting code — avoid unnecessary comments
- Follow existing patterns in the codebase
- No `any` types in TypeScript; use proper type definitions
- Handle errors explicitly — never swallow errors silently

### Go (Backend)
- Run `golangci-lint run ./...` before committing
- Use table-driven tests with `testing/pkg`
- Every exported function needs a doc comment
- Use `context` passing for all external calls
- Dependency injection via constructor parameters (no global state)

### TypeScript/React (Frontend)
- Run `npm run lint` and `npx tsc --noEmit` before committing
- Favor feature-based organization under `src/features/`
- Shared UI components go in `src/shared/`
- Use MUI styled components and the project's Tailwind v4 setup
- All new components must be TypeScript with proper interfaces

## Commit Message Format

```
<type>: <short description>

<optional longer description>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`

Examples:
- `feat: add soil moisture threshold alert`
- `fix: handle device disconnect race condition`
- `docs: update API endpoint reference`

## Validation Checklist

Before opening a PR, run:

```bash
# Backend
cd backend
go test ./... -v
golangci-lint run ./...

# Frontend
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

## Questions?

Open a GitHub Discussion or reach out to the maintainers.
