import Auth from './Auth'
import HomeController from './HomeController'
import StorageBrowserController from './StorageBrowserController'
import CloudConnectionController from './CloudConnectionController'
import FtpConnectionController from './FtpConnectionController'
import CloudConnectionCacheController from './CloudConnectionCacheController'
import CloudFolderController from './CloudFolderController'
import CloudUploadTaskController from './CloudUploadTaskController'
import CloudUploadTaskChunkController from './CloudUploadTaskChunkController'
const Controllers = {
    Auth: Object.assign(Auth, Auth),
HomeController: Object.assign(HomeController, HomeController),
StorageBrowserController: Object.assign(StorageBrowserController, StorageBrowserController),
CloudConnectionController: Object.assign(CloudConnectionController, CloudConnectionController),
FtpConnectionController: Object.assign(FtpConnectionController, FtpConnectionController),
CloudConnectionCacheController: Object.assign(CloudConnectionCacheController, CloudConnectionCacheController),
CloudFolderController: Object.assign(CloudFolderController, CloudFolderController),
CloudUploadTaskController: Object.assign(CloudUploadTaskController, CloudUploadTaskController),
CloudUploadTaskChunkController: Object.assign(CloudUploadTaskChunkController, CloudUploadTaskChunkController),
}

export default Controllers