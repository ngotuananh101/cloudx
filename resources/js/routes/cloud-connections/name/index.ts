import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudConnectionController::update
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
export const update = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})

update.definition = {
    methods: ["patch"],
    url: '/connections/{connection}/name',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::update
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
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
* @see \App\Http\Controllers\CloudConnectionController::update
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
update.patch = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: update.url(args, options),
    method: 'patch',
})
const name = {
    update: Object.assign(update, update),
}

export default name