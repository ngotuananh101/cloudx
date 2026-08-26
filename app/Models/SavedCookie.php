<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\SavedCookieFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavedCookie extends Model
{
    /** @use HasFactory<SavedCookieFactory> */
    use HasFactory;

    const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'label',
        'cookies',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cookies' => 'encrypted',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
