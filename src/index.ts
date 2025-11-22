import { PropertyValidators, Infer } from 'convex/values';

/**
 * Utility type to infer argument types from PropertyValidators
 */
export type InferArgs<Args extends PropertyValidators> = {
    [K in keyof Args]: Infer<Args[K]>;
};

/**
 * Factory function to create authenticated query and mutation wrappers
 * 
 * @param options - Object containing the query and mutation functions from Convex
 * @returns Object with authenticatedQuery and authenticatedMutation functions
 * 
 * @example
 * ```typescript
 * import { query, mutation, QueryCtx, MutationCtx } from './_generated/server';
 * import { createAuthenticatedMethods } from 'auth-methods-for-convex';
 * 
 * const { authenticatedQuery, authenticatedMutation } = createAuthenticatedMethods({
 *   query,
 *   mutation,
 * });
 * ```
 */
export function createAuthenticatedMethods<
    QueryCtx extends { auth: { getUserIdentity(): Promise<{ subject: string } | null> } },
    MutationCtx extends { auth: { getUserIdentity(): Promise<{ subject: string } | null> } },
>(options: {
    query: any;
    mutation: any;
}) {
    const { query, mutation } = options;

    /**
     * Authenticated query - automatically requires authentication
     */
    const authenticatedQuery = <
        Args extends PropertyValidators,
        Return = unknown,
    >(definition: {
        args: Args;
        handler: (
            ctx: QueryCtx & { identity: { subject: string } },
            args: InferArgs<Args>
        ) => Promise<Return>;
    }) => {
        return query({
            args: definition.args,
            handler: async (ctx: QueryCtx, ...args: any[]) => {
                const identity = await ctx.auth.getUserIdentity();
                if (!identity) {
                    throw new Error('Not authenticated');
                }
                return definition.handler(
                    { ...ctx, identity },
                    args[0] as InferArgs<Args>
                );
            },
        });
    };

    /**
     * Authenticated mutation - automatically requires authentication
     */
    const authenticatedMutation = <
        Args extends PropertyValidators,
        Return = unknown,
    >(definition: {
        args: Args;
        handler: (
            ctx: MutationCtx & { identity: { subject: string } },
            args: InferArgs<Args>
        ) => Promise<Return>;
    }) => {
        return mutation({
            args: definition.args,
            handler: async (ctx: MutationCtx, ...args: any[]) => {
                const identity = await ctx.auth.getUserIdentity();
                if (!identity) {
                    throw new Error('Not authenticated');
                }
                return definition.handler(
                    { ...ctx, identity },
                    args[0] as InferArgs<Args>
                );
            },
        });
    };

    return {
        authenticatedQuery,
        authenticatedMutation,
    };
}

