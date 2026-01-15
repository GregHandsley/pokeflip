# Code Review Process

## Overview

This document outlines the code review process for the pokeflip project to ensure code quality, consistency, and maintainability.

## Pre-Commit Checks

Before committing code, the following checks run automatically via pre-commit hooks:

- **ESLint**: Validates code style and catches common errors
- **Prettier**: Formats code consistently
- **TypeScript**: Type checking (manual: `pnpm typecheck`)

### Running Checks Manually

```bash
# Lint code
pnpm lint

# Fix linting issues automatically
pnpm lint:fix

# Format code with Prettier
pnpm format

# Check formatting without changing files
pnpm format:check

# Type check
pnpm typecheck
```

## Code Review Checklist

When reviewing code, consider the following:

### Functionality

- [ ] Does the code work as intended?
- [ ] Are edge cases handled?
- [ ] Are error cases handled appropriately?
- [ ] Are there appropriate tests (if applicable)?

### Code Quality

- [ ] Is the code readable and well-commented?
- [ ] Are function and variable names clear and descriptive?
- [ ] Is code duplicated unnecessarily? (Use shared utilities when possible)
- [ ] Are imports organized and unused imports removed?
- [ ] Are TypeScript types properly defined?

### Performance

- [ ] Are database queries optimized?
- [ ] Are unnecessary re-renders avoided (React)?
- [ ] Are API calls properly cached where appropriate?
- [ ] Are large operations broken into smaller chunks if needed?

### Security

- [ ] Are user inputs validated and sanitized?
- [ ] Are API endpoints properly secured?
- [ ] Are sensitive operations properly authenticated?
- [ ] Are error messages not exposing sensitive information?

### Best Practices

- [ ] Follows existing code patterns and conventions
- [ ] Uses shared utilities instead of duplicating code
- [ ] Proper error handling with logging
- [ ] Audit logging for important actions
- [ ] Accessibility considerations (ARIA labels, keyboard navigation)

## Review Process

1. **Create Pull Request**: Create a PR with a clear description of changes
2. **Automatic Checks**: CI runs linting, type checking, and build
3. **Code Review**: At least one team member reviews the code
4. **Address Feedback**: Make requested changes and push updates
5. **Approval**: Once approved, the PR can be merged

## Code Style Guidelines

### TypeScript

- Use explicit types for function parameters and return values
- Avoid `any` types - use `unknown` or proper types instead
- Use interfaces for object shapes, types for unions/intersections
- Prefer `const` over `let`, avoid `var`

### React Components

- Use functional components with hooks
- Extract reusable logic into custom hooks
- Use TypeScript interfaces for props
- Keep components focused and small
- Use meaningful component and prop names

### API Routes

- Use proper HTTP status codes
- Return consistent error response format
- Validate all inputs
- Log errors appropriately
- Handle edge cases

### File Organization

- Group related files together
- Use index files for clean imports
- Keep files focused (single responsibility)
- Use descriptive file and folder names

### Comments

- Write self-documenting code (clear names > comments)
- Add comments for complex logic or business rules
- Document public APIs and functions
- Keep comments up to date with code changes

## Common Issues to Watch For

### Code Duplication

- Look for repeated patterns that could be extracted to utilities
- Check for duplicate formatting functions (use `lib/utils/format.ts`)
- Extract common logic into shared functions or hooks

### Error Handling

- Ensure all async operations have error handling
- Use try-catch blocks appropriately
- Don't swallow errors silently (log them)
- Provide meaningful error messages to users

### Type Safety

- Avoid type assertions (`as`) unless necessary
- Use type guards for runtime type checking
- Prefer discriminated unions for type narrowing
- Use proper null/undefined handling

### Performance

- Avoid N+1 query patterns in database operations
- Use React.memo, useMemo, useCallback appropriately
- Don't create unnecessary re-renders
- Optimize bundle size (avoid large dependencies)

## Tools

- **ESLint**: Code linting and style checking
- **Prettier**: Code formatting
- **TypeScript**: Static type checking
- **Husky**: Git hooks
- **lint-staged**: Run linters on staged files
- **CI/CD**: Automated checks on pull requests

## Getting Help

If you have questions about the code review process or need help:

- Check existing code for patterns
- Review documentation in `/docs`
- Ask team members for clarification
- Reference this guide
