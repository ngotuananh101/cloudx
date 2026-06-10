<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShareViewController extends Controller
{
    public function index(Request $request, string $uuid): Response
    {
        return Inertia::render('share/view', []);
    }
}
