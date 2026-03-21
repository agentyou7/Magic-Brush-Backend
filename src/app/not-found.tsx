'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center px-4 overflow-hidden">
      <div className="text-center max-w-lg mx-auto">
        {/* Animated 404 Number */}
        <div className={`mb-8 transform transition-all duration-1000 ${mounted ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <h1 className="text-7xl sm:text-8xl font-black text-orange-500 leading-none">
            404
          </h1>
        </div>

        {/* Error Message */}
        <div className={`mb-8 transform transition-all duration-1000 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4">
            Oops! Page Not Found
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-md mx-auto">
            The page you're looking for seems to have vanished. Let's get you back home!
          </p>
        </div>

        {/* Action Button */}
        <div className={`transform transition-all duration-1000 delay-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <button
            onClick={handleGoHome}
            className="group px-6 sm:px-8 py-3 sm:py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-orange-500/25"
          >
            <span className="flex items-center justify-center gap-2">
              <i className="fas fa-home"></i>
              Back Home
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
