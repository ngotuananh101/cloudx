import { Head, useForm } from '@inertiajs/react';
import { KeyRound, Mail, ArrowRight } from 'lucide-react';
import type { FormEventHandler } from 'react';

import { store } from '@/actions/App/Http/Controllers/Auth/ResetPasswordController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GuestLayout from '@/layouts/GuestLayout';

export default function ResetPassword({
    token,
    email,
}: {
    token: string;
    email: string;
}) {
    const { data, setData, post, processing, errors } = useForm({
        token: token,
        email: email,
        password: '',
        password_confirmation: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(store.url());
    };

    return (
        <GuestLayout>
            <Head title="Reset Password" />

            <div className="mb-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <div className="flex items-center justify-center">
                        <KeyRound
                            className="h-8 w-8 text-primary"
                            strokeWidth={2.5}
                        />
                    </div>
                </div>

                <h1 className="mb-3 text-2xl font-semibold text-foreground">
                    Set new password
                </h1>
                <p className="mx-auto max-w-xs text-sm text-muted-foreground">
                    Your new password must be different from previously used
                    passwords.
                </p>
            </div>

            <form onSubmit={submit} className="space-y-6">
                <div className="space-y-2">
                    <Label
                        htmlFor="email"
                        className="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >
                        Email Address
                    </Label>
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <Input
                            id="email"
                            type="email"
                            className={`h-11 border-0 bg-muted pr-4 pl-11 text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring ${errors.email ? 'ring-1 ring-destructive' : ''}`}
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            readOnly
                        />
                    </div>
                    {errors.email && (
                        <p className="mt-1 text-xs text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="password"
                        className="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >
                        New Password
                    </Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type="password"
                            placeholder="********"
                            className={`h-11 border-0 bg-muted px-4 text-lg tracking-widest placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring ${errors.password ? 'ring-1 ring-destructive' : ''}`}
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            autoComplete="new-password"
                        />
                    </div>
                    {errors.password && (
                        <p className="mt-1 text-xs text-destructive">
                            {errors.password}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label
                        htmlFor="password_confirmation"
                        className="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >
                        Confirm Password
                    </Label>
                    <div className="relative">
                        <Input
                            id="password_confirmation"
                            type="password"
                            placeholder="********"
                            className={`h-11 border-0 bg-muted px-4 text-lg tracking-widest placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring ${errors.password_confirmation ? 'ring-1 ring-destructive' : ''}`}
                            value={data.password_confirmation}
                            onChange={(e) =>
                                setData('password_confirmation', e.target.value)
                            }
                            autoComplete="new-password"
                        />
                    </div>
                    {errors.password_confirmation && (
                        <p className="mt-1 text-xs text-destructive">
                            {errors.password_confirmation}
                        </p>
                    )}
                </div>

                <Button
                    className="mt-2 h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                    disabled={processing}
                >
                    Reset Password <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </form>
        </GuestLayout>
    );
}
