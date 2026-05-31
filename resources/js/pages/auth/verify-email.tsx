import { Head, Link, useForm } from '@inertiajs/react';
import { MailCheck, ArrowRight, LogOut } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { destroy } from '@/actions/App/Http/Controllers/Auth/LoginController';
import { resend } from '@/actions/App/Http/Controllers/Auth/VerifyEmailController';
import { Button } from '@/components/ui/button';
import GuestLayout from '@/layouts/GuestLayout';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(resend.url());
    };

    return (
        <GuestLayout>
            <Head title="Email Verification" />

            <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f5f7]">
                    <div className="flex items-center justify-center">
                        <MailCheck
                            className="h-8 w-8 text-brand"
                            strokeWidth={2.5}
                        />
                    </div>
                </div>

                <h1 className="mb-3 text-2xl font-semibold text-gray-900">
                    Verify your email
                </h1>
                <p className="mx-auto text-sm text-gray-500">
                    Thanks for signing up! Before getting started, could you
                    verify your email address by clicking on the link we just
                    emailed to you? If you didn't receive the email, we will
                    gladly send you another.
                </p>
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-600">
                    A new verification link has been sent to the email address
                    you provided during registration.
                </div>
            )}

            <form onSubmit={submit} className="space-y-6">
                <Button
                    className="h-11 w-full rounded-lg bg-brand font-medium text-white hover:bg-[#a0181e]"
                    disabled={processing}
                >
                    Resend Verification Email{' '}
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </form>

            <div className="mt-8 text-center">
                <Link
                    href={destroy.url()}
                    method="post"
                    as="button"
                    className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                </Link>
            </div>
        </GuestLayout>
    );
}
