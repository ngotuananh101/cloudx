<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreSftpConnectionRequest extends FormRequest
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
            'host' => ['required', 'string', 'max:255'],
            'port' => ['required', 'integer', 'min:1', 'max:65535'],
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required_without:privateKey', 'nullable', 'string', 'max:4096'],
            'privateKey' => ['required_without:password', 'nullable', 'string', 'max:16384'],
            'passphrase' => ['nullable', 'string', 'max:4096'],
            'root' => ['nullable', 'string', 'max:2048'],
            'timeout' => ['nullable', 'integer', 'min:1', 'max:300'],
            'useAgent' => ['boolean'],
            'hostFingerprint' => ['nullable', 'string', 'max:1024'],
        ];
    }
}
