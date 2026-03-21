'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <img
          src="/images/logo.png"
          alt="Magic Brush Ltd"
          className="h-20 w-auto animate-pulse object-contain mx-auto mb-4"
        />
        <p className="text-slate-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
