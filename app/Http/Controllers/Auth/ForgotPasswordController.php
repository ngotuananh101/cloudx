<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;

class ForgotPasswordController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create()
    {
        return Inertia::render('auth/forgot-password');
    }

    /**
     * Handle an incoming password reset link request.
     */
    public function store(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        Password::broker()->sendResetLink(
            $request->only('email')
        );

        return back()->with('status', __('If an account with that email exists, we have sent a password reset link.'));
    }
}
