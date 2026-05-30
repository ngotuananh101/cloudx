import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudFolderController::store
 * @see app/Http/Controllers/CloudFolderController.php:15
 * @route '/connections/{connection}/folders'
 */
export const store = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/connections/{connection}/folders',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CloudFolderController::store
 * @see app/Http/Controllers/CloudFolderController.php:15
 * @route '/connections/{connection}/folders'
 */
store.url = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
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

    return store.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudFolderController::store
 * @see app/Http/Controllers/CloudFolderController.php:15
 * @route '/connections/{connection}/folders'
 */
store.post = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})
const CloudFolderController = { store }

export default CloudFolderController