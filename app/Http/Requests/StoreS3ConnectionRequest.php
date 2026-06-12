<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreS3ConnectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'provider_preset' => ['required', 'string', Rule::in([
                'aws',
                'minio',
                'cloudflare-r2',
                'digitalocean-spaces',
                'wasabi',
                'backblaze-b2',
                'hetzner',
                'rustfs',
                'custom',
            ])],
            'access_key_id' => ['required', 'string', 'max:255'],
            'secret_access_key' => ['required', 'string', 'max:4096'],
            'region' => ['required', 'string', 'max:255'],
            'bucket' => ['required', 'string', 'max:255'],
            'endpoint' => ['required_if:provider_preset,custom', 'nullable', 'string', 'max:2048'],
            'use_path_style_endpoint' => ['boolean'],
            'root' => ['nullable', 'string', 'max:2048'],
            'session_token' => ['nullable', 'string', 'max:4096'],
            'cdn_url' => ['nullable', 'string', 'max:2048'],
        ];
    }
}
