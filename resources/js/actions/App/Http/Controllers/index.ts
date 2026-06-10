import Auth from './Auth'
import ShareViewController from './ShareViewController'
import HomeController from './HomeController'
import System from './System'
import StorageBrowserController from './StorageBrowserController'
import CloudFileDownloadController from './CloudFileDownloadController'
import CloudFilePreviewController from './CloudFilePreviewController'
import CloudConnectionController from './CloudConnectionController'
import FtpConnectionController from './FtpConnectionController'
import SftpConnectionController from './SftpConnectionController'
import TelegramConnectionController from './TelegramConnectionController'
import CloudConnectionCacheController from './CloudConnectionCacheController'
import CloudItemController from './CloudItemController'
import CloudFolderController from './CloudFolderController'
import Api from './Api'
import CloudItemMoveController from './CloudItemMoveController'
import CloudUploadTaskController from './CloudUploadTaskController'
import CloudUploadTaskChunkController from './CloudUploadTaskChunkController'
const Controllers = {
    Auth: Object.assign(Auth, Auth),
ShareViewController: Object.assign(ShareViewController, ShareViewController),
HomeController: Object.assign(HomeController, HomeController),
System: Object.assign(System, System),
StorageBrowserController: Object.assign(StorageBrowserController, StorageBrowserController),
CloudFileDownloadController: Object.assign(CloudFileDownloadController, CloudFileDownloadController),
CloudFilePreviewController: Object.assign(CloudFilePreviewController, CloudFilePreviewController),
CloudConnectionController: Object.assign(CloudConnectionController, CloudConnectionController),
FtpConnectionController: Object.assign(FtpConnectionController, FtpConnectionController),
SftpConnectionController: Object.assign(SftpConnectionController, SftpConnectionController),
TelegramConnectionController: Object.assign(TelegramConnectionController, TelegramConnectionController),
CloudConnectionCacheController: Object.assign(CloudConnectionCacheController, CloudConnectionCacheController),
CloudItemController: Object.assign(CloudItemController, CloudItemController),
CloudFolderController: Object.assign(CloudFolderController, CloudFolderController),
Api: Object.assign(Api, Api),
CloudItemMoveController: Object.assign(CloudItemMoveController, CloudItemMoveController),
CloudUploadTaskController: Object.assign(CloudUploadTaskController, CloudUploadTaskController),
CloudUploadTaskChunkController: Object.assign(CloudUploadTaskChunkController, CloudUploadTaskChunkController),
}

export default Controllers