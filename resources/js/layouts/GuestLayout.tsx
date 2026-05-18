import { PropsWithChildren } from 'react';

export default function GuestLayout({ children }: PropsWithChildren) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                {children}
            </div>
        </div>
    );
}
