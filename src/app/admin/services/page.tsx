'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Service {
  id: string;
  title: string;
  description: string;
  price: string | number;
  duration: string;
  isActive: boolean;
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

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        if (!authResponse.ok) {
          router.replace('/login');
          return;
        }

        const response = await fetch('/api/services', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

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
          <p className="text-slate-600">Manage your service offerings and pricing</p>
        </div>
        <button className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200">
          <i className="fas fa-plus mr-2"></i>
          Add New Service
        </button>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <div
            key={service.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200"
          >
            <div className="h-48 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
              <i className="fas fa-concierge-bell text-4xl text-orange-500"></i>
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

              <p className="text-slate-600 text-sm mb-4 line-clamp-3">{service.description}</p>

              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-orange-600">GBP {service.price}</span>
                <span className="text-sm text-slate-500">{service.duration}</span>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200">
                  <i className="fas fa-edit"></i>
                </button>
                <button className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-all duration-200">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-slate-300 overflow-hidden hover:border-orange-400 transition-colors duration-200 cursor-pointer">
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-plus text-2xl text-orange-500"></i>
              </div>
              <p className="text-slate-600 font-medium">Add New Service</p>
            </div>
          </div>
        </div>
      </div>

      {services.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-concierge-bell text-3xl text-orange-500"></i>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Services Yet</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Start by adding your first service to showcase your offerings to potential clients.
          </p>
          <button className="mt-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200">
            <i className="fas fa-plus mr-2"></i>
            Add Your First Service
          </button>
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
