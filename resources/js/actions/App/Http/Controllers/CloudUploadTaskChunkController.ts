import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudUploadTaskChunkController::store
 * @see app/Http/Controllers/CloudUploadTaskChunkController.php:22
 * @route '/connections/{connection}/upload-tasks/{task}/chunks'
 */
export const store = (args: { connection: number | { id: number }, task: number | { id: number } } | [connection: number | { id: number }, task: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/connections/{connection}/upload-tasks/{task}/chunks',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskChunkController::store
 * @see app/Http/Controllers/CloudUploadTaskChunkController.php:22
 * @route '/connections/{connection}/upload-tasks/{task}/chunks'
 */
store.url = (args: { connection: number | { id: number }, task: number | { id: number } } | [connection: number | { id: number }, task: number | { id: number } ], options?: RouteQueryOptions) => {
    if (Array.isArray(args)) {
        args = {
                    connection: args[0],
                    task: args[1],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        connection: typeof args.connection === 'object'
                ? args.connection.id
                : args.connection,
                                task: typeof args.task === 'object'
                ? args.task.id
                : args.task,
                }

    return store.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace('{task}', parsedArgs.task.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudUploadTaskChunkController::store
 * @see app/Http/Controllers/CloudUploadTaskChunkController.php:22
 * @route '/connections/{connection}/upload-tasks/{task}/chunks'
 */
store.post = (args: { connection: number | { id: number }, task: number | { id: number } } | [connection: number | { id: number }, task: number | { id: number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})
const CloudUploadTaskChunkController = { store }

export default CloudUploadTaskChunkController