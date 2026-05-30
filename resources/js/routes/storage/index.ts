import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults, validateParameters } from './../../wayfinder'
import localA91488 from './local'
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

/**
 * @see vendor/laravel/framework/src/Illuminate/Filesystem/FilesystemServiceProvider.php:111
 * @route '/storage/{path}'
 */
export const local = (args: { path: string | number } | [path: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: local.url(args, options),
    method: 'get',
})

local.definition = {
    methods: ["get","head"],
    url: '/storage/{path}',
} satisfies RouteDefinition<["get","head"]>

/**
 * @see vendor/laravel/framework/src/Illuminate/Filesystem/FilesystemServiceProvider.php:111
 * @route '/storage/{path}'
 */
local.url = (args: { path: string | number } | [path: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { path: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    path: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        path: args.path,
                }

    return local.definition.url
            .replace('{path}', parsedArgs.path.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
 * @see vendor/laravel/framework/src/Illuminate/Filesystem/FilesystemServiceProvider.php:111
 * @route '/storage/{path}'
 */
local.get = (args: { path: string | number } | [path: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: local.url(args, options),
    method: 'get',
})
/**
 * @see vendor/laravel/framework/src/Illuminate/Filesystem/FilesystemServiceProvider.php:111
 * @route '/storage/{path}'
 */
local.head = (args: { path: string | number } | [path: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: local.url(args, options),
    method: 'head',
})
const storage = {
    index: Object.assign(index, index),
local: Object.assign(local, localA91488),
}

export default storage