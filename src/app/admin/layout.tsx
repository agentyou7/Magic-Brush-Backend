'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { handleUnauthorizedResponse, redirectToLogin } from '@/lib/client-auth';

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        await handleUnauthorizedResponse(response, router);

        const result = await response.json();
        const authenticatedUser = result?.data?.user as User | undefined;

        if (!authenticatedUser) {
          throw new Error('User data missing');
        }

        localStorage.setItem('user', JSON.stringify(authenticatedUser));

        if (isMounted) {
          setUser(authenticatedUser);
          setLoading(false);
        }
      } catch (error) {
        console.error('Admin session check failed:', error);
        localStorage.removeItem('user');

        if (isMounted) {
          setUser(null);
          setLoading(false);
          redirectToLogin(router);
        }
      }
    };

    // Initial session verification
    void verifySession();

    // Set up periodic session check (every 5 minutes)
    const sessionCheckInterval = setInterval(verifySession, 5 * 60 * 1000);

    // Set up visibility change listener to check session when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !loading) {
        void verifySession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up focus listener to check session when window gains focus
    const handleFocus = () => {
      if (!loading) {
        void verifySession();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [router, loading]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      localStorage.removeItem('user');
      setUser(null);
      router.push('/login');
    }
  };

  const openLogoutModal = () => {
    setShowLogoutModal(true);
  };

  const closeLogoutModal = () => {
    setShowLogoutModal(false);
  };

  const isActiveRoute = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const navigationItems = [
    {
      name: 'Home',
      href: '/admin/dashboard',
      icon: 'fas fa-home',
      active: isActiveRoute('/admin/dashboard')
    },
    {
      name: 'Services',
      href: '/admin/services',
      icon: 'fas fa-tools',
      active: isActiveRoute('/admin/services')
    },
    {
      name: 'Portfolio',
      href: '/admin/portfolio',
      icon: 'fas fa-images',
      active: isActiveRoute('/admin/portfolio')
    },
    {
      name: 'Inquiries',
      href: '/admin/inquiries',
      icon: 'fas fa-envelope',
      active: isActiveRoute('/admin/inquiries')
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: 'fas fa-cog',
      active: isActiveRoute('/admin/settings')
    }
  ];

  const activePageName =
    navigationItems.find((item) => item.active)?.name || 'Admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <img
            src="/images/logo.png"
            alt="Magic Brush Ltd"
            className="h-20 w-auto animate-pulse object-contain"
          />
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-slate-600 mb-4">Authentication required</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-64 h-screen bg-white shadow-xl transition-transform duration-300 ease-in-out lg:transform-none`}>
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Logo Section */}
          <div className="px-5 py-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <img
                src="/images/logo.png"
                alt="Magic Brush Ltd"
                className="h-18 w-auto object-contain shrink-0"
              />
              <div className="flex flex-col justify-center leading-none pt-2">
                <span className="font-black text-slate-900 tracking-tight uppercase flex items-baseline text-[0.8rem]">
                  MAGIC <span className="text-orange-500 ml-1">BRUSH</span>{" "}
                  <span className="text-slate-900 ml-1">LTD</span>
                </span>
                <span className="mt-1.5 font-black uppercase tracking-[0.18em] text-slate-400 text-[0.52rem] leading-snug">
                  make your dream come true
                </span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navigationItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      item.active
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
                    }`}
                  >
                    <i className={`${item.icon} w-5 text-center`}></i>
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-orange-600"></i>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{user.email}</p>
                <p className="text-xs text-slate-500">{user.role}</p>
              </div>
            </div>
            <button
              onClick={openLogoutModal}
              className="w-full cursor-pointer flex items-center justify-center space-x-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 font-medium"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-0 h-screen overflow-y-auto min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 shadow-sm">
          <div className="relative flex items-center justify-between min-h-[56px]">
            <button
              onClick={() => setSidebarOpen(true)}
              className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-50"
              aria-label="Open navigation menu"
            >
              <i className="fas fa-bars text-base"></i>
            </button>

            <div className="pointer-events-none absolute inset-x-0 flex justify-center px-14">
              <div className="flex max-w-[210px] items-center justify-center gap-2 text-center">
                <img
                  src="/images/logo.png"
                  alt="Magic Brush Ltd"
                  className="h-9 w-auto shrink-0 object-contain"
                />
                <div className="min-w-0 text-left leading-none">
                  <p className="truncate text-[0.82rem] font-black uppercase tracking-tight text-slate-900">
                    MAGIC <span className="text-orange-500">BRUSH</span> LTD
                  </p>
                  <p className="mt-1 truncate text-[0.48rem] font-black uppercase tracking-[0.22em] text-slate-400">
                    {activePageName}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100">
              <i className="fas fa-user text-sm text-orange-600"></i>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-slate-200">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <i className="fas fa-sign-out-alt text-2xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Confirm Logout</h2>
              <p className="mt-3 text-sm text-slate-600">
                Are you sure you want to logout from your admin account?
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={closeLogoutModal}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-all hover:bg-slate-50"
              >
                No
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3 font-medium text-white transition-all hover:bg-red-600"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
