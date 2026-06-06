import ftp from './ftp'
import sftp from './sftp'
import telegram from './telegram'
import items from './items'
import folders from './folders'
import uploadTasks from './upload-tasks'
const connections = {
    ftp: Object.assign(ftp, ftp),
sftp: Object.assign(sftp, sftp),
telegram: Object.assign(telegram, telegram),
items: Object.assign(items, items),
folders: Object.assign(folders, folders),
uploadTasks: Object.assign(uploadTasks, uploadTasks),
}

export default connections