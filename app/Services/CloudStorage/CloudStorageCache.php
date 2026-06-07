<?php

namespace App\Services\CloudStorage;

use App\Models\CloudConnection;
use Closure;
use Illuminate\Cache\TaggedCache;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class CloudStorageCache
{
    /**
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function rememberFolderListing(CloudConnection $connection, string $path, Closure $callback): mixed
    {
        return $this->repository($this->folderTags($connection, $path))->remember(
            $this->folderKey($connection, $path),
            $this->ttl(),
            $callback,
        );
    }

    /**
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function rememberDirectoryListing(CloudConnection $connection, string $path, Closure $callback): mixed
    {
        return $this->repository($this->folderTags($connection, $path))->remember(
            $this->folderKey($connection, $path) . ':dirs',
            $this->ttl(),
            $callback,
        );
    }

    /**
     * @template TReturn
     *
     * @param  Closure(): TReturn  $callback
     * @return TReturn
     */
    public function rememberQuota(CloudConnection $connection, Closure $callback): mixed
    {
        return $this->repository($this->quotaTags($connection))->remember(
            $this->quotaKey($connection),
            $this->ttl(),
            $callback,
        );
    }

    public function flushConnection(CloudConnection $connection): void
    {
        if ($this->taggedRepository([$this->connectionTag($connection)])?->flush() !== null) {
            return;
        }

        $this->bumpVersion($this->connectionVersionKey($connection));
    }

    public function flushFolder(CloudConnection $connection, string $path): void
    {
        if ($this->taggedRepository([$this->folderTag($connection, $path)])?->flush() !== null) {
            return;
        }

        $this->bumpVersion($this->folderVersionKey($connection, $path));
    }

    public function flushQuota(CloudConnection $connection): void
    {
        if ($this->taggedRepository([$this->quotaTag($connection)])?->flush() !== null) {
            return;
        }

        $this->baseRepository()->forget($this->quotaKey($connection));
    }

    /**
     * @param  array<int, string>  $tags
     */
    private function repository(array $tags): Repository|TaggedCache
    {
        return $this->taggedRepository($tags) ?? $this->baseRepository();
    }

    /**
     * @param  array<int, string>  $tags
     */
    private function taggedRepository(array $tags): ?TaggedCache
    {
        $repository = $this->baseRepository();

        if (method_exists($repository->getStore(), 'tags')) {
            return $repository->tags($tags);
        }

        return null;
    }

    private function baseRepository(): Repository
    {
        $store = config('cloud-storage.cache.store');

        return $store ? Cache::store((string) $store) : Cache::store();
    }

    private function folderKey(CloudConnection $connection, string $path): string
    {
        return "cloud:list:{$connection->provider->slug()}:{$connection->id}:{$this->connectionVersion($connection)}:{$this->folderVersion($connection, $path)}:".$this->pathHash($path);
    }

    private function quotaKey(CloudConnection $connection): string
    {
        return "cloud:quota:{$connection->provider->slug()}:{$connection->id}:{$this->connectionVersion($connection)}";
    }

    /**
     * @return array<int, string>
     */
    private function folderTags(CloudConnection $connection, string $path): array
    {
        return [
            'cloud',
            $this->providerTag($connection),
            $this->connectionTag($connection),
            $this->folderTag($connection, $path),
        ];
    }

    /**
     * @return array<int, string>
     */
    private function quotaTags(CloudConnection $connection): array
    {
        return [
            'cloud',
            $this->providerTag($connection),
            $this->connectionTag($connection),
            $this->quotaTag($connection),
        ];
    }

    private function providerTag(CloudConnection $connection): string
    {
        return 'cloud:provider:'.$connection->provider->slug();
    }

    private function connectionTag(CloudConnection $connection): string
    {
        return 'cloud:connection:'.$connection->id;
    }

    private function folderTag(CloudConnection $connection, string $path): string
    {
        return "cloud:connection:{$connection->id}:folder:".$this->pathHash($path);
    }

    private function quotaTag(CloudConnection $connection): string
    {
        return 'cloud:connection:'.$connection->id.':quota';
    }

    private function connectionVersion(CloudConnection $connection): string
    {
        return (string) $this->baseRepository()->get($this->connectionVersionKey($connection), '1');
    }

    private function folderVersion(CloudConnection $connection, string $path): string
    {
        return (string) $this->baseRepository()->get($this->folderVersionKey($connection, $path), '1');
    }

    private function connectionVersionKey(CloudConnection $connection): string
    {
        return 'cloud:connection:'.$connection->id.':version';
    }

    private function folderVersionKey(CloudConnection $connection, string $path): string
    {
        return "cloud:connection:{$connection->id}:folder:".$this->pathHash($path).':version';
    }

    private function bumpVersion(string $key): void
    {
        $this->baseRepository()->forever($key, (string) Str::uuid());
    }

    private function pathHash(string $path): string
    {
        return sha1(trim($path, '/'));
    }

    private function ttl(): int
    {
        return (int) config('cloud-storage.cache.ttl', 21600);
    }
}
