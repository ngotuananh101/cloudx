import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../wayfinder'
import name from './name'
import cache from './cache'
/**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
export const reconnect = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: reconnect.url(args, options),
    method: 'get',
})

reconnect.definition = {
    methods: ["get","head"],
    url: '/connections/{connection}/reconnect',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
reconnect.url = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
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

    return reconnect.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
reconnect.get = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: reconnect.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
reconnect.head = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: reconnect.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\CloudConnectionController::destroy
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
export const destroy = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/connections/{connection}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::destroy
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
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
* @see \App\Http\Controllers\CloudConnectionController::destroy
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
destroy.delete = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})
const cloudConnections = {
    reconnect: Object.assign(reconnect, reconnect),
destroy: Object.assign(destroy, destroy),
name: Object.assign(name, name),
cache: Object.assign(cache, cache),
}

export default cloudConnections