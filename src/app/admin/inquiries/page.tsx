'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
  status: string;
  createdAt: string;
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

const InquiriesPage = () => {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');

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

        const response = await fetch('/api/admin/inquiries', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch inquiries');
        }

        if (isMounted) {
          setInquiries(Array.isArray(data?.inquiries) ? data.inquiries : []);
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Failed to load inquiries page:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load inquiries right now.'
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

  const updateInquiryStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/inquiries/${id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setInquiries((previousInquiries) =>
          previousInquiries.map((inquiry) =>
            inquiry.id === id ? { ...inquiry, status } : inquiry
          )
        );
      }
    } catch (error) {
      console.error('Error updating inquiry status:', error);
    }
  };

  const filteredInquiries = inquiries.filter((inquiry) => {
    if (filter === 'all') {
      return true;
    }

    return inquiry.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-700';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Customer Inquiries</h1>
        <p className="text-slate-600">Manage and respond to customer requests</p>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'new', 'contacted', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
              filter === status
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Message</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInquiries.map((inquiry) => (
                <tr key={inquiry.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{inquiry.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600">{inquiry.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600">{inquiry.phone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600">{inquiry.service}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600 max-w-xs truncate" title={inquiry.message}>
                      {inquiry.message}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inquiry.status)}`}>
                      {inquiry.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600">
                      {new Date(inquiry.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {inquiry.status !== 'completed' && (
                        <button
                          onClick={() => updateInquiryStatus(inquiry.id, 'completed')}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-all duration-200"
                        >
                          Complete
                        </button>
                      )}
                      {inquiry.status === 'new' && (
                        <button
                          onClick={() => updateInquiryStatus(inquiry.id, 'contacted')}
                          className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-medium transition-all duration-200"
                        >
                          Contact
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredInquiries.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-envelope text-3xl text-orange-500"></i>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            No {filter === 'all' ? 'Inquiries' : filter} Yet
          </h3>
          <p className="text-slate-600 max-w-md mx-auto">
            {filter === 'all'
              ? 'Customer inquiries will appear here when visitors contact you through your website.'
              : `No ${filter} inquiries found. Try changing the filter or check back later.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default InquiriesPage;
