<?php

namespace App\Services\CloudStorage\S3;

use App\Models\CloudConnection;
use DateInterval;
use DateTimeImmutable;

class S3Presigner
{
    public function __construct(private readonly S3ClientFactory $factory) {}

    public function initiateMultipartUpload(CloudConnection $connection, string $key, ?string $mimeType): string
    {
        $result = $this->factory->make($connection)->createMultipartUpload(array_filter([
            'Bucket' => $connection->credentials['bucket'] ?? '',
            'Key' => $key,
            'ContentType' => $mimeType,
        ], static fn (mixed $value): bool => $value !== null && $value !== ''));

        return (string) $result->get('UploadId');
    }

    public function presignUploadPart(CloudConnection $connection, string $key, string $uploadId, int $partNumber): string
    {
        $client = $this->factory->make($connection);
        $command = $client->getCommand('UploadPart', [
            'Bucket' => $connection->credentials['bucket'] ?? '',
            'Key' => $key,
            'UploadId' => $uploadId,
            'PartNumber' => $partNumber,
        ]);

        $request = $client->createPresignedRequest(
            $command,
            (new DateTimeImmutable)->add(new DateInterval('PT'.(int) config('cloud-storage.direct_upload.part_ttl_seconds', 900).'S')),
        );

        return (string) $request->getUri();
    }

    /**
     * @param  array<int, array{ETag: string, PartNumber: int}>  $parts
     */
    public function completeMultipartUpload(CloudConnection $connection, string $key, string $uploadId, array $parts): void
    {
        usort($parts, static fn (array $left, array $right): int => $left['PartNumber'] <=> $right['PartNumber']);

        $this->factory->make($connection)->completeMultipartUpload([
            'Bucket' => $connection->credentials['bucket'] ?? '',
            'Key' => $key,
            'UploadId' => $uploadId,
            'MultipartUpload' => [
                'Parts' => $parts,
            ],
        ]);
    }

    public function abortMultipartUpload(CloudConnection $connection, string $key, string $uploadId): void
    {
        $this->factory->make($connection)->abortMultipartUpload([
            'Bucket' => $connection->credentials['bucket'] ?? '',
            'Key' => $key,
            'UploadId' => $uploadId,
        ]);
    }
}
