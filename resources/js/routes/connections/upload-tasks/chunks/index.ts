import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudUploadTaskChunkController::store
 * @see app/Http/Controllers/CloudUploadTaskChunkController.php:22
 * @route '/connections/{connection}/upload-tasks/{task}/chunks'
 */
export const store = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
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
store.url = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
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
store.post = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\CloudUploadTaskChunkController::store
 * @see app/Http/Controllers/CloudUploadTaskChunkController.php:22
 * @route '/connections/{connection}/upload-tasks/{task}/chunks'
 */
    const storeForm = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(args, options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CloudUploadTaskChunkController::store
 * @see app/Http/Controllers/CloudUploadTaskChunkController.php:22
 * @route '/connections/{connection}/upload-tasks/{task}/chunks'
 */
        storeForm.post = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(args, options),
            method: 'post',
        })
    
    store.form = storeForm
const chunks = {
    store: Object.assign(store, store),
}

export default chunks