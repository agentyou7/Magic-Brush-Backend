'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleUnauthorizedResponse } from '@/lib/client-auth';
import { Filter, Search, X } from 'lucide-react';

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
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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
    if (!deleteTarget || deleteLoading) {
      return;
    }

    const target = deleteTarget;
    const previousPortfolio = portfolio;

    setDeleteLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setPortfolio((currentItems) =>
      currentItems.filter((item) => item.id !== target.id)
    );
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/portfolio/${target.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await handleUnauthorizedResponse(response, router);
      const data = await readJsonSafely(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete portfolio item');
      }

      if (target.imagePublicId) {
        try {
          await fetch('/api/upload', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ publicId: target.imagePublicId }),
          });
        } catch (imageError) {
          console.warn('Failed to delete image:', imageError);
        }
      }

      setSuccessMessage(`"${target.title}" was deleted successfully.`);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('not found')) {
        setPortfolio(previousPortfolio);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to delete this portfolio item right now.'
        );
      } else {
        setSuccessMessage(`"${target.title}" was deleted successfully.`);
      }
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

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredPortfolio = portfolio.filter((item) => {
    const matchesSearch =
      normalizedSearchQuery === '' ||
      item.title.toLowerCase().includes(normalizedSearchQuery) ||
      item.metaText.toLowerCase().includes(normalizedSearchQuery);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'inactive' && !item.isActive);

    return matchesSearch && matchesStatus;
  });

  const hasActiveFilters = statusFilter !== 'all';

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Portfolio Management</h1>
          <p className="text-slate-600 text-sm sm:text-base">Showcase your best work and transformations</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className={`relative rounded-xl ${searchQuery !== '' ? 'border-2 border-orange-500' : ''}`}>
            <input
              type="text"
              placeholder="Search portfolio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-10 py-3 bg-white border rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-full sm:w-64 ${
                searchQuery !== '' ? 'border-orange-500' : 'border-slate-200'
              }`}
            />
            {searchQuery !== '' && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            className={`relative px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              hasActiveFilters
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-600 rounded-full"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/portfolio/new')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <i className="fas fa-plus"></i>
            <span className="hidden sm:inline">New</span>
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredPortfolio.map((item) => (
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

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/admin/portfolio/${item.id}/edit`)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-orange-600"
                >
                  <i className="fas fa-pen text-xs"></i>
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(item.id, !item.isActive)}
                  disabled={statusUpdatingId === item.id}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                    item.isActive
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-amber-500 hover:bg-amber-600'
                  }`}
                >
                  <i className={`fas ${item.isActive ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                  <span>
                    {statusUpdatingId === item.id ? 'Saving' : item.isActive ? 'Hide' : 'Show'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  disabled={deleteLoading && deleteTarget?.id === item.id}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <i className="fas fa-trash text-xs"></i>
                  <span>Delete</span>
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

      {showFilterModal ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Filter Portfolio</h2>
                <p className="mt-1 text-sm text-slate-600">Narrow down items by status.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {[
                { value: 'all', label: 'All Items', helper: 'Show active and hidden portfolio items' },
                { value: 'active', label: 'Active Only', helper: 'Show only visible portfolio items' },
                { value: 'inactive', label: 'Hidden Only', helper: 'Show only hidden portfolio items' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value as typeof statusFilter)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                    statusFilter === option.value
                      ? 'border-orange-500 bg-orange-50 text-orange-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{option.label}</p>
                      <p className="mt-1 text-sm text-slate-500">{option.helper}</p>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 ${
                        statusFilter === option.value ? 'border-orange-500 bg-orange-500' : 'border-slate-300'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setShowFilterModal(false);
                }}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-all hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 font-medium text-white transition-all hover:bg-orange-600"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      {successMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900">Delete Successful</h2>
            </div>

            <div className="p-6">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <i className="fas fa-check text-xl"></i>
              </div>
              <p className="text-sm text-slate-600">{successMessage}</p>
            </div>

            <div className="border-t border-slate-200 p-6">
              <button
                type="button"
                onClick={() => setSuccessMessage('')}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-emerald-600"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PortfolioPage;
