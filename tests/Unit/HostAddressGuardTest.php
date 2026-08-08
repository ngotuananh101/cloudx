<?php

use App\Services\CloudStorage\HostAddressGuard;
use Tests\TestCase;

uses(TestCase::class);

it('rejects loopback private link-local and cgnat', function () {
    $guard = app(HostAddressGuard::class);

    expect($guard->hostIsAllowed('127.0.0.1'))->toBeFalse()
        ->and($guard->hostIsAllowed('10.0.0.5'))->toBeFalse()
        ->and($guard->hostIsAllowed('169.254.169.254'))->toBeFalse()
        ->and($guard->hostIsAllowed('100.64.1.1'))->toBeFalse()
        ->and($guard->hostIsAllowed('198.18.0.1'))->toBeFalse();
});

it('accepts public ipv4 addresses', function () {
    $guard = app(HostAddressGuard::class);

    expect($guard->hostIsAllowed('8.8.8.8'))->toBeTrue()
        ->and($guard->hostIsAllowed('1.1.1.1'))->toBeTrue();
});

it('allows private connection hosts when configured', function () {
    config()->set('cloud-storage.host_policy.allow_private_connection_hosts', false);
    config()->set('cloud-storage.host_policy.allowed_private_hosts', ['nas.local']);

    $guard = app(HostAddressGuard::class);

    expect($guard->hostIsAllowedForConnections('10.0.0.5'))->toBeFalse()
        ->and($guard->hostIsAllowedForConnections('nas.local'))->toBeTrue();

    config()->set('cloud-storage.host_policy.allow_private_connection_hosts', true);

    expect($guard->hostIsAllowedForConnections('10.0.0.5'))->toBeTrue();
});

it('resolves allowed ip for public hosts and returns null for private', function () {
    $guard = app(HostAddressGuard::class);

    expect($guard->resolveAllowedIp('8.8.8.8'))->toBe('8.8.8.8')
        ->and($guard->resolveAllowedIp('1.1.1.1'))->toBe('1.1.1.1')
        ->and($guard->resolveAllowedIp('127.0.0.1'))->toBeNull()
        ->and($guard->resolveAllowedIp('10.0.0.5'))->toBeNull()
        ->and($guard->resolveAllowedIp('169.254.169.254'))->toBeNull()
        ->and($guard->resolveAllowedIp('100.64.1.1'))->toBeNull()
        ->and($guard->resolveAllowedIp(''))->toBeNull();
});

it('keeps hostIsAllowed as wrapper of resolveAllowedIp', function () {
    $guard = app(HostAddressGuard::class);

    expect($guard->hostIsAllowed('8.8.8.8'))->toBeTrue()
        ->and($guard->hostIsAllowed('127.0.0.1'))->toBeFalse();
});
