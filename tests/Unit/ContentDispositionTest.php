<?php

use App\Support\ContentDisposition;

it('builds safe inline disposition headers', function () {
    expect(ContentDisposition::inline('report.pdf'))
        ->toBe('inline; filename="report.pdf"; filename*=UTF-8\'\'report.pdf');
});

it('strips header injection characters from filenames', function () {
    $header = ContentDisposition::attachment("evil.bin\r\nSet-Cookie: x=1");

    expect($header)->not->toContain("\r")
        ->and($header)->not->toContain("\n")
        ->and($header)->toStartWith('attachment; filename=');
});

it('falls back when filename is empty after sanitizing', function () {
    expect(ContentDisposition::inline(''))
        ->toBe('inline; filename="download"; filename*=UTF-8\'\'download');
});
