# auth-methods-for-convex

Authentication wrapper functions for Convex queries and mutations with ESLint rules to enforce their usage.

## Installation

```bash
npm install auth-methods-for-convex
```

## Usage

### 1. Create your local auth.ts file

In your Convex project, create a `convex/auth.ts` file that uses the factory function:

```typescript
import { query, mutation, QueryCtx, MutationCtx } from './_generated/server';
import { createAuthenticatedMethods } from 'auth-methods-for-convex';

const { authenticatedQuery, authenticatedMutation } = createAuthenticatedMethods<
  QueryCtx,
  MutationCtx
>({
  query,
  mutation,
});

export { authenticatedQuery, authenticatedMutation };
```

### 2. Use in your Convex functions

Now you can use `authenticatedQuery` and `authenticatedMutation` in your Convex functions:

```typescript
// convex/notes.ts
import { v } from 'convex/values';
import { authenticatedMutation, authenticatedQuery } from './auth';

export const get = authenticatedQuery({
  args: {},
  handler: async (ctx) => {
    // ctx.identity is automatically available
    return await ctx.db
      .query('notes')
      .withIndex('by_user', (q) => q.eq('userId', ctx.identity.subject))
      .order('desc')
      .collect();
  },
});

export const create = authenticatedMutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const noteId = await ctx.db.insert('notes', {
      userId: ctx.identity.subject,
      text: args.text,
      createdAt: Date.now(),
    });
    return noteId;
  },
});
```

### 3. Configure ESLint

Add the ESLint plugin to your ESLint configuration:

```javascript
// eslint.config.mjs
import convexAuthPlugin from 'auth-methods-for-convex/eslint';

export default {
  plugins: {
    'convex-auth': convexAuthPlugin,
  },
  rules: {
    // Enforce authenticatedQuery/authenticatedMutation over query/mutation
    'convex-auth/no-direct-query-mutation': 'error',
    // Prevent ctx.auth.getUserIdentity() inside authenticated handlers
    'convex-auth/no-getuseridentity-in-authenticated': 'error',
  },
};
```

## Features

- **Automatic Authentication**: `authenticatedQuery` and `authenticatedMutation` automatically check for authentication and throw an error if the user is not authenticated
- **Type Safety**: Full TypeScript support with proper type inference
- **Identity Access**: The authenticated identity is automatically available as `ctx.identity` in your handlers
- **ESLint Rules**: Enforce the use of authenticated methods and prevent common mistakes

## ESLint Rules

### `no-direct-query-mutation`

Prevents direct use of `query()` and `mutation()` from `_generated/server`, enforcing the use of `authenticatedQuery()` and `authenticatedMutation()` instead.

### `no-getuseridentity-in-authenticated`

Prevents the use of `ctx.auth.getUserIdentity()` inside `authenticatedQuery` and `authenticatedMutation` handlers. Use `ctx.identity` instead, which is already provided.

## TypeScript Support

The package is written in TypeScript and includes full type definitions. The factory function accepts generic type parameters for `QueryCtx` and `MutationCtx` to ensure type safety.

## License

MIT

