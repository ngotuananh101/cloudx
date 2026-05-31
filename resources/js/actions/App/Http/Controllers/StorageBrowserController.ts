import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults, validateParameters } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
export const index = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
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
index.url = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions) => {
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
index.get = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
index.head = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
    const indexForm = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
        indexForm.get = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\StorageBrowserController::index
 * @see app/Http/Controllers/StorageBrowserController.php:23
 * @route '/storage/{connection}/{path?}'
 */
        indexForm.head = (args: { connection: number | { id: number }, path?: string | number } | [connection: number | { id: number }, path: string | number ], options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    index.form = indexForm
const StorageBrowserController = { index }

export default StorageBrowserController