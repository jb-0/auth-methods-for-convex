import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthenticatedMethods } from './index';
import type { PropertyValidators } from 'convex/values';

// Mock types for Convex context
type MockQueryCtx = {
    auth: {
        getUserIdentity(): Promise<{ subject: string } | null>;
    };
    db: any;
};

type MockMutationCtx = {
    auth: {
        getUserIdentity(): Promise<{ subject: string } | null>;
    };
    db: any;
};

describe('createAuthenticatedMethods', () => {
    let mockQuery: ReturnType<typeof vi.fn>;
    let mockMutation: ReturnType<typeof vi.fn>;
    let authenticatedQuery: ReturnType<typeof createAuthenticatedMethods>['authenticatedQuery'];
    let authenticatedMutation: ReturnType<typeof createAuthenticatedMethods>['authenticatedMutation'];

    beforeEach(() => {
        // Reset mocks before each test
        mockQuery = vi.fn((definition: any) => {
            // Return a function that calls the handler
            return async (...args: any[]) => {
                return definition.handler(...args);
            };
        });

        mockMutation = vi.fn((definition: any) => {
            // Return a function that calls the handler
            return async (...args: any[]) => {
                return definition.handler(...args);
            };
        });

        const methods = createAuthenticatedMethods<MockQueryCtx, MockMutationCtx>({
            query: mockQuery,
            mutation: mockMutation,
        });

        authenticatedQuery = methods.authenticatedQuery;
        authenticatedMutation = methods.authenticatedMutation;
    });

    describe('authenticatedQuery', () => {
        it('should call query with wrapped handler', () => {
            const handler = vi.fn();
            authenticatedQuery({
                args: {},
                handler,
            });

            expect(mockQuery).toHaveBeenCalledTimes(1);
            const callArgs = mockQuery.mock.calls[0][0];
            expect(callArgs).toHaveProperty('args');
            expect(callArgs).toHaveProperty('handler');
            expect(typeof callArgs.handler).toBe('function');
        });

        it('should pass through args correctly', () => {
            const args = {
                id: 'test-id',
                name: 'test-name',
            };

            authenticatedQuery({
                args: {} as PropertyValidators,
                handler: vi.fn(),
            });

            const callArgs = mockQuery.mock.calls[0][0];
            expect(callArgs.args).toEqual({});
        });

        it('should throw error when identity is null', async () => {
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(null),
                },
                db: {},
            };

            const handler = vi.fn();
            const queryFn = authenticatedQuery({
                args: {},
                handler,
            });

            // Execute the query function
            const wrappedHandler = mockQuery.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Not authenticated');
            expect(handler).not.toHaveBeenCalled();
        });

        it('should throw error when identity is undefined', async () => {
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(undefined as any),
                },
                db: {},
            };

            const handler = vi.fn();
            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Not authenticated');
            expect(handler).not.toHaveBeenCalled();
        });

        it('should inject identity into context when authenticated', async () => {
            const identity = { subject: 'user-123' };
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const handler = vi.fn().mockResolvedValue('success');
            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;
            const result = await wrappedHandler(mockCtx, {});

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockCtx,
                    identity,
                }),
                {}
            );
            expect(result).toBe('success');
        });

        it('should pass args correctly to handler', async () => {
            const identity = { subject: 'user-123' };
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const testArgs = { id: 'test-id', count: 42 };
            const handler = vi.fn().mockResolvedValue('result');
            authenticatedQuery({
                args: {} as PropertyValidators,
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;
            await wrappedHandler(mockCtx, testArgs);

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    identity,
                }),
                testArgs
            );
        });

        it('should handle async handler correctly', async () => {
            const identity = { subject: 'user-123' };
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const handler = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'async-result';
            });

            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;
            const result = await wrappedHandler(mockCtx, {});

            expect(result).toBe('async-result');
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should propagate errors from handler', async () => {
            const identity = { subject: 'user-123' };
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const error = new Error('Handler error');
            const handler = vi.fn().mockRejectedValue(error);

            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Handler error');
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should handle getUserIdentity errors', async () => {
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockRejectedValue(new Error('Auth service error')),
                },
                db: {},
            };

            const handler = vi.fn();
            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Auth service error');
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('authenticatedMutation', () => {
        it('should call mutation with wrapped handler', () => {
            const handler = vi.fn();
            authenticatedMutation({
                args: {},
                handler,
            });

            expect(mockMutation).toHaveBeenCalledTimes(1);
            const callArgs = mockMutation.mock.calls[0][0];
            expect(callArgs).toHaveProperty('args');
            expect(callArgs).toHaveProperty('handler');
            expect(typeof callArgs.handler).toBe('function');
        });

        it('should pass through args correctly', () => {
            authenticatedMutation({
                args: {} as PropertyValidators,
                handler: vi.fn(),
            });

            const callArgs = mockMutation.mock.calls[0][0];
            expect(callArgs.args).toEqual({});
        });

        it('should throw error when identity is null', async () => {
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(null),
                },
                db: {},
            };

            const handler = vi.fn();
            authenticatedMutation({
                args: {},
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Not authenticated');
            expect(handler).not.toHaveBeenCalled();
        });

        it('should throw error when identity is undefined', async () => {
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(undefined as any),
                },
                db: {},
            };

            const handler = vi.fn();
            authenticatedMutation({
                args: {},
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Not authenticated');
            expect(handler).not.toHaveBeenCalled();
        });

        it('should inject identity into context when authenticated', async () => {
            const identity = { subject: 'user-456' };
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const handler = vi.fn().mockResolvedValue('mutation-success');
            authenticatedMutation({
                args: {},
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;
            const result = await wrappedHandler(mockCtx, {});

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...mockCtx,
                    identity,
                }),
                {}
            );
            expect(result).toBe('mutation-success');
        });

        it('should pass args correctly to handler', async () => {
            const identity = { subject: 'user-456' };
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const testArgs = { title: 'New Item', value: 100 };
            const handler = vi.fn().mockResolvedValue('created');
            authenticatedMutation({
                args: {} as PropertyValidators,
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;
            await wrappedHandler(mockCtx, testArgs);

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    identity,
                }),
                testArgs
            );
        });

        it('should handle async handler correctly', async () => {
            const identity = { subject: 'user-456' };
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const handler = vi.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'async-mutation-result';
            });

            authenticatedMutation({
                args: {},
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;
            const result = await wrappedHandler(mockCtx, {});

            expect(result).toBe('async-mutation-result');
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should propagate errors from handler', async () => {
            const identity = { subject: 'user-456' };
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const error = new Error('Mutation handler error');
            const handler = vi.fn().mockRejectedValue(error);

            authenticatedMutation({
                args: {},
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Mutation handler error');
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should handle getUserIdentity errors', async () => {
            const mockCtx: MockMutationCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockRejectedValue(new Error('Auth service error')),
                },
                db: {},
            };

            const handler = vi.fn();
            authenticatedMutation({
                args: {},
                handler,
            });

            const wrappedHandler = mockMutation.mock.calls[0][0].handler;

            await expect(wrappedHandler(mockCtx, {})).rejects.toThrow('Auth service error');
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('integration scenarios', () => {
        it('should work with multiple queries and mutations', () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            const handler3 = vi.fn();

            authenticatedQuery({ args: {}, handler: handler1 });
            authenticatedMutation({ args: {}, handler: handler2 });
            authenticatedQuery({ args: {}, handler: handler3 });

            expect(mockQuery).toHaveBeenCalledTimes(2);
            expect(mockMutation).toHaveBeenCalledTimes(1);
        });

        it('should preserve context properties when injecting identity', async () => {
            const identity = { subject: 'user-789' };
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: { someProperty: 'preserved' },
            };

            const handler = vi.fn().mockResolvedValue('result');
            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;
            await wrappedHandler(mockCtx, {});

            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({
                    db: { someProperty: 'preserved' },
                    auth: mockCtx.auth,
                    identity,
                }),
                {}
            );
        });

        it('should handle complex identity subject values', async () => {
            const identity = { subject: 'clerk|user|complex-id-123' };
            const mockCtx: MockQueryCtx = {
                auth: {
                    getUserIdentity: vi.fn().mockResolvedValue(identity),
                },
                db: {},
            };

            const handler = vi.fn().mockImplementation(async (ctx) => {
                return ctx.identity.subject;
            });

            authenticatedQuery({
                args: {},
                handler,
            });

            const wrappedHandler = mockQuery.mock.calls[0][0].handler;
            const result = await wrappedHandler(mockCtx, {});

            expect(result).toBe('clerk|user|complex-id-123');
        });
    });
});

