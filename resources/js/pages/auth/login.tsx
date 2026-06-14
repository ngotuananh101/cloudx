import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Cloud } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { store } from '@/actions/App/Http/Controllers/Auth/LoginController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GuestLayout from '@/layouts/GuestLayout';

export default function Login() {
    const { status, name: appName } = usePage().props as { status?: string, name?: string };

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(store.url());
    };

    return (
        <GuestLayout>
            <Head title="Login" />

            {/* Logo */}
            <div className="mb-6 flex items-center justify-center gap-2">
                <Cloud className="h-6 w-6 fill-primary text-primary" />
                <span className="text-xl font-bold tracking-tight text-primary">
                    {appName}
                </span>
            </div>

            {/* Headers */}
            <div className="mb-8 text-center">
                <h1 className="mb-2 text-2xl font-semibold text-foreground">
                    Welcome Back
                </h1>
                <p className="text-sm text-muted-foreground">
                    Enter your credentials to access your vault
                </p>
            </div>

            {status && (
                <div className="mb-4 rounded-md bg-primary/10 p-4 text-sm text-primary">
                    {status}
                </div>
            )}

            {/* Form */}
            <form className="space-y-6" onSubmit={submit}>
                <div className="space-y-2">
                    <Label
                        htmlFor="email"
                        className="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                    >
                        Email Address
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        className={`h-11 border-0 bg-muted px-4 placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring ${errors.email ? 'ring-1 ring-destructive' : ''}`}
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        autoComplete="username"
                    />
                    {errors.email && (
                        <p className="mt-1 text-xs text-destructive">
                            {errors.email}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label
                            htmlFor="password"
                            className="text-xs font-bold tracking-wider text-muted-foreground uppercase"
                        >
                            Password
                        </Label>
                        <Link
                            href="/forgot-password"
                            className="text-xs font-bold text-primary hover:underline"
                        >
                            Forgot Password?
                        </Link>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        placeholder="********"
                        className={`h-11 border-0 bg-muted px-4 text-lg tracking-widest placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring ${errors.password ? 'ring-1 ring-destructive' : ''}`}
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        autoComplete="current-password"
                    />
                    {errors.password && (
                        <p className="mt-1 text-xs text-destructive">
                            {errors.password}
                        </p>
                    )}
                </div>

                <Button
                    className="h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90"
                    disabled={processing}
                >
                    Sign In
                </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-4 font-bold tracking-wider text-muted-foreground">
                        Or continue with
                    </span>
                </div>
            </div>

            {/* Social Logins */}
            <div className="grid grid-cols-2 gap-4">
                <Button
                    variant="outline"
                    className="h-11 rounded-lg border-0 bg-muted font-medium text-foreground hover:bg-muted/70"
                >
                    {/* Google brand colors - intentionally hardcoded as third-party identity */}
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    Google
                </Button>
                <Button
                    variant="outline"
                    className="h-11 rounded-lg border-0 bg-muted font-medium text-foreground hover:bg-muted/70"
                >
                    {/* Microsoft brand colors - intentionally hardcoded as third-party identity */}
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21">
                        <path fill="#f25022" d="M1 1h9v9H1z" />
                        <path fill="#00a4ef" d="M1 11h9v9H1z" />
                        <path fill="#7fba00" d="M11 1h9v9h-9z" />
                        <path fill="#ffb900" d="M11 11h9v9h-9z" />
                    </svg>
                    Microsoft
                </Button>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link href="#" className="font-bold text-primary hover:underline">
                    Create account
                </Link>
            </div>
        </GuestLayout>
    );
}
