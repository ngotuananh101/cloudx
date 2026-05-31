import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { RotateCcw, Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { store } from '@/actions/App/Http/Controllers/Auth/ForgotPasswordController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GuestLayout from '@/layouts/GuestLayout';

export default function ForgotPassword() {
    const { status } = usePage().props as { status?: string };
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(store.url(), {
            onStart: () => setData('email', data.email),
        });
    };

    return (
        <GuestLayout>
            <Head title="Forgot Password" />

            <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f5f7]">
                    <div className="relative flex items-center justify-center">
                        <RotateCcw
                            className="h-8 w-8 text-brand"
                            strokeWidth={2.5}
                        />
                        <div className="absolute inset-0 flex items-center justify-center pt-[2px]">
                            <Lock
                                className="h-3 w-3 fill-brand text-brand"
                                strokeWidth={3}
                            />
                        </div>
                    </div>
                </div>

                <h1 className="mb-3 text-2xl font-semibold text-gray-900">
                    Reset your password
                </h1>
                <p className="mx-auto max-w-xs text-sm text-gray-500">
                    Enter your email address and we'll send you a link to reset
                    your password.
                </p>
            </div>

            {status && (
                <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-600">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-6">
                <div className="space-y-2">
                    <Label
                        htmlFor="email"
                        className="text-xs font-bold tracking-wider text-gray-500 uppercase"
                    >
                        Email Address
                    </Label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            className={`h-11 border-0 bg-[#f4f5f7] pr-4 pl-11 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300 ${errors.email ? 'ring-1 ring-red-500' : ''}`}
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                        />
                    </div>
                    {errors.email && (
                        <p className="mt-1 text-xs text-red-500">
                            {errors.email}
                        </p>
                    )}
                </div>

                <Button
                    className="h-11 w-full rounded-lg bg-brand font-medium text-white hover:bg-[#a0181e]"
                    disabled={processing}
                >
                    Send Reset Link <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </form>

            <div className="mt-8 text-center">
                <Link
                    href="/login"
                    className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Login
                </Link>
            </div>
        </GuestLayout>
    );
}
