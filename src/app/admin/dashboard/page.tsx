'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleUnauthorizedResponse } from '@/lib/client-auth';

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  service: string;
  message: string;
  status: string;
  createdAt: string;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

const getStatusClasses = (status: string) => {
  switch (status) {
    case 'new':
      return 'bg-green-100 text-green-700';
    case 'called':
      return 'bg-blue-100 text-blue-700';
    case 'quoted':
      return 'bg-yellow-100 text-yellow-700';
    case 'won':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const DashboardPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({
    totalInquiries: 0,
    newInquiries: 0,
    totalUsers: 0,
    activeUsers: 0,
  });
  const [recentInquiries, setRecentInquiries] = useState<Inquiry[]>([]);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const bootstrapDashboard = async () => {
      try {
        const authResponse = await fetchWithTimeout('/api/auth/me', {
          credentials: 'include',
        });
        await handleUnauthorizedResponse(authResponse, router);

        const authData = await authResponse.json();
        const authenticatedUser = authData?.data?.user;

        if (!authenticatedUser) {
          throw new Error('User data missing');
        }

        localStorage.setItem('user', JSON.stringify(authenticatedUser));

        if (isMounted) {
          setUser(authenticatedUser);
        }

        await fetchDashboardData();
      } catch (error) {
        console.error('Dashboard bootstrap failed:', error);
        localStorage.removeItem('user');

        if (isMounted) {
          setLoading(false);
          router.replace('/login');
        }
      }
    };

    void bootstrapDashboard();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const fetchDashboardData = async () => {
    try {
      const [inquiriesResult, usersResult] = await Promise.allSettled([
        fetchWithTimeout('/api/admin/inquiries', {
          credentials: 'include',
        }),
        fetchWithTimeout('/api/admin/users', {
          credentials: 'include',
        }),
      ]);

      if (inquiriesResult.status === 'fulfilled' && inquiriesResult.value.status === 401) {
        await handleUnauthorizedResponse(inquiriesResult.value, router);
      }

      if (usersResult.status === 'fulfilled' && usersResult.value.status === 401) {
        await handleUnauthorizedResponse(usersResult.value, router);
      }

      if (inquiriesResult.status === 'fulfilled' && inquiriesResult.value.ok) {
        const inquiriesData = await inquiriesResult.value.json();
        const inquiries = inquiriesData.data?.inquiries || [];

        setRecentInquiries(inquiries.slice(0, 5));
        setStats((previousStats) => ({
          ...previousStats,
          totalInquiries: inquiries.length,
          newInquiries: inquiries.filter((inquiry: Inquiry) => inquiry.status === 'new').length,
        }));
      }

      if (usersResult.status === 'fulfilled' && usersResult.value.ok) {
        const usersData = await usersResult.value.json();
        const users = usersData.data?.users || [];

        setStats((previousStats) => ({
          ...previousStats,
          totalUsers: users.length,
          activeUsers: users.filter((adminUser: User) => adminUser.isActive).length,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeInquiryModal = () => {
    setSelectedInquiry(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50">
        <div className="text-center">
          <img
            src="/images/logo.png"
            alt="Magic Brush Ltd"
            className="mx-auto h-20 w-auto animate-pulse object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      <header className="border-b border-slate-100 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/20">
                <span className="font-bold text-white">MB</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-600">Magic Brush Ltd</p>
              </div>
            </div>

            <div className="hidden items-center space-x-4 sm:flex">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.email?.split('@')[0]}</p>
                <p className="text-xs capitalize text-slate-600">{user?.role}</p>
              </div>
              <div className="rounded-xl p-2 text-slate-600">
                <span className="text-xl">|</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 rounded-[2.5rem] border border-slate-100 bg-white p-8 shadow-xl">
          <h2 className="mb-2 text-3xl font-bold text-slate-900">
            Welcome back, {user?.email?.split('@')[0]}!
          </h2>
          <p className="text-slate-600">Here&apos;s what&apos;s happening with your business today.</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                <i className="fas fa-envelope text-xl text-blue-600"></i>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.totalInquiries}</span>
            </div>
            <h3 className="font-semibold text-slate-900">Total Inquiries</h3>
            <p className="text-sm text-slate-600">All time submissions</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100">
                <i className="fas fa-bell text-xl text-green-600"></i>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.newInquiries}</span>
            </div>
            <h3 className="font-semibold text-slate-900">New Inquiries</h3>
            <p className="text-sm text-slate-600">Awaiting response</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100">
                <i className="fas fa-users text-xl text-purple-600"></i>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.totalUsers}</span>
            </div>
            <h3 className="font-semibold text-slate-900">Total Users</h3>
            <p className="text-sm text-slate-600">Registered accounts</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
                <i className="fas fa-user-check text-xl text-orange-600"></i>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.activeUsers}</span>
            </div>
            <h3 className="font-semibold text-slate-900">Active Users</h3>
            <p className="text-sm text-slate-600">Currently active</p>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-slate-100 bg-white shadow-xl">
          <div className="p-8">
            <h3 className="mb-6 text-xl font-bold text-slate-900">Recent Inquiries</h3>

            {recentInquiries.length > 0 ? (
              <>
                <div className="hidden space-y-4 md:block">
                  {recentInquiries.map((inquiry) => (
                    <button
                      key={inquiry.id}
                      type="button"
                      onClick={() => setSelectedInquiry(inquiry)}
                      className="w-full cursor-pointer rounded-2xl border border-slate-100 p-4 text-left transition-all hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center space-x-4">
                            <h4 className="font-semibold text-slate-900">{inquiry.name}</h4>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClasses(inquiry.status)}`}>
                              {inquiry.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-6 text-sm text-slate-600">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-slate-500">Phone</span>
                              <span>{inquiry.phone}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-slate-500">Service</span>
                              <span>{inquiry.service}</span>
                            </div>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{inquiry.message}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">
                            {new Date(inquiry.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="-mx-2 overflow-x-auto pb-2 md:hidden">
                  <div className="min-w-[760px] px-2">
                    <div className="overflow-hidden rounded-3xl border border-slate-200">
                      <table className="w-full bg-white">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Service</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Message</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {recentInquiries.map((inquiry) => (
                            <tr
                              key={inquiry.id}
                              onClick={() => setSelectedInquiry(inquiry)}
                              className="cursor-pointer transition-colors hover:bg-slate-50"
                            >
                              <td className="px-4 py-4 text-sm font-semibold text-slate-900">{inquiry.name}</td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(inquiry.status)}`}>
                                  {inquiry.status}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-600">{inquiry.phone}</td>
                              <td className="px-4 py-4 text-sm text-slate-600">{inquiry.service}</td>
                              <td className="max-w-[240px] px-4 py-4 text-sm text-slate-600">
                                <p className="truncate">{inquiry.message}</p>
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-500">
                                {new Date(inquiry.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center">
                <span className="text-4xl">@</span>
                <p className="mt-4 text-slate-600">No inquiries yet</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedInquiry ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/35 px-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-2xl">
            <button
              type="button"
              onClick={closeInquiryModal}
              className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
              aria-label="Close inquiry details"
            >
              <i className="fas fa-times"></i>
            </button>

            <div className="pr-12">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">{selectedInquiry.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(selectedInquiry.status)}`}>
                  {selectedInquiry.status}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Phone</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {selectedInquiry.phone || 'Not provided'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Email</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {selectedInquiry.email || 'Not provided'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Service</p>
                  <p className="mt-2 text-base font-medium text-slate-900">{selectedInquiry.service}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Date</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {new Date(selectedInquiry.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Message</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {selectedInquiry.message || 'No message provided.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
