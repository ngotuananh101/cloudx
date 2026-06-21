<?php

declare(strict_types=1);

namespace App\Services\Python;

use RuntimeException;

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
            throw new RuntimeException($message);
        }

        $data = $body['data'] ?? null;

        if (! is_array($data)) {
            throw new RuntimeException('Microservice did not return metadata.');
        }

        return $data;
    }

    /**
     * @return array{stream: resource, content_type: string, filename: string, content_length: int|null}
     */
    public function downloadStream(string $url, string $formatId, bool $audioOnly, ?string $cookies = null): array
    {
        $response = $this->post('/yt-dlp/download', array_filter([
            'url' => $url,
            'format_id' => $formatId,
            'audio_only' => $audioOnly,
            'cookies' => $cookies,
        ], fn ($v) => $v !== null), 3600);

        $contentType = $response->header('Content-Type') ?? 'application/octet-stream';
        $filename = $this->parseFilename($response->header('Content-Disposition'));
        $contentLength = $response->header('Content-Length') !== null
            ? (int) $response->header('Content-Length')
            : null;

        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw new RuntimeException('Could not create download stream.');
        }

        fwrite($stream, $response->body());
        rewind($stream);

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
