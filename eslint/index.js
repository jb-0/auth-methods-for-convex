/**
 * Custom ESLint plugin to enforce the use of authenticatedQuery and authenticatedMutation
 * instead of the plain query and mutation from Convex.
 */

module.exports = {
    meta: {
        name: 'eslint-plugin-convex-auth',
        version: '1.0.0',
    },
    rules: {
        'no-direct-query-mutation': {
            meta: {
                type: 'problem',
                docs: {
                    description:
                        'Disallow direct use of query() and mutation() in favor of authenticatedQuery() and authenticatedMutation()',
                    category: 'Best Practices',
                    recommended: true,
                },
                messages: {
                    useAuthenticatedQuery:
                        'Use authenticatedQuery() instead of query(). Import from "./auth" or "../auth".',
                    useAuthenticatedMutation:
                        'Use authenticatedMutation() instead of mutation(). Import from "./auth" or "../auth".',
                },
                fixable: null,
                schema: [],
            },
            create(context) {
                const filename = context.getFilename();

                // Allow query/mutation usage in auth.ts since that's where the authenticated versions are implemented
                const isAuthFile =
                    filename.endsWith('convex/auth.ts') ||
                    filename.endsWith('convex\\auth.ts');

                if (isAuthFile) {
                    return {}; // No rules to enforce in auth.ts
                }

                // Track which identifiers are imported from _generated/server
                // Map local name -> imported name (query or mutation)
                const importsFromGeneratedServer = new Map();

                return {
                    ImportDeclaration(node) {
                        // Check if importing from './_generated/server' or '../_generated/server' or similar
                        const importSource = node.source.value;
                        if (
                            importSource.includes('_generated/server') ||
                            importSource.includes('convex/_generated/server')
                        ) {
                            node.specifiers.forEach(specifier => {
                                if (specifier.type === 'ImportSpecifier') {
                                    // Get the local name (might be aliased)
                                    const localName = specifier.local.name;
                                    const importedName = specifier.imported.name;
                                    if (importedName === 'query' || importedName === 'mutation') {
                                        importsFromGeneratedServer.set(localName, importedName);
                                    }
                                }
                            });
                        }
                    },

                    CallExpression(node) {
                        // Check if this is a direct call to query() or mutation()
                        if (node.callee.type === 'Identifier') {
                            const calleeName = node.callee.name;

                            // Check if this identifier was imported from _generated/server
                            const importedName = importsFromGeneratedServer.get(calleeName);
                            if (importedName) {
                                // This is a call to query or mutation from _generated/server
                                if (importedName === 'query') {
                                    context.report({
                                        node: node.callee,
                                        messageId: 'useAuthenticatedQuery',
                                    });
                                } else if (importedName === 'mutation') {
                                    context.report({
                                        node: node.callee,
                                        messageId: 'useAuthenticatedMutation',
                                    });
                                }
                            }
                        }
                    },
                };
            },
        },
        'no-getuseridentity-in-authenticated': {
            meta: {
                type: 'problem',
                docs: {
                    description:
                        'Disallow ctx.auth.getUserIdentity() inside authenticatedQuery/authenticatedMutation handlers. Use ctx.identity instead.',
                    category: 'Best Practices',
                    recommended: true,
                },
                messages: {
                    useContextIdentity:
                        'Do not use ctx.auth.getUserIdentity() inside authenticatedQuery/authenticatedMutation handlers. Use ctx.identity instead, which is already provided.',
                },
                fixable: null,
                schema: [],
            },
            create(context) {
                const filename = context.getFilename();

                // Allow getUserIdentity usage in auth.ts since that's where it's implemented
                const isAuthFile =
                    filename.endsWith('convex/auth.ts') ||
                    filename.endsWith('convex\\auth.ts');

                if (isAuthFile) {
                    return {}; // No rules to enforce in auth.ts
                }

                // Track which identifiers are imported for authenticatedQuery/authenticatedMutation
                const authenticatedImports = new Set();

                // Map to track which function nodes are authenticated handlers
                // Key: function node, Value: true
                const authenticatedHandlerFunctions = new Map();

                return {
                    ImportDeclaration(node) {
                        // Check if importing authenticatedQuery or authenticatedMutation
                        const importSource = node.source.value;
                        if (
                            importSource === './auth' ||
                            importSource === '../auth' ||
                            importSource.includes('/auth') ||
                            importSource === './_generated/server' ||
                            importSource.includes('_generated/server')
                        ) {
                            node.specifiers.forEach(specifier => {
                                if (specifier.type === 'ImportSpecifier') {
                                    const importedName = specifier.imported.name;
                                    if (
                                        importedName === 'authenticatedQuery' ||
                                        importedName === 'authenticatedMutation'
                                    ) {
                                        const localName = specifier.local.name;
                                        authenticatedImports.add(localName);
                                    }
                                }
                            });
                        }
                    },

                    CallExpression(node) {
                        // Check if this is a call to authenticatedQuery or authenticatedMutation
                        if (node.callee.type === 'Identifier') {
                            const calleeName = node.callee.name;
                            if (authenticatedImports.has(calleeName)) {
                                // Find the handler property in the object argument
                                if (
                                    node.arguments.length > 0 &&
                                    node.arguments[0].type === 'ObjectExpression'
                                ) {
                                    const handlerProperty = node.arguments[0].properties.find(
                                        prop =>
                                            prop.type === 'Property' &&
                                            prop.key.type === 'Identifier' &&
                                            prop.key.name === 'handler'
                                    );
                                    if (handlerProperty && handlerProperty.value) {
                                        const handlerValue = handlerProperty.value;
                                        // Mark the handler function as authenticated
                                        if (
                                            handlerValue.type === 'ArrowFunctionExpression' ||
                                            handlerValue.type === 'FunctionExpression'
                                        ) {
                                            authenticatedHandlerFunctions.set(handlerValue, true);
                                        }
                                    }
                                }
                            }
                        }
                    },

                    MemberExpression(node) {
                        // Check if this is ctx.auth.getUserIdentity()
                        if (
                            node.property &&
                            node.property.type === 'Identifier' &&
                            node.property.name === 'getUserIdentity' &&
                            node.object &&
                            node.object.type === 'MemberExpression' &&
                            node.object.property &&
                            node.object.property.type === 'Identifier' &&
                            node.object.property.name === 'auth' &&
                            node.object.object &&
                            node.object.object.type === 'Identifier' &&
                            node.object.object.name === 'ctx'
                        ) {
                            // Check if this MemberExpression is part of a CallExpression
                            // (i.e., ctx.auth.getUserIdentity() is being called)
                            let parent = node.parent;
                            let isCallExpression = false;
                            while (parent) {
                                if (
                                    parent.type === 'CallExpression' &&
                                    parent.callee === node
                                ) {
                                    isCallExpression = true;
                                    break;
                                }
                                parent = parent.parent;
                            }

                            if (isCallExpression) {
                                // Check if we're inside an authenticated handler
                                let current = node;
                                while (current) {
                                    if (
                                        (current.type === 'ArrowFunctionExpression' ||
                                            current.type === 'FunctionExpression') &&
                                        authenticatedHandlerFunctions.has(current)
                                    ) {
                                        context.report({
                                            node: node,
                                            messageId: 'useContextIdentity',
                                        });
                                        break;
                                    }
                                    current = current.parent;
                                }
                            }
                        }
                    },
                };
            },
        },
    },
};

