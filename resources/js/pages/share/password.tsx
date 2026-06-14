import { Head, useForm } from '@inertiajs/react';
import { Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ShareLayout from '@/layouts/ShareLayout';

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
            <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-sm">
                <div className="text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Lock className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-lg font-bold text-foreground">
                        Password Protected
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
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
                            <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                    </div>
                    <Button
                        type="submit"
                        disabled={processing || data.password.length === 0}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
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
