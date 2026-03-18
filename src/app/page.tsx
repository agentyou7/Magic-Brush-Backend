'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('access_token');
    
    if (token) {
      // User is logged in, redirect to dashboard
      router.push('/admin/dashboard');
    } else {
      // User is not logged in, redirect to login
      router.push('/login');
    }
  }, [router]);

  // Show loading screen while checking authentication
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <img
          src="/images/logo.png"
          alt="Magic Brush Ltd"
          className="mx-auto h-20 w-auto animate-pulse object-contain"
        />
        <p className="text-slate-600 mt-4">Loading...</p>
      </div>
    </div>
  );
}
