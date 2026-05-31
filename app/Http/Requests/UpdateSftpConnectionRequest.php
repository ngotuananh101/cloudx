<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

class UpdateSftpConnectionRequest extends StoreSftpConnectionRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'password' => ['nullable', 'string', 'max:4096'],
            'privateKey' => ['nullable', 'string', 'max:16384'],
        ];
    }
}
