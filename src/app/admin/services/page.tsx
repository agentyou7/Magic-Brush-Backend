'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, X, Clock } from 'lucide-react';
import { handleUnauthorizedResponse } from '@/lib/client-auth';

interface Service {
  id: string;
  title: string;
  shortHeading: string;
  description: string;
  fullDetails: string;
  iconName: string;
  imageUrl: string;
  imagePublicId: string;
  features: Array<{
    id: string;
    iconName: string;
    heading: string;
    description: string;
  }>;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
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

const ServicesPage = () => {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        await handleUnauthorizedResponse(authResponse, router);

        const response = await fetch('/api/admin/services/all?includeInactive=true', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        await handleUnauthorizedResponse(response, router);

        const data = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch services');
        }

        if (isMounted) {
          setServices(Array.isArray(data?.data?.services) ? data.data.services : []);
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Failed to load services page:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load services right now.'
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

  const filteredServices = services.filter(service => {
    const matchesSearchQuery = service.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatusFilter = (
      (statusFilter === 'active' && service.isActive) ||
      (statusFilter === 'inactive' && !service.isActive) ||
      statusFilter === 'all'
    );
    return matchesSearchQuery && matchesStatusFilter;
  });

  const clearFilters = () => {
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleDeleteService = async () => {
    if (!deleteTarget || deleteLoading) {
      return;
    }

    const target = deleteTarget;
    const previousServices = services;

    setDeleteLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setServices((currentServices) =>
      currentServices.filter((service) => service.id !== target.id)
    );
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/services/${target.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await handleUnauthorizedResponse(response, router);
      const data = await readJsonSafely(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete service');
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
        setServices(previousServices);
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to delete this service right now.'
        );
      } else {
        setSuccessMessage(`"${target.title}" was deleted successfully.`);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleToggleStatus = async (serviceId: string, nextStatus: boolean) => {
    const previousServices = services;

    setStatusUpdatingId(serviceId);
    setErrorMessage('');
    setServices((currentServices) =>
      currentServices.map((service) =>
        service.id === serviceId ? { ...service, isActive: nextStatus } : service
      )
    );

    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
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
        throw new Error(data?.message || 'Failed to update service status');
      }
    } catch (error) {
      setServices(previousServices);
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update service status right now.'
      );
    } finally {
      setStatusUpdatingId(null);
    }
  };

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
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Services Management</h1>
          <p className="text-slate-600 text-sm sm:text-base">Manage your service offerings</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className={`relative rounded-xl ${searchQuery !== '' ? 'border-2 border-orange-500' : ''}`}>
            <input
              type="text"
              placeholder="Search services..."
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
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
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
            onClick={() => router.push('/admin/services/new')}
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
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200"
          >
            <div className="h-40 sm:h-48 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center relative">
              {service.imageUrl ? (
                <img 
                  src={service.imageUrl} 
                  alt={service.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <i className={`fas fa-${service.iconName.toLowerCase()} text-xl sm:text-2xl text-orange-500`}></i>
                  </div>
                  <p className="text-orange-600 font-medium text-sm">{service.iconName}</p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 line-clamp-1">{service.title}</h3>
                <span
                  className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                    service.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {service.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-slate-600 text-xs sm:text-sm mb-2 font-medium line-clamp-1">{service.shortHeading}</p>
              <p className="text-slate-500 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{service.description}</p>

              <div className="mb-3 sm:mb-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Features:</p>
                <div className="space-y-1">
                  {service.features.slice(0, 2).map((feature, index) => (
                    <div key={feature.id} className="flex items-center gap-2 text-xs text-slate-600">
                      <i className={`fas fa-${feature.iconName.toLowerCase()} text-orange-500`}></i>
                      <span className="line-clamp-1">{feature.heading}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <button 
                  type="button"
                  onClick={() => handleToggleStatus(service.id, !service.isActive)}
                  disabled={statusUpdatingId === service.id}
                  className={`flex-1 px-3 sm:px-4 py-2 rounded-xl font-medium transition-all duration-200 text-xs sm:text-sm ${
                    service.isActive 
                      ? 'bg-green-500 hover:bg-green-600 text-white' 
                      : 'bg-slate-500 hover:bg-slate-600 text-white'
                  }`}
                >
                  <i className={`fas ${service.isActive ? 'fa-toggle-on' : 'fa-toggle-off'} mr-1`}></i>
                  <span className="hidden sm:inline">
                    {statusUpdatingId === service.id ? 'Updating...' : (service.isActive ? 'Active' : 'Inactive')}
                  </span>
                </button>
                <button 
                  type="button"
                  onClick={() => setDeleteTarget(service)}
                  disabled={deleteLoading && deleteTarget?.id === service.id}
                  className="flex-1 px-3 sm:px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all duration-200 text-xs sm:text-sm"
                >
                  <i className="fas fa-trash mr-1"></i>
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => router.push('/admin/services/new')}
          className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300 overflow-hidden hover:border-orange-400 transition-colors duration-200 cursor-pointer"
        >
          <div className="h-40 sm:h-48 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <i className="fas fa-plus text-xl sm:text-2xl text-orange-500"></i>
              </div>
              <p className="text-slate-600 font-medium text-sm sm:text-base px-4">Add New Service</p>
            </div>
          </div>
        </button>
      </div>

      {/* Filter Modal Overlay */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Filter Services</h2>
              <button 
                onClick={() => setShowFilterModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Filter */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <label className="text-sm font-medium text-slate-900">Status</label>
                </div>
                <div className="space-y-2">
                  {[
                    { value: 'all', label: 'All Services' },
                    { value: 'active', label: 'Active Only' },
                    { value: 'inactive', label: 'Inactive Only' }
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={option.value}
                        checked={statusFilter === option.value}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-4 h-4 text-orange-500 border-slate-300 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

                          </div>

            <div className="flex items-center gap-3 p-6 border-t border-slate-200">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Delete Service?</h2>
              <button
                type="button"
                onClick={() => {
                  if (!deleteLoading) {
                    setDeleteTarget(null);
                  }
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                disabled={deleteLoading}
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete <span className="font-semibold text-slate-900">{deleteTarget.title}</span>?
              </p>
              <p className="mt-2 text-sm text-slate-500">This action cannot be undone.</p>
            </div>

            <div className="flex items-center gap-3 p-6 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-medium transition-all duration-200 hover:bg-slate-50 disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleDeleteService}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
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

export default ServicesPage;
