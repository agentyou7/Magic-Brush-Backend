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
  const [loading, setLoading] = useState(true);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
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

  const handleDeleteService = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/admin/services/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await handleUnauthorizedResponse(response, router);

      const data = await readJsonSafely(response);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete service');
      }

      setServices((currentServices) =>
        currentServices.filter((service) => service.id !== deleteTarget.id)
      );
      setDeleteTarget(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to delete this service right now.'
      );
    } finally {
      setDeleteLoading(false);
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Services Management</h1>
          <p className="text-slate-600">Manage your service offerings</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`relative rounded-xl ${searchQuery !== '' ? 'border-2 border-orange-500' : ''}`}>
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-10 py-3 bg-white border rounded-xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent w-64 ${
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
            className={`relative px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${
              hasActiveFilters 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' 
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-600 rounded-full"></span>
            )}
          </button>
          <button 
            onClick={() => router.push('/admin/services/new')}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200"
          >
            <i className="fas fa-plus mr-2"></i>
            New
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200"
          >
            <div className="h-48 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center relative">
              {service.imageUrl ? (
                <img 
                  src={service.imageUrl} 
                  alt={service.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <i className={`fas fa-${service.iconName.toLowerCase()} text-2xl text-orange-500`}></i>
                  </div>
                  <p className="text-orange-600 font-medium">{service.iconName}</p>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{service.title}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    service.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {service.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-slate-600 text-sm mb-2 font-medium">{service.shortHeading}</p>
              <p className="text-slate-500 text-sm mb-4 line-clamp-2">{service.description}</p>

              <div className="mb-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Features:</p>
                <div className="space-y-1">
                  {service.features.slice(0, 2).map((feature, index) => (
                    <div key={feature.id} className="flex items-center gap-2 text-xs text-slate-600">
                      <i className={`fas fa-${feature.iconName.toLowerCase()} text-orange-500`}></i>
                      <span>{feature.heading}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => handleToggleStatus(service.id, !service.isActive)}
                  disabled={statusUpdatingId === service.id}
                  className={`flex-1 px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                    service.isActive
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <i className={`fas ${service.isActive ? 'fa-toggle-on' : 'fa-toggle-off'} mr-2`}></i>
                  {statusUpdatingId === service.id
                    ? 'Updating...'
                    : service.isActive
                      ? 'Turn Off'
                      : 'Turn On'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(service)}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all duration-200"
                >
                  <i className="fas fa-trash mr-1"></i>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => router.push('/admin/services/new')}
          className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300 overflow-hidden hover:border-orange-400 transition-colors duration-200 cursor-pointer text-left"
        >
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-plus text-2xl text-orange-500"></i>
              </div>
              <p className="text-slate-600 font-medium">Add New Service</p>
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
    </div>
  );
};

export default ServicesPage;
