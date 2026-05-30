import ftp from './ftp'
import folders from './folders'
import uploadTasks from './upload-tasks'
const connections = {
    ftp: Object.assign(ftp, ftp),
folders: Object.assign(folders, folders),
uploadTasks: Object.assign(uploadTasks, uploadTasks),
}

export default connections