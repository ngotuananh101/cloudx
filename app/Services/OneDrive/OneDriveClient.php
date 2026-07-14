<?php

namespace App\Services\OneDrive;

use App\Exceptions\OneDriveException;
use App\Models\CloudConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;

class OneDriveClient
{
    public const GRAPH_URL = 'https://graph.microsoft.com/v1.0';

    public const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    private const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024;

    public function __construct(private CloudConnection $connection) {}

    /**
     * @return array<string, mixed>
     */
    public function credentials(): array
    {
        $credentials = $this->connection->credentials ?? [];
        $expiresAt = (int) ($credentials['expires_at'] ?? 0);

        if ($expiresAt > now()->addMinutes(5)->timestamp) {
            return $credentials;
        }

        $refreshToken = $credentials['refresh_token'] ?? null;

        if (! is_string($refreshToken) || $refreshToken === '') {
            throw new OneDriveException('OneDrive refresh token is missing.');
        }

        $token = $this->http()->asForm()
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.microsoft.client_id'),
                'client_secret' => config('services.microsoft.client_secret'),
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            return $credentials;
        }

        $credentials = array_merge($credentials, $token, [
            'refresh_token' => $token['refresh_token'] ?? $credentials['refresh_token'] ?? null,
            'expires_at' => now()->addSeconds((int) ($token['expires_in'] ?? 3600))->timestamp,
        ]);

        $this->connection->forceFill(['credentials' => $credentials])->save();

