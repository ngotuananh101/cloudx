import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults, validateParameters } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
export const index = (args: { connection: string | number | { id: string | number }, path?: string | number } | [connection: string | number | { id: string | number }, path: string | number ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/storage/{connection}/{path?}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
index.url = (args: { connection: string | number | { id: string | number }, path?: string | number } | [connection: string | number | { id: string | number }, path: string | number ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    connection: args[0],
                    path: args[1],
                }
    }

    args = applyUrlDefaults(args)

    validateParameters(args, [
            "path",
        ])

    const parsedArgs = {
                        connection: typeof args.connection === 'object'
                ? args.connection.id
                : args.connection,
                                path: args.path,
                }

    return index.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace('{path?}', parsedArgs.path?.toString() ?? '')
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
index.get = (args: { connection: string | number | { id: string | number }, path?: string | number } | [connection: string | number | { id: string | number }, path: string | number ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
index.head = (args: { connection: string | number | { id: string | number }, path?: string | number } | [connection: string | number | { id: string | number }, path: string | number ], options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(args, options),
    method: 'head',
})
const StorageBrowserController = { index }

export default StorageBrowserController