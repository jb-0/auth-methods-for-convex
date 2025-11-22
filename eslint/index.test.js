/**
 * Tests for the eslint-plugin-convex-auth custom rule
 */

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import convexAuthPlugin from './index.js';
import tsParser from '@typescript-eslint/parser';

const ruleTester = new RuleTester({
    languageOptions: {
        parser: tsParser,
        parserOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
    },
});

const rule = convexAuthPlugin.rules['no-direct-query-mutation'];

describe('no-direct-query-mutation', () => {
    it('should pass all valid test cases', () => {
        ruleTester.run('no-direct-query-mutation', rule, {
            valid: [
                // Should allow authenticatedQuery
                {
                    code: `
            import { authenticatedQuery } from './auth';
            export const get = authenticatedQuery({
              args: {},
              handler: async () => {},
            });
          `,
                    filename: 'convex/notes.ts',
                },
                // Should allow authenticatedMutation
                {
                    code: `
            import { authenticatedMutation } from './auth';
            export const create = authenticatedMutation({
              args: {},
              handler: async () => {},
            });
          `,
                    filename: 'convex/notes.ts',
                },
                // Should allow query/mutation in auth.ts (where they're implemented)
                {
                    code: `
            import { query } from './_generated/server';
            export const authenticatedQuery = () => {
              return query({});
            };
          `,
                    filename: 'convex/auth.ts',
                },
                {
                    code: `
            import { mutation } from './_generated/server';
            export const authenticatedMutation = () => {
              return mutation({});
            };
          `,
                    filename: 'convex/auth.ts',
                },
                // Should allow query/mutation imported from other places
                {
                    code: `
            import { query } from 'some-other-module';
            export const something = query({});
          `,
                    filename: 'convex/notes.ts',
                },
                // Should allow query/mutation not imported from _generated/server
                {
                    code: `
            import { mutation } from './utils';
            export const create = mutation({});
          `,
                    filename: 'convex/notes.ts',
                },
                // Should allow other function calls named query/mutation
                {
                    code: `
            export const test = someQuery();
            export const test2 = someMutation();
          `,
                    filename: 'convex/notes.ts',
                },
                // Should allow when query/mutation are imported but not called
                {
                    code: `
            import { query, mutation } from './_generated/server';
            // Just importing, not using
          `,
                    filename: 'convex/notes.ts',
                },
            ],
            invalid: [],
        });
    });

    it('should fail on invalid test cases', () => {
        ruleTester.run('no-direct-query-mutation', rule, {
            valid: [],
            invalid: [
                // Should error on direct query() usage
                {
                    code: `
            import { query } from './_generated/server';
            export const get = query({
              args: {},
              handler: async () => {},
            });
          `,
                    filename: 'convex/notes.ts',
                    errors: [
                        {
                            messageId: 'useAuthenticatedQuery',
                            type: 'Identifier',
                        },
                    ],
                },
                // Should error on direct mutation() usage
                {
                    code: `
            import { mutation } from './_generated/server';
            export const create = mutation({
              args: {},
              handler: async () => {},
            });
          `,
                    filename: 'convex/notes.ts',
                    errors: [
                        {
                            messageId: 'useAuthenticatedMutation',
                            type: 'Identifier',
                        },
                    ],
                },
                // Should error when both query and mutation are imported and used
                {
                    code: `
            import { query, mutation } from './_generated/server';
            export const get = query({});
            export const create = mutation({});
          `,
                    filename: 'convex/some-file.ts',
                    errors: [
                        {
                            messageId: 'useAuthenticatedQuery',
                            type: 'Identifier',
                        },
                        {
                            messageId: 'useAuthenticatedMutation',
                            type: 'Identifier',
                        },
                    ],
                },
                // Should error with different import path variations
                {
                    code: `
            import { query } from '../_generated/server';
            export const get = query({});
          `,
                    filename: 'convex/subfolder/notes.ts',
                    errors: [
                        {
                            messageId: 'useAuthenticatedQuery',
                            type: 'Identifier',
                        },
                    ],
                },
                {
                    code: `
            import { mutation } from 'convex/_generated/server';
            export const create = mutation({});
          `,
                    filename: 'convex/notes.ts',
                    errors: [
                        {
                            messageId: 'useAuthenticatedMutation',
                            type: 'Identifier',
                        },
                    ],
                },
            ],
        });
    });
});

const noGetUserIdentityRule =
    convexAuthPlugin.rules['no-getuseridentity-in-authenticated'];