        return $credentials;
    }

    public function childrenUrl(string $path): string
    {
        $path = trim($path, '/');

        if ($path === '') {
            return self::GRAPH_URL.'/me/drive/root/children';
        }

        return self::GRAPH_URL.'/me/drive/root:/'.$this->encodePath($path).':/children';
    }

    public function itemUrl(string $path): string
    {
        $path = trim($path, '/');

        if ($path === '') {
            return self::GRAPH_URL.'/me/drive/root';
        }

        return self::GRAPH_URL.'/me/drive/root:/'.$this->encodePath($path);
    }

    public function contentUrl(string $path): string
    {
        return $this->itemUrl($path).':/content';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listChildren(string $path): array
    {
        $response = $this->graph()->get($this->childrenUrl($path))->throw()->json();

        return is_array($response) && isset($response['value']) && is_array($response['value']) ? $response['value'] : [];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function item(string $path): ?array
    {
        $response = $this->graph()->get($this->itemUrl($path));

        if ($response->status() === 404) {
            return null;
        }

        $item = $response->throw()->json();

        return is_array($item) ? $item : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function drive(): ?array
    {
        $drive = $this->graph()->get(self::GRAPH_URL.'/me/drive')->throw()->json();

        return is_array($drive) ? $drive : null;
    }

    public function download(string $path): string
    {
        return $this->graph()->get($this->contentUrl($path))->throw()->body();
    }

    /**
     * @return resource
     */
    public function downloadStream(string $path)
    {
        $response = $this->graph()->get($this->contentUrl($path))->throw();
        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw new OneDriveException('Could not create OneDrive download stream.');
        }

        fwrite($stream, $response->body());
        rewind($stream);

        return $stream;
    }

    public function upload(string $path, string $contents): void
    {
        $this->graph()->withBody($contents)->put($this->contentUrl($path))->throw();
    }

    /**
     * @param  resource  $contents
     */
    public function uploadStream(string $path, $contents): void
    {
        $size = $this->streamSize($contents);

        if ($size === 0) {
            $this->upload($path, '');

            return;
        }

        $session = $this->graph()
            ->post($this->itemUrl($path).':/createUploadSession', [
                'item' => ['@microsoft.graph.conflictBehavior' => 'replace'],
            ])
            ->throw()
            ->json();

        $uploadUrl = is_array($session) ? ($session['uploadUrl'] ?? null) : null;

        if (! is_string($uploadUrl) || $uploadUrl === '') {
            throw new OneDriveException('OneDrive upload session was not created.');
        }

        $offset = 0;

        while (! feof($contents)) {
            $chunk = fread($contents, self::UPLOAD_CHUNK_SIZE);

            if ($chunk === false) {
                throw new OneDriveException('Could not read OneDrive upload stream.');
            }

            if ($chunk === '') {
                continue;
            }

            $chunkLength = strlen($chunk);
            $end = $offset + $chunkLength - 1;
            $response = $this->http()->withHeaders([
                'Content-Length' => (string) $chunkLength,
                'Content-Range' => "bytes {$offset}-{$end}/{$size}",
            ])->withBody($chunk)->put($uploadUrl)->throw();

            if (in_array($response->status(), [200, 201], true)) {
                return;
            }

            if ($response->status() !== 202) {
                throw new OneDriveException('OneDrive upload session returned an unexpected response.');
            }

            $nextExpectedRanges = $response->json('nextExpectedRanges');
            $offset = $this->nextUploadOffset(is_array($nextExpectedRanges) ? $nextExpectedRanges : null, $end + 1);
        }

        throw new OneDriveException('OneDrive upload session did not complete.');
    }

    public function delete(string $path): void
    {
        $this->graph()->delete($this->itemUrl($path))->throw();
    }

    public function createFolder(string $path): void
    {
        [$parent, $name] = $this->splitPath($path);

        $this->graph()->post($this->childrenUrl($parent), [
            'name' => $name,
            'folder' => [],
            '@microsoft.graph.conflictBehavior' => 'fail',
        ])->throw();
    }

    public function move(string $source, string $destination): void
    {
        [$parent, $name] = $this->splitPath($destination);
        $parentItem = $this->item($parent);

        $this->assertDestinationParent($parentItem, 'move');

        $this->graph()->patch($this->itemUrl($source), [
            'name' => $name,
            'parentReference' => ['id' => $parentItem['id']],
        ])->throw();
    }

    public function copy(string $source, string $destination): void
    {
        [$parent, $name] = $this->splitPath($destination);
        $parentItem = $this->item($parent);

        $this->assertDestinationParent($parentItem, 'copy');

        $response = $this->graph()->post($this->itemUrl($source).':/copy', [
            'name' => $name,
            'parentReference' => ['id' => $parentItem['id']],
        ])->throw();

        $monitorUrl = $response->header('Location');

        if (! is_string($monitorUrl) || $monitorUrl === '') {
            return;
        }

        for ($attempt = 0, $delay = 10000; $attempt < 5; $attempt++, $delay = min($delay * 2, 50000)) {
            $monitor = $this->http()->get($monitorUrl)->throw()->json();
            $status = is_array($monitor) ? ($monitor['status'] ?? null) : null;

            if ($status === 'completed') {
                return;
            }

            if ($status === 'failed') {
                throw new OneDriveException('OneDrive copy failed.');
            }

            if (! in_array($status, ['notStarted', 'inProgress'], true)) {
                throw new OneDriveException('OneDrive copy returned an unexpected monitor status.');
            }

            if ($attempt < 4) {
                usleep($delay);
            }
        }

        throw new OneDriveException('OneDrive copy did not complete in time.');
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function splitPath(string $path): array
    {
        $trimmedPath = trim($path);

        if ($trimmedPath === '' || trim($trimmedPath, '/') === '' || str_ends_with($trimmedPath, '/')) {
            throw new InvalidArgumentException('OneDrive destination path must include a file or folder name.');
        }

        $path = trim($path, '/');
        $name = basename($path);
        $parent = dirname($path);

        return [$parent === '.' ? '' : trim($parent, '/'), $name];
    }

    /**
     * @param  array<string, mixed>|null  $parentItem
     */
    private function assertDestinationParent(?array $parentItem, string $operation): void
    {
        if (! is_array($parentItem)) {
            throw new OneDriveException("OneDrive {$operation} destination parent does not exist.");
        }

        if (! isset($parentItem['id']) || ! is_string($parentItem['id']) || $parentItem['id'] === '') {
            throw new OneDriveException("OneDrive {$operation} destination parent is missing an id.");
        }

        if (! array_key_exists('folder', $parentItem) || ! is_array($parentItem['folder'])) {
            throw new OneDriveException("OneDrive {$operation} destination parent is not a folder.");
        }
    }

    /**
     * @param  resource  $contents
     */
    private function streamSize($contents): int
    {
        $stats = fstat($contents);

        if (! is_array($stats) || ! isset($stats['size'])) {
            throw new OneDriveException('Could not determine OneDrive upload stream size.');
        }

        return (int) $stats['size'];
    }

    /**
     * @param  array<int, mixed>|null  $nextExpectedRanges
     */
    private function nextUploadOffset(?array $nextExpectedRanges, int $fallback): int
    {
        $range = $nextExpectedRanges[0] ?? null;

        if (is_string($range) && preg_match('/^(\d+)-/', $range, $matches) === 1) {
            return (int) $matches[1];
        }

        return $fallback;
    }

    protected function graph(): PendingRequest
    {
        $credentials = $this->credentials();

        return $this->http()->withToken((string) ($credentials['access_token'] ?? ''))
            ->retry([100, 250], throw: false);
    }

    private function http(): PendingRequest
    {
        $request = Http::connectTimeout(5)->timeout(10);

        return app()->isLocal() ? $request->withoutVerifying() : $request;
    }

    private function encodePath(string $path): string
    {
        return collect(explode('/', trim($path, '/')))
            ->map(fn (string $segment): string => rawurlencode($segment))
            ->implode('/');
    }
}
