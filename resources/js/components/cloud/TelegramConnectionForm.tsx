import { useState, type FormEvent } from 'react';

interface TelegramConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

export default function TelegramConnectionForm({
    onCancel,
    onSuccess,
}: TelegramConnectionFormProps) {
    const [step, setStep] = useState<'phone' | 'code' | 'password' | 'done'>('phone');
    const [name, setName] = useState('My Telegram');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncedCount, setSyncedCount] = useState(0);

    const csrfToken = (): string =>
        (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';

    const sendCode = (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        fetch('/connections/telegram/request-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                Accept: 'application/json',
            },
            body: JSON.stringify({ name, phone }),
        })
            .then(async (res) => {
                const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
                if (!res.ok) {
                    throw new Error((data.message as string) ?? 'Failed to send code');
                }
            })
            .then(() => setStep('code'))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'An error occurred'))
            .finally(() => setLoading(false));
    };

    const verify = (event: FormEvent, isPasswordStep: boolean = false) => {
        event.preventDefault();
        setLoading(true);
        setError(null);

        const payload: Record<string, string | undefined> = { code };
        if (isPasswordStep || (step === 'password' && password)) {
            payload.password = password || undefined;
        }

        fetch('/connections/telegram', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        })
            .then(async (res) => {
                const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
                if (!res.ok) {
                    throw new Error((data.message as string) ?? 'Verification failed');
                }
                return data;
            })
            .then((data) => {
                if (data?.success === true) {
                    setSyncedCount((data.synced as number) ?? 0);
                    setStep('done');
                }
            })
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'An error occurred'))
            .finally(() => setLoading(false));
    };

    if (step === 'done') {
        return (
            <div className="space-y-6 text-center py-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">Telegram Connected!</h4>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        &quot;{name}&quot; is ready to use.
                        {syncedCount > 0 && (
                            <span className="mt-1 block">{syncedCount} files synced from Saved Messages.</span>
                        )}
                    </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onSuccess}
                        className="rounded-md bg-blue-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    const stepBar = (position: number, currentStep: number, highlight: boolean = false) => {
        let color = 'bg-gray-200 dark:bg-gray-700';
        if (highlight) {
            color = 'bg-amber-500';
        } else if (currentStep <= position) {
            color = 'bg-blue-600';
        }
        return <div className={`flex-1 h-1 rounded-full transition-colors ${color}`} />;
    };

    const stepProgress = () => {
        if (step === 'phone') return [1, 2, 3];
        if (step === 'code') return [2, 2, 3];
        if (step === 'password') return [2, 3, 3];
        return [3, 3, 3];
    };

    const [s1, s2, s3] = stepProgress();

    return (
        <div className="space-y-5">
            {/* Step indicator */}
            <div className="flex gap-2">
                {stepBar(1, s1)}
                {stepBar(2, s2, step === 'password')}
                {stepBar(3, s3)}
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Step 1: Phone */}
            {step === 'phone' && (
                <form onSubmit={sendCode} className="space-y-4">
                    <div>
                        <label htmlFor="tg-name" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Connection Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClassName}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="tg-phone" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={inputClassName}
                            placeholder="+84 912 345 678"
                        />
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Use international format with country code</p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={loading}
                            className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Sending code...' : 'Send Code →'}
                        </button>
                    </div>
                </form>
            )}

            {/* Step 2: Code */}
            {step === 'code' && (
                <form onSubmit={(e) => verify(e)} className="space-y-4">
                    <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
                        💬 Code sent to your Telegram app. Enter it below.
                    </div>
                    <div>
                        <label htmlFor="tg-phone-display" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Phone Number
                        </label>
                        <div
                            id="tg-phone-display"
                            className="h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center"
                        >
                            {phone}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="tg-code" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            Verification Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-code"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className={`${inputClassName} font-mono text-lg tracking-widest`}
                            placeholder="12345"
                            autoFocus
                            inputMode="numeric"
                        />
                    </div>
                    <div className="flex justify-between gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setStep('phone')}
                            disabled={loading}
                            className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                        >
                            ← Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading || code.length < 3}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </form>
            )}

            {/* Step 2b: Password (2FA) */}
            {step === 'password' && (
                <form onSubmit={(e) => verify(e, true)} className="space-y-4">
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                        🔒 Your Telegram account has two-factor authentication enabled. Enter your 2FA password.
                    </div>
                    <div>
                        <label htmlFor="tg-password" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                            2FA Password <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="tg-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClassName}
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-between gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setStep('code')}
                            disabled={loading}
                            className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                        >
                            ← Back
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

const inputClassName =
    'h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50';
