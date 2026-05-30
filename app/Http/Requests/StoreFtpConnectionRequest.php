<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFtpConnectionRequest extends FormRequest
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
            'password' => ['required', 'string', 'max:4096'],
            'root' => ['nullable', 'string', 'max:2048'],
            'ssl' => ['boolean'],
            'passive' => ['boolean'],
            'timeout' => ['nullable', 'integer', 'min:1', 'max:300'],
            'utf8' => ['boolean'],
            'ignorePassiveAddress' => ['nullable', 'boolean'],
            'systemType' => ['nullable', Rule::in(['unix', 'windows'])],
            'recurseManually' => ['boolean'],
            'timestampsOnUnixListingsEnabled' => ['boolean'],
        ];
    }
}
