import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\FtpConnectionController::store
 * @see app/Http/Controllers/FtpConnectionController.php:19
 * @route '/connections/ftp'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/connections/ftp',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\FtpConnectionController::store
 * @see app/Http/Controllers/FtpConnectionController.php:19
 * @route '/connections/ftp'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\FtpConnectionController::store
 * @see app/Http/Controllers/FtpConnectionController.php:19
 * @route '/connections/ftp'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\FtpConnectionController::update
 * @see app/Http/Controllers/FtpConnectionController.php:41
 * @route '/connections/{connection}/ftp'
 */
export const update = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/connections/{connection}/ftp',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\FtpConnectionController::update
 * @see app/Http/Controllers/FtpConnectionController.php:41
 * @route '/connections/{connection}/ftp'
 */
update.url = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return update.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\FtpConnectionController::update
 * @see app/Http/Controllers/FtpConnectionController.php:41
 * @route '/connections/{connection}/ftp'
 */
update.patch = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})
const ftp = {
    store: Object.assign(store, store),
update: Object.assign(update, update),
}

export default ftp