describe('no-getuseridentity-in-authenticated', () => {
    it('should pass all valid test cases', () => {
        ruleTester.run(
            'no-getuseridentity-in-authenticated',
            noGetUserIdentityRule,
            {
                valid: [
                    // Should allow ctx.auth.getUserIdentity() in auth.ts
                    {
                        code: `
            export const authenticatedQuery = () => {
              const identity = await ctx.auth.getUserIdentity();
              if (!identity) {
                throw new Error('Not authenticated');
              }
            };
          `,
                        filename: 'convex/auth.ts',
                    },
                    // Should allow ctx.auth.getUserIdentity() outside authenticated handlers
                    {
                        code: `
            export const someFunction = () => {
              const identity = await ctx.auth.getUserIdentity();
            };
          `,
                        filename: 'convex/notes.ts',
                    },
                    // Should allow using ctx.identity inside authenticated handlers
                    {
                        code: `
            import { authenticatedQuery } from './auth';
            export const get = authenticatedQuery({
              args: {},
              handler: async (ctx) => {
                return ctx.identity.subject;
              },
            });
          `,
                        filename: 'convex/notes.ts',
                    },
                    {
                        code: `
            import { authenticatedMutation } from './auth';
            export const create = authenticatedMutation({
              args: {},
              handler: async (ctx) => {
                const userId = ctx.identity.subject;
                return userId;
              },
            });
          `,
                        filename: 'convex/notes.ts',
                    },
                ],
                invalid: [],
            }
        );
    });

    it('should fail on invalid test cases', () => {
        ruleTester.run(
            'no-getuseridentity-in-authenticated',
            noGetUserIdentityRule,
            {
                valid: [],
                invalid: [
                    // Should error on ctx.auth.getUserIdentity() in authenticatedQuery handler
                    {
                        code: `
            import { authenticatedQuery } from './auth';
            export const get = authenticatedQuery({
              args: {},
              handler: async (ctx) => {
                const identity = await ctx.auth.getUserIdentity();
                if (!identity) {
                  throw new Error('Not authenticated');
                }
                return ctx.identity.subject;
              },
            });
          `,
                        filename: 'convex/notes.ts',
                        errors: [
                            {
                                messageId: 'useContextIdentity',
                                type: 'MemberExpression',
                            },
                        ],
                    },
                    // Should error on ctx.auth.getUserIdentity() in authenticatedMutation handler
                    {
                        code: `
            import { authenticatedMutation } from './auth';
            export const create = authenticatedMutation({
              args: {},
              handler: async (ctx) => {
                const identity = await ctx.auth.getUserIdentity();
                return identity.subject;
              },
            });
          `,
                        filename: 'convex/notes.ts',
                        errors: [
                            {
                                messageId: 'useContextIdentity',
                                type: 'MemberExpression',
                            },
                        ],
                    },
                    // Should error with different import paths
                    {
                        code: `
            import { authenticatedQuery } from '../auth';
            export const get = authenticatedQuery({
              args: {},
              handler: async (ctx) => {
                const id = await ctx.auth.getUserIdentity();
                return id?.subject;
              },
            });
          `,
                        filename: 'convex/subfolder/notes.ts',
                        errors: [
                            {
                                messageId: 'useContextIdentity',
                                type: 'MemberExpression',
                            },
                        ],
                    },
                    // Should error even with function expression syntax
                    {
                        code: `
            import { authenticatedMutation } from './auth';
            export const deleteNote = authenticatedMutation({
              args: {},
              handler: async function(ctx) {
                const identity = await ctx.auth.getUserIdentity();
                if (!identity) {
                  throw new Error('Not authenticated');
                }
              },
            });
          `,
                        filename: 'convex/notes.ts',
                        errors: [
                            {
                                messageId: 'useContextIdentity',
                                type: 'MemberExpression',
                            },
                        ],
                    },
                    // Should error even in nested functions inside the handler
                    {
                        code: `
            import { authenticatedQuery } from './auth';
            export const get = authenticatedQuery({
              args: {},
              handler: async (ctx) => {
                const helper = async () => {
                  const identity = await ctx.auth.getUserIdentity();
                };
                return ctx.identity.subject;
              },
            });
          `,
                        filename: 'convex/notes.ts',
                        errors: [
                            {
                                messageId: 'useContextIdentity',
                                type: 'MemberExpression',
                            },
                        ],
                    },
                ],
            }
        );
    });
});

