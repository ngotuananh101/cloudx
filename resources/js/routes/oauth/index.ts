import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../wayfinder'
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
const oauth = {
    redirect: Object.assign(redirect, redirect),
callback: Object.assign(callback, callback),
}

export default oauth