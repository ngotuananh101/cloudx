import ftp from './ftp'
import s3 from './s3'
import sftp from './sftp'
import telegram from './telegram'
import items from './items'
import folders from './folders'
import shares from './shares'
import uploadTasks from './upload-tasks'
const connections = {
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