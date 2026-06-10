import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
export const redirect = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: redirect.url(args, options),
    method: 'get',
})

redirect.definition = {
    methods: ["get","head"],
    url: '/oauth/{provider}/redirect',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
redirect.url = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { provider: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    provider: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        provider: args.provider,
                }

    return redirect.definition.url
            .replace('{provider}', parsedArgs.provider.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
redirect.get = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: redirect.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
redirect.head = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: redirect.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
    const redirectForm = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: redirect.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
        redirectForm.get = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: redirect.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\CloudConnectionController::redirect
 * @see app/Http/Controllers/CloudConnectionController.php:21
 * @route '/oauth/{provider}/redirect'
 */
        redirectForm.head = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: redirect.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    redirect.form = redirectForm
/**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
export const callback = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: callback.url(args, options),
    method: 'get',
})

callback.definition = {
    methods: ["get","head"],
    url: '/oauth/{provider}/callback',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
callback.url = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { provider: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    provider: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        provider: args.provider,
                }

    return callback.definition.url
            .replace('{provider}', parsedArgs.provider.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
callback.get = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: callback.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
callback.head = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: callback.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
    const callbackForm = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: callback.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
        callbackForm.get = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: callback.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\CloudConnectionController::callback
 * @see app/Http/Controllers/CloudConnectionController.php:51
 * @route '/oauth/{provider}/callback'
 */
        callbackForm.head = (args: { provider: string | number } | [provider: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: callback.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    callback.form = callbackForm
/**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
export const reconnect = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
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
reconnect.url = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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
reconnect.get = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: reconnect.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
reconnect.head = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: reconnect.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
    const reconnectForm = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: reconnect.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
        reconnectForm.get = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: reconnect.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\CloudConnectionController::reconnect
 * @see app/Http/Controllers/CloudConnectionController.php:32
 * @route '/connections/{connection}/reconnect'
 */
        reconnectForm.head = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: reconnect.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    reconnect.form = reconnectForm
/**
* @see \App\Http\Controllers\CloudConnectionController::disconnect
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
export const disconnect = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: disconnect.url(args, options),
    method: 'delete',
})

disconnect.definition = {
    methods: ["delete"],
    url: '/connections/{connection}',
} satisfies RouteDefinition<["delete"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::disconnect
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
disconnect.url = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return disconnect.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionController::disconnect
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
disconnect.delete = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'delete'> => ({
    url: disconnect.url(args, options),
    method: 'delete',
})

    /**
* @see \App\Http\Controllers\CloudConnectionController::disconnect
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
    const disconnectForm = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: disconnect.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'DELETE',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CloudConnectionController::disconnect
 * @see app/Http/Controllers/CloudConnectionController.php:134
 * @route '/connections/{connection}'
 */
        disconnectForm.delete = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: disconnect.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'DELETE',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    disconnect.form = disconnectForm
/**
* @see \App\Http\Controllers\CloudConnectionController::updateName
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
export const updateName = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: updateName.url(args, options),
    method: 'patch',
})

updateName.definition = {
    methods: ["patch"],
    url: '/connections/{connection}/name',
} satisfies RouteDefinition<["patch"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::updateName
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
updateName.url = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions) => {
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

    return updateName.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionController::updateName
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
updateName.patch = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteDefinition<'patch'> => ({
    url: updateName.url(args, options),
    method: 'patch',
})

    /**
* @see \App\Http\Controllers\CloudConnectionController::updateName
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
    const updateNameForm = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: updateName.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PATCH',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\CloudConnectionController::updateName
 * @see app/Http/Controllers/CloudConnectionController.php:110
 * @route '/connections/{connection}/name'
 */
        updateNameForm.patch = (args: { connection: number | { id: number } } | [connection: number | { id: number } ] | number | { id: number }, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: updateName.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PATCH',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    updateName.form = updateNameForm
const CloudConnectionController = { redirect, callback, reconnect, disconnect, updateName }

export default CloudConnectionController