<?php

use App\Services\CloudStorage\HostAddressGuard;
use App\Services\CloudStorage\RemoteUploadUrlGuard;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

it('resolves pinned ip for public url', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $hostGuard->shouldReceive('resolveAllowedIp')->with('example.com')->andReturn('1.2.3.4');
    $guard = new RemoteUploadUrlGuard($hostGuard);

    expect($guard->resolveIpForUrl('https://example.com/path'))->toBe('1.2.3.4');
});

it('throws for private url when no ip resolved', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $hostGuard->shouldReceive('resolveAllowedIp')->with('10.0.0.5')->andReturnNull();
    $guard = new RemoteUploadUrlGuard($hostGuard);

    $guard->resolveIpForUrl('http://10.0.0.5/secret');
})->throws(ValidationException::class);

it('substitutes host with pinned ip keeping path and query', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $guard = new RemoteUploadUrlGuard($hostGuard);

    $pinned = $guard->substituteHostWithIp('https://example.com/path?q=1', '1.2.3.4');

    expect($pinned)->toBe('https://1.2.3.4/path?q=1');
});

it('substitutes host with pinned ip preserving port', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $guard = new RemoteUploadUrlGuard($hostGuard);

    $pinned = $guard->substituteHostWithIp('https://example.com:8443/path?q=1#frag', '1.2.3.4');

    expect($pinned)->toBe('https://1.2.3.4:8443/path?q=1#frag');
});

it('substitutes host with pinned ipv6 address', function () {
    $hostGuard = Mockery::mock(HostAddressGuard::class);
    $guard = new RemoteUploadUrlGuard($hostGuard);

    $pinned = $guard->substituteHostWithIp('https://example.com/path', '2606:4700:4700::1111');

    expect($pinned)->toBe('https://2606:4700:4700::1111/path');
});
