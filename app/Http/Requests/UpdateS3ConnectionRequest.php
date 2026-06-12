<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

class UpdateS3ConnectionRequest extends StoreS3ConnectionRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'secret_access_key' => ['nullable', 'string', 'max:4096'],
        ];
    }
}
