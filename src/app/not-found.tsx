'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotFound() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGoHome = () => {
    router.push('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Animated 404 Number */}
        <div className="mb-8 relative">
          <div className={`transform transition-all duration-1000 ${mounted ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
            <h1 className="text-8xl sm:text-9xl font-black text-orange-500 leading-none">
              404
            </h1>
            <div className="absolute inset-0 text-8xl sm:text-9xl font-black text-orange-300 blur-xl leading-none">
              404
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className={`transform transition-all duration-1000 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Oops! Page Not Found
          </h2>
          <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
            The page you're looking for seems to have vanished into thin air. 
            Let's get you back to safety!
          </p>
        </div>

        {/* Action Buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center transform transition-all duration-1000 delay-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <button
            onClick={handleGoHome}
            className="group relative px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25 overflow-hidden"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <i className="fas fa-home"></i>
              Back to Dashboard
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-400 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          </button>
          
          <Link
            href="/admin"
            className="group px-8 py-4 bg-white border-2 border-slate-200 hover:border-orange-400 text-slate-700 font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="fas fa-cog"></i>
              Admin Panel
            </span>
          </Link>
        </div>

        {/* Animated Elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-orange-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-orange-300 rounded-full opacity-30 animate-bounce"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-orange-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-32 right-10 w-14 h-14 bg-orange-300 rounded-full opacity-30 animate-bounce"></div>

        {/* Decorative Icons */}
        <div className={`absolute -top-10 -left-10 text-6xl text-orange-200 transform rotate-12 transition-all duration-2000 delay-700 ${mounted ? 'opacity-50' : 'opacity-0'}`}>
          <i className="fas fa-paint-brush"></i>
        </div>
        <div className={`absolute -bottom-10 -right-10 text-6xl text-orange-200 transform -rotate-12 transition-all duration-2000 delay-1000 ${mounted ? 'opacity-50' : 'opacity-0'}`}>
          <i className="fas fa-palette"></i>
        </div>
      </div>
    </div>
  );
}
