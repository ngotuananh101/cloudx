import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudUploadTaskController::index
 * @see app/Http/Controllers/CloudUploadTaskController.php:20
 * @route '/connections/{connection}/upload-tasks'
 */
export const index = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/connections/{connection}/upload-tasks',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskController::index
 * @see app/Http/Controllers/CloudUploadTaskController.php:20
 * @route '/connections/{connection}/upload-tasks'
 */
index.url = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
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

    return index.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudUploadTaskController::index
 * @see app/Http/Controllers/CloudUploadTaskController.php:20
 * @route '/connections/{connection}/upload-tasks'
 */
index.get = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudUploadTaskController::index
 * @see app/Http/Controllers/CloudUploadTaskController.php:20
 * @route '/connections/{connection}/upload-tasks'
 */
index.head = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\CloudUploadTaskController::store
 * @see app/Http/Controllers/CloudUploadTaskController.php:35
 * @route '/connections/{connection}/upload-tasks'
 */
export const store = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/connections/{connection}/upload-tasks',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskController::store
 * @see app/Http/Controllers/CloudUploadTaskController.php:35
 * @route '/connections/{connection}/upload-tasks'
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
* @see \App\Http\Controllers\CloudUploadTaskController::store
 * @see app/Http/Controllers/CloudUploadTaskController.php:35
 * @route '/connections/{connection}/upload-tasks'
 */
store.post = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(args, options),
    method: 'post',
})

/**
* @see \App\Http\Controllers\CloudUploadTaskController::show
 * @see app/Http/Controllers/CloudUploadTaskController.php:81
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
export const show = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})

show.definition = {
    methods: ["get","head"],
    url: '/connections/{connection}/upload-tasks/{task}',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskController::show
 * @see app/Http/Controllers/CloudUploadTaskController.php:81
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
show.url = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
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

    return show.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace('{task}', parsedArgs.task.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudUploadTaskController::show
 * @see app/Http/Controllers/CloudUploadTaskController.php:81
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
show.get = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: show.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudUploadTaskController::show
 * @see app/Http/Controllers/CloudUploadTaskController.php:81
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
show.head = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: show.url(args, options),
    method: 'head',
})

/**
* @see \App\Http\Controllers\CloudUploadTaskController::pause
 * @see app/Http/Controllers/CloudUploadTaskController.php:88
 * @route '/connections/{connection}/upload-tasks/{task}/pause'
 */
export const pause = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: pause.url(args, options),
    method: 'patch',
})

pause.definition = {
    methods: ["patch"],
    url: '/connections/{connection}/upload-tasks/{task}/pause',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskController::pause
 * @see app/Http/Controllers/CloudUploadTaskController.php:88
 * @route '/connections/{connection}/upload-tasks/{task}/pause'
 */
pause.url = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
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

    return pause.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace('{task}', parsedArgs.task.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudUploadTaskController::pause
 * @see app/Http/Controllers/CloudUploadTaskController.php:88
 * @route '/connections/{connection}/upload-tasks/{task}/pause'
 */
pause.patch = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: pause.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\CloudUploadTaskController::resume
 * @see app/Http/Controllers/CloudUploadTaskController.php:100
 * @route '/connections/{connection}/upload-tasks/{task}/resume'
 */
export const resume = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: resume.url(args, options),
    method: 'patch',
})

resume.definition = {
    methods: ["patch"],
    url: '/connections/{connection}/upload-tasks/{task}/resume',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskController::resume
 * @see app/Http/Controllers/CloudUploadTaskController.php:100
 * @route '/connections/{connection}/upload-tasks/{task}/resume'
 */
resume.url = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
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

    return resume.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace('{task}', parsedArgs.task.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudUploadTaskController::resume
 * @see app/Http/Controllers/CloudUploadTaskController.php:100
 * @route '/connections/{connection}/upload-tasks/{task}/resume'
 */
resume.patch = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: resume.url(args, options),
    method: 'patch',
})

/**
* @see \App\Http\Controllers\CloudUploadTaskController::destroy
 * @see app/Http/Controllers/CloudUploadTaskController.php:112
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
export const destroy = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})

destroy.definition = {
    methods: ["delete"],
    url: '/connections/{connection}/upload-tasks/{task}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CloudUploadTaskController::destroy
 * @see app/Http/Controllers/CloudUploadTaskController.php:112
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
destroy.url = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions) => {
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

    return destroy.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace('{task}', parsedArgs.task.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudUploadTaskController::destroy
 * @see app/Http/Controllers/CloudUploadTaskController.php:112
 * @route '/connections/{connection}/upload-tasks/{task}'
 */
destroy.delete = (args: { connection: string | number | { id: string | number }, task: string | number | { id: string | number } } | [connection: string | number | { id: string | number }, task: string | number | { id: string | number } ], options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: destroy.url(args, options),
    method: 'delete',
})
const CloudUploadTaskController = { index, store, show, pause, resume, destroy }

export default CloudUploadTaskController