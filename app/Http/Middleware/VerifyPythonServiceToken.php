<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyPythonServiceToken
{
    /**
     * Handle an incoming request from the Python microservice.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('X-Token') ?? $request->bearerToken();
        $expectedToken = config('services.python-service.token');

        if (empty($expectedToken) || ! is_string($token) || ! hash_equals((string) $expectedToken, $token)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return $next($request);
    }
}
