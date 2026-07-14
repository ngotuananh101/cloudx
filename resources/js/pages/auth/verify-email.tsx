import { Head, Link, useForm } from '@inertiajs/react';
import { MailCheck, ArrowRight, LogOut } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { destroy } from '@/actions/App/Http/Controllers/Auth/LoginController';
import { resend } from '@/actions/App/Http/Controllers/Auth/VerifyEmailController';
import { Button } from '@/components/ui/button';
import GuestLayout from '@/layouts/GuestLayout';

export default function VerifyEmail({ status }: Readonly<{ status?: string }>) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(resend.url());
    };

    return (
        <GuestLayout>
            <Head title="Email Verification" />

            <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <div className="flex items-center justify-center">
                        <MailCheck
                            className="h-8 w-8 text-primary"
                            strokeWidth={2.5}
                        />
                    </div>
                </div>

                <h1 className="mb-3 text-2xl font-semibold text-foreground">
                    Verify your email
                </h1>
                <p className="mx-auto text-sm text-muted-foreground">
                    Thanks for signing up! Before getting started, could you
                    verify your email address by clicking on the link we just
                    emailed to you? If you didn't receive the email, we will
                    gladly send you another.
                </p>
            </div>

            {status === 'verification-link-sent' && (
                <div className="mb-6 rounded-md bg-primary/10 p-4 text-sm text-primary">
                    A new verification link has been sent to the email address
                    you provided during registration.
                </div>
            )}

            <form onSubmit={submit} className="space-y-6">
                <Button
                    className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90"
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
                    className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                </Link>
            </div>
        </GuestLayout>
    );
}
