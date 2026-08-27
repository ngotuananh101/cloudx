<?php

declare(strict_types=1);

namespace App\Services\Python;

use App\Exceptions\DownloadFileNotReadyException;
use App\Exceptions\DownloadJobNotFoundException;
use App\Exceptions\PythonServiceException;

class YtDlpClient extends PythonServiceClient
{
    /**
     * @return array<string, mixed>
     */
    public function fetchMetadata(string $url, ?string $cookies = null): array
    {
        $response = $this->post('/yt-dlp/metadata', array_filter([
            'url' => $url,
            'cookies' => $cookies,
        ], fn ($v) => $v !== null));

        $body = $response->json();

        if (! is_array($body) || ! ($body['success'] ?? false)) {
            $message = is_array($body) ? (string) ($body['message'] ?? 'Unknown error.') : 'Unknown error.';
            throw new PythonServiceException($message);
        }

        $data = $body['data'] ?? null;

        if (! is_array($data)) {
            throw new PythonServiceException('Microservice did not return metadata.');
        }

        return $data;
    }

    /**
     * Start a background video download job in the Python microservice.
     *
     * @return array{job_id: string, status: string}
     */
    public function startDownloadJob(
        string $url,
        string $formatId,
        bool $audioOnly,
        ?string $cookies = null,
        ?string $callbackUrl = null,
        ?string $callbackToken = null,
    ): array {
        $response = $this->post('/yt-dlp/jobs', array_filter([
            'url' => $url,
            'format_id' => $formatId,
            'audio_only' => $audioOnly,
            'cookies' => $cookies,
            'callback_url' => $callbackUrl,
            'callback_token' => $callbackToken,
        ], fn ($v) => $v !== null));

        $body = $response->json();

        if (! is_array($body) || ! isset($body['job_id'])) {
            throw new PythonServiceException('Microservice did not return a job id.');
        }

        return [
            'job_id' => (string) $body['job_id'],
            'status' => (string) ($body['status'] ?? 'pending'),
        ];
    }

    /**
     * Get live progress status of a download job.
     *
     * @return array{job_id: string, status: string, progress: float, speed_str: string, eta_str: string, filename: string, error: string}
     */
    public function getDownloadJobStatus(string $jobId): array
    {
        $response = $this->get('/yt-dlp/jobs/'.$jobId, timeout: 10, passthroughStatuses: [404]);

        if ($response->status() === 404) {
            throw new DownloadJobNotFoundException($jobId);
        }

        $this->assertSuccess($response);

        /** @var array{job_id: string, status: string, progress: float, speed_str: string, eta_str: string, filename: string, error: string} */
        return $response->json();
    }

    /**
     * Stream the completed download file from the microservice.
     *
     * @return array{stream: resource, content_type: string, filename: string, content_length: int|null}
     */
    public function getDownloadJobFileStream(string $jobId): array
    {
        $response = $this->getStream('/yt-dlp/jobs/'.$jobId.'/file', timeout: 30, passthroughStatuses: [404, 409]);

        if ($response->status() === 404) {
            throw new DownloadJobNotFoundException($jobId);
        }

        if ($response->status() === 409) {
            throw new DownloadFileNotReadyException;
        }

        $this->assertSuccess($response);

        $contentType = $response->header('Content-Type') ?? 'application/octet-stream';
        $filename = $this->parseFilename($response->header('Content-Disposition'));
        $contentLength = $response->header('Content-Length') !== null
            ? (int) $response->header('Content-Length')
            : null;

        $stream = $response->toPsrResponse()->getBody()->detach();

        return [
            'stream' => $stream,
            'content_type' => $contentType,
            'filename' => $filename,
            'content_length' => $contentLength,
        ];
    }

    /**
     * @return array{stream: resource, content_type: string, filename: string, content_length: int|null}
     */
    public function downloadStream(string $url, string $formatId, bool $audioOnly, ?string $cookies = null, ?string $poToken = null): array
    {
        $response = $this->postStream('/yt-dlp/download', array_filter([
            'url' => $url,
            'format_id' => $formatId,
            'audio_only' => $audioOnly,
            'cookies' => $cookies,
            'po_token' => $poToken,
        ], fn ($v) => $v !== null), 3600);

        $contentType = $response->header('Content-Type') ?? 'application/octet-stream';
        $filename = $this->parseFilename($response->header('Content-Disposition'));
        $contentLength = $response->header('Content-Length') !== null
            ? (int) $response->header('Content-Length')
            : null;

        $stream = $response->toPsrResponse()->getBody()->detach();

        return [
            'stream' => $stream,
            'content_type' => $contentType,
            'filename' => $filename,
            'content_length' => $contentLength,
        ];
    }

    private function parseFilename(?string $header): string
    {
        if ($header === null) {
            return 'ytdlp_dl.mp4';
        }

        if (preg_match('/filename\*?=(?:"([^"]+)"|([^;]+))/i', $header, $matches) === 1) {
            $value = $matches[1] !== '' ? $matches[1] : $matches[2];

            return trim($value);
        }

        return 'ytdlp_dl.mp4';
    }
}
