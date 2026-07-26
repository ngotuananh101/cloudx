<?php

use App\Services\CloudStorage\CloudPath;

it('normalizes dots and slashes', function () {
    expect(CloudPath::normalize('a/../b/./c//d'))->toBe('b/c/d')
        ->and(CloudPath::normalize('\\foo\\bar'))->toBe('foo/bar')
        ->and(CloudPath::normalize(''))->toBe('')
        ->and(CloudPath::normalize('..'))->toBe('')
        ->and(CloudPath::normalize('../../x'))->toBe('x');
});

it('keeps simple paths intact', function () {
    expect(CloudPath::normalize('documents/report.pdf'))->toBe('documents/report.pdf')
        ->and(CloudPath::normalize('/leading/slash'))->toBe('leading/slash');
});
