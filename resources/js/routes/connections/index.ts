import { queryParams, type RouteQueryOptions, type RouteDefinition, applyUrlDefaults } from './../../wayfinder'
import ftp from './ftp'
import s3 from './s3'
import sftp from './sftp'
import telegram from './telegram'
import items from './items'
import folders from './folders'
import shares from './shares'
import uploadTasks from './upload-tasks'
/**
* @see \App\Http\Controllers\CloudConnectionController::editConfig
 * @see app/Http/Controllers/CloudConnectionController.php:187
 * @route '/connections/{connection}/edit-config'
 */
export const editConfig = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: editConfig.url(args, options),
    method: 'get',
})

editConfig.definition = {
    methods: ["get","head"],
    url: '/connections/{connection}/edit-config',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\CloudConnectionController::editConfig
 * @see app/Http/Controllers/CloudConnectionController.php:187
 * @route '/connections/{connection}/edit-config'
 */
editConfig.url = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions) => {
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

    return editConfig.definition.url
            .replace('{connection}', parsedArgs.connection.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\CloudConnectionController::editConfig
 * @see app/Http/Controllers/CloudConnectionController.php:187
 * @route '/connections/{connection}/edit-config'
 */
editConfig.get = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: editConfig.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\CloudConnectionController::editConfig
 * @see app/Http/Controllers/CloudConnectionController.php:187
 * @route '/connections/{connection}/edit-config'
 */
editConfig.head = (args: { connection: string | number | { id: string | number } } | [connection: string | number | { id: string | number } ] | string | number | { id: string | number }, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: editConfig.url(args, options),
    method: 'head',
})
const connections = {
    editConfig: Object.assign(editConfig, editConfig),
ftp: Object.assign(ftp, ftp),
s3: Object.assign(s3, s3),
sftp: Object.assign(sftp, sftp),
telegram: Object.assign(telegram, telegram),
items: Object.assign(items, items),
folders: Object.assign(folders, folders),
shares: Object.assign(shares, shares),
uploadTasks: Object.assign(uploadTasks, uploadTasks),
}

export default connections