import ftp from './ftp'
import sftp from './sftp'
import folders from './folders'
import uploadTasks from './upload-tasks'
const connections = {
    ftp: Object.assign(ftp, ftp),
sftp: Object.assign(sftp, sftp),
folders: Object.assign(folders, folders),
uploadTasks: Object.assign(uploadTasks, uploadTasks),
}

export default connections