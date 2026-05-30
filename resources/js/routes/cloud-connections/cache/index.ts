import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudConnectionCacheController::destroy
 * @see app/Http/Controllers/CloudConnectionCacheController.php:14
 * @route '/connections/{connection}/cache'
 */
export const destroy = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/connections/{connection}/cache',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CloudConnectionCacheController::destroy
 * @see app/Http/Controllers/CloudConnectionCacheController.php:14
 * @route '/connections/{connection}/cache'
 */
destroy.url = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { connection: args }
    }

            if (typeof args === 'object' && !Array.isArray(args) && 'id' in args) {
            args = { connection: args.id }
        }
    
    if (Array.isArray(args)) {
        args = {
                    connection: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        connection: typeof args.connection === 'object'
                ? args.connection.id
                : args.connection,
                }

    return destroy.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionCacheController::destroy
 * @see app/Http/Controllers/CloudConnectionCacheController.php:14
 * @route '/connections/{connection}/cache'
 */
destroy.delete = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})
const cache = {
    destroy: Object.assign(destroy, destroy),
}

export default cache