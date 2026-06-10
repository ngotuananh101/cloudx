import { Head, useForm } from '@inertiajs/react';
import { Lock, Loader2 } from 'lucide-react';
import ShareLayout from '@/layouts/ShareLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SharePasswordProps {
    uuid: string;
    share: {
        name: string;
    };
}

export default function SharePassword({ uuid, share }: SharePasswordProps) {
    const { data, setData, post, processing, errors } = useForm({
        password: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/s/${uuid}/verify`);
    };

    return (
        <ShareLayout>
            <Head title={`Unlock — ${share.name}`} />
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
                        <Lock className="h-7 w-7 text-amber-500" />
                    </div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        Password Protected
                    </h1>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <strong>{share.name}</strong> is protected with a password.
                        Enter the password to access it.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={data.password}
                            onChange={(e) => setData('password', e.target.value)}
                            placeholder="Enter password..."
                            autoFocus
                            className="h-11"
                        />
                        {errors.password && (
                            <p className="text-sm text-red-500">{errors.password}</p>
                        )}
                    </div>
                    <Button
                        type="submit"
                        disabled={processing || data.password.length === 0}
                        className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {processing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Lock className="mr-2 h-4 w-4" />
                        )}
                        Unlock
                    </Button>
                </form>
            </div>
        </ShareLayout>
    );
}
