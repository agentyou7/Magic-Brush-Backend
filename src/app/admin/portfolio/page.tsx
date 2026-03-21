'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleUnauthorizedResponse } from '@/lib/client-auth';

interface PortfolioItem {
  id: string;
  title: string;
  metaText: string;
  imageUrl: string;
  imagePublicId: string;
  isActive: boolean;
  createdAt?: string;
}

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const PortfolioPage = () => {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        await handleUnauthorizedResponse(authResponse, router);

        const response = await fetch('/api/admin/portfolio/all?includeInactive=true', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        await handleUnauthorizedResponse(response, router);
        const data = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch portfolio items');
        }

        if (isMounted) {
          setPortfolio(Array.isArray(data?.data?.portfolio) ? data.data.portfolio : []);
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Failed to load portfolio page:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load portfolio right now.'
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleDeletePortfolioItem = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/admin/portfolio/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await handleUnauthorizedResponse(response, router);
      const data = await readJsonSafely(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete portfolio item');
      }

      if (deleteTarget.imagePublicId) {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publicId: deleteTarget.imagePublicId }),
        });
      }

      setPortfolio((currentItems) =>
        currentItems.filter((item) => item.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to delete this portfolio item right now.'
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleStatus = async (portfolioId: string, nextStatus: boolean) => {
    const previousPortfolio = portfolio;

    setStatusUpdatingId(portfolioId);
    setErrorMessage('');
    setPortfolio((currentItems) =>
      currentItems.map((item) =>
        item.id === portfolioId ? { ...item, isActive: nextStatus } : item
      )
    );

    try {
      const response = await fetch(`/api/admin/portfolio/${portfolioId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: nextStatus }),
      });

      await handleUnauthorizedResponse(response, router);
      const data = await readJsonSafely(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update portfolio status');
      }
    } catch (error) {
      setPortfolio(previousPortfolio);
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update this portfolio item right now.'
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <img
          src="/images/logo.png"
          alt="Magic Brush Ltd"
          className="h-20 w-auto animate-pulse object-contain"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-slate-900">Portfolio Management</h1>
          <p className="text-slate-600">Showcase your best work and transformations</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/admin/portfolio/new')}
          className="rounded-xl bg-orange-500 px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-orange-600"
        >
          <i className="fas fa-plus mr-2"></i>
          Add New
        </button>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {portfolio.map((item) => (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg"
          >
            <div className="relative h-48 sm:h-64 bg-gradient-to-br from-slate-100 to-slate-200">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = `https://picsum.photos/seed/${item.id}/400/300.jpg`;
                }}
              />
              <div className="absolute right-2 sm:right-4 top-2 sm:top-4">
                <span
                  className={`rounded-full px-2 sm:px-3 py-1 text-xs font-medium ${
                    item.isActive ? 'bg-orange-500 text-white' : 'bg-slate-900 text-white'
                  }`}
                >
                  {item.isActive ? 'Active' : 'Hidden'}
                </span>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <h3 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold text-slate-900 line-clamp-1">{item.title}</h3>
              <p className="mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3 text-xs sm:text-sm text-slate-600">{item.metaText}</p>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(item.id, !item.isActive)}
                  disabled={statusUpdatingId === item.id}
                  className={`flex-1 rounded-xl px-2 sm:px-4 py-2 font-medium text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 text-xs sm:text-sm ${
                    item.isActive
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  <i className={`fas ${item.isActive ? 'fa-toggle-on' : 'fa-toggle-off'} mr-1 sm:mr-2`}></i>
                  <span className="hidden sm:inline">
                    {statusUpdatingId === item.id
                      ? 'Updating...'
                      : item.isActive
                        ? 'Turn Off'
                        : 'Turn On'}
                  </span>
                  <span className="sm:hidden">
                    {statusUpdatingId === item.id
                      ? '...'
                      : item.isActive
                        ? 'Off'
                        : 'On'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  disabled={deleteLoading && deleteTarget?.id === item.id}
                  className="flex-1 rounded-xl bg-slate-200 px-2 sm:px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-slate-300 text-xs sm:text-sm"
                >
                  <i className="fas fa-trash mr-1 sm:mr-2"></i>
                  <span className="hidden sm:inline">Delete</span>
                  <span className="sm:hidden">Del</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => router.push('/admin/portfolio/new')}
          className="cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white text-left shadow-sm transition-colors duration-200 hover:border-orange-400"
        >
          <div className="flex h-48 sm:h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 sm:mb-4 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-orange-100">
                <i className="fas fa-plus text-xl sm:text-2xl text-orange-500"></i>
              </div>
              <p className="font-medium text-slate-600 text-sm sm:text-base px-4">Add Portfolio Item</p>
            </div>
          </div>
        </button>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900">Delete Portfolio Item?</h2>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-900">{deleteTarget.title}</span>?
              </p>
              <p className="mt-2 text-sm text-slate-500">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 p-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePortfolioItem}
                disabled={deleteLoading}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-red-600 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PortfolioPage;
