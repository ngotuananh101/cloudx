import Auth from './Auth'
import VideoDownloaderController from './VideoDownloaderController'
import ShareViewController from './ShareViewController'
import HomeController from './HomeController'
import System from './System'
import StorageBrowserController from './StorageBrowserController'
import CloudConnectionController from './CloudConnectionController'
import FtpConnectionController from './FtpConnectionController'
import S3ConnectionController from './S3ConnectionController'
import SftpConnectionController from './SftpConnectionController'
import TelegramConnectionController from './TelegramConnectionController'
import CloudConnectionCacheController from './CloudConnectionCacheController'
import CloudItemController from './CloudItemController'
import CloudItemMoveController from './CloudItemMoveController'
import CloudFilePreviewController from './CloudFilePreviewController'
import CloudFileDownloadController from './CloudFileDownloadController'
import Api from './Api'
import CloudFolderController from './CloudFolderController'
import CloudUploadTaskController from './CloudUploadTaskController'
import CloudUploadTaskChunkController from './CloudUploadTaskChunkController'
import CloudUploadPresignController from './CloudUploadPresignController'
import CloudUploadDirectCompleteController from './CloudUploadDirectCompleteController'
import SavedCookieController from './SavedCookieController'
const Controllers = {
    Auth: Object.assign(Auth, Auth),
VideoDownloaderController: Object.assign(VideoDownloaderController, VideoDownloaderController),
ShareViewController: Object.assign(ShareViewController, ShareViewController),
HomeController: Object.assign(HomeController, HomeController),
System: Object.assign(System, System),
StorageBrowserController: Object.assign(StorageBrowserController, StorageBrowserController),
CloudConnectionController: Object.assign(CloudConnectionController, CloudConnectionController),
FtpConnectionController: Object.assign(FtpConnectionController, FtpConnectionController),
S3ConnectionController: Object.assign(S3ConnectionController, S3ConnectionController),
SftpConnectionController: Object.assign(SftpConnectionController, SftpConnectionController),
TelegramConnectionController: Object.assign(TelegramConnectionController, TelegramConnectionController),
CloudConnectionCacheController: Object.assign(CloudConnectionCacheController, CloudConnectionCacheController),
CloudItemController: Object.assign(CloudItemController, CloudItemController),
CloudItemMoveController: Object.assign(CloudItemMoveController, CloudItemMoveController),
CloudFilePreviewController: Object.assign(CloudFilePreviewController, CloudFilePreviewController),
CloudFileDownloadController: Object.assign(CloudFileDownloadController, CloudFileDownloadController),
Api: Object.assign(Api, Api),
CloudFolderController: Object.assign(CloudFolderController, CloudFolderController),
CloudUploadTaskController: Object.assign(CloudUploadTaskController, CloudUploadTaskController),
CloudUploadTaskChunkController: Object.assign(CloudUploadTaskChunkController, CloudUploadTaskChunkController),
CloudUploadPresignController: Object.assign(CloudUploadPresignController, CloudUploadPresignController),
CloudUploadDirectCompleteController: Object.assign(CloudUploadDirectCompleteController, CloudUploadDirectCompleteController),
SavedCookieController: Object.assign(SavedCookieController, SavedCookieController),
}

export default Controllers