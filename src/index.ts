import { PropertyValidators, Infer, Validator } from 'convex/values';
import type { QueryBuilder, MutationBuilder, GenericQueryCtx, GenericMutationCtx, ArgsArrayForOptionalValidator, RegisteredQuery, RegisteredMutation } from 'convex/server';

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
    DataModel extends Record<string, any> = Record<string, any>,
    Visibility extends 'public' | 'internal' = 'public',
>(options: {
    query: QueryBuilder<DataModel, Visibility>;
    mutation: MutationBuilder<DataModel, Visibility>;
}) {
    const { query, mutation } = options;

    /**
     * Authenticated query - automatically requires authentication
     */
    const authenticatedQuery = <
        Args extends PropertyValidators,
        Return,
    >(definition: {
        args: Args;
        returns?: Validator<Return, any, any>;
        handler: (
            ctx: QueryCtx & { identity: { subject: string } },
            args: InferArgs<Args>
        ) => Promise<Return>;
    }): RegisteredQuery<Visibility, InferArgs<Args>, Promise<Return>> => {
        return query({
            args: definition.args,
            returns: definition.returns,
            handler: async (ctx: GenericQueryCtx<DataModel> & { auth: { getUserIdentity(): Promise<{ subject: string } | null> } }, ...args: ArgsArrayForOptionalValidator<Args>) => {
                const identity = await ctx.auth.getUserIdentity();
                if (!identity) {
                    throw new Error('Not authenticated');
                }
                return definition.handler(
                    { ...ctx, identity } as unknown as QueryCtx & { identity: { subject: string } },
                    args[0] as InferArgs<Args>
                ) as any;
            },
        });
    };

    /**
     * Authenticated mutation - automatically requires authentication
     */
    const authenticatedMutation = <
        Args extends PropertyValidators,
        Return,
    >(definition: {
        args: Args;
        returns?: Validator<Return, any, any>;
        handler: (
            ctx: MutationCtx & { identity: { subject: string } },
            args: InferArgs<Args>
        ) => Promise<Return>;
    }): RegisteredMutation<Visibility, InferArgs<Args>, Promise<Return>> => {
        return mutation({
            args: definition.args,
            returns: definition.returns,
            handler: async (ctx: GenericMutationCtx<DataModel> & { auth: { getUserIdentity(): Promise<{ subject: string } | null> } }, ...args: ArgsArrayForOptionalValidator<Args>) => {
                const identity = await ctx.auth.getUserIdentity();
                if (!identity) {
                    throw new Error('Not authenticated');
                }
                return definition.handler(
                    { ...ctx, identity } as unknown as MutationCtx & { identity: { subject: string } },
                    args[0] as InferArgs<Args>
                ) as any;
            },
        });
    };

    return {
        authenticatedQuery,
        authenticatedMutation,
    };
}

