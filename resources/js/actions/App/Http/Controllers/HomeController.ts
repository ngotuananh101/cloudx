import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition } from './../../../../wayfinder'
/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
const HomeController980bb49ee7ae63891f1d891d2fbcf1c9 = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url(options),
    method: 'get',
})

HomeController980bb49ee7ae63891f1d891d2fbcf1c9.definition = {
    methods: ["get","head"],
    url: '/',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url = (options?: RouteQueryOptions) => {
    return HomeController980bb49ee7ae63891f1d891d2fbcf1c9.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
HomeController980bb49ee7ae63891f1d891d2fbcf1c9.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
HomeController980bb49ee7ae63891f1d891d2fbcf1c9.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
    const HomeController980bb49ee7ae63891f1d891d2fbcf1c9Form = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
        HomeController980bb49ee7ae63891f1d891d2fbcf1c9Form.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/'
 */
        HomeController980bb49ee7ae63891f1d891d2fbcf1c9Form.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: HomeController980bb49ee7ae63891f1d891d2fbcf1c9.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    HomeController980bb49ee7ae63891f1d891d2fbcf1c9.form = HomeController980bb49ee7ae63891f1d891d2fbcf1c9Form
    /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
const HomeController42a740574ecbfbac32f8cc353fc32db9 = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: HomeController42a740574ecbfbac32f8cc353fc32db9.url(options),
    method: 'get',
})

HomeController42a740574ecbfbac32f8cc353fc32db9.definition = {
    methods: ["get","head"],
    url: '/dashboard',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
HomeController42a740574ecbfbac32f8cc353fc32db9.url = (options?: RouteQueryOptions) => {
    return HomeController42a740574ecbfbac32f8cc353fc32db9.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
HomeController42a740574ecbfbac32f8cc353fc32db9.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: HomeController42a740574ecbfbac32f8cc353fc32db9.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
HomeController42a740574ecbfbac32f8cc353fc32db9.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: HomeController42a740574ecbfbac32f8cc353fc32db9.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
    const HomeController42a740574ecbfbac32f8cc353fc32db9Form = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: HomeController42a740574ecbfbac32f8cc353fc32db9.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
        HomeController42a740574ecbfbac32f8cc353fc32db9Form.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: HomeController42a740574ecbfbac32f8cc353fc32db9.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\HomeController::__invoke
 * @see app/Http/Controllers/HomeController.php:17
 * @route '/dashboard'
 */
        HomeController42a740574ecbfbac32f8cc353fc32db9Form.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: HomeController42a740574ecbfbac32f8cc353fc32db9.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    HomeController42a740574ecbfbac32f8cc353fc32db9.form = HomeController42a740574ecbfbac32f8cc353fc32db9Form

/**
* Multiple routes resolve to \App\Http\Controllers\HomeController::HomeController, so this export is a
* dictionary keyed by URI rather than a callable. Call a specific route with `HomeController['<uri>'](...)`,
* or import the route by name from your generated `routes/` directory.
*/
const HomeController = {
    '/': HomeController980bb49ee7ae63891f1d891d2fbcf1c9,
    '/dashboard': HomeController42a740574ecbfbac32f8cc353fc32db9,
}

export default HomeController