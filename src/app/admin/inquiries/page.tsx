'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleUnauthorizedResponse } from '@/lib/client-auth';

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  service: string;
  message: string;
  source: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        await handleUnauthorizedResponse(authResponse, router);

        const response = await fetch('/api/admin/inquiries', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        await handleUnauthorizedResponse(response, router);

        const data = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch inquiries');
        }

        if (isMounted) {
          setInquiries(Array.isArray(data?.data?.inquiries) ? data.data.inquiries : []);
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

  const filteredInquiries = inquiries.filter((inquiry) => {
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    if (!normalizedSearchQuery) {
      return true;
    }

    return (
      inquiry.name.toLowerCase().includes(normalizedSearchQuery) ||
      inquiry.phone.toLowerCase().includes(normalizedSearchQuery)
    );
  });

  const inquiriesPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredInquiries.length / inquiriesPerPage));
  const paginatedInquiries = filteredInquiries.slice(
    (currentPage - 1) * inquiriesPerPage,
    currentPage * inquiriesPerPage
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const closeInquiryModal = () => {
    setSelectedInquiry(null);
  };

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

      <div className="mb-6">
        <div className="relative max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or phone number"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500"
          />
          <i className="fas fa-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Message</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedInquiries.map((inquiry) => (
                <tr
                  key={inquiry.id}
                  onClick={() => setSelectedInquiry(inquiry)}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{inquiry.name}</div>
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
                    <div className="text-slate-600">{inquiry.source || 'website'}</div>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredInquiries.length > 0 ? (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * inquiriesPerPage + 1}
            {' '}-{' '}
            {Math.min(currentPage * inquiriesPerPage, filteredInquiries.length)}
            {' '}of {filteredInquiries.length} inquiries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((previousPage) => Math.max(1, previousPage - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage((previousPage) => Math.min(totalPages, previousPage + 1))
              }
              disabled={currentPage === totalPages}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {filteredInquiries.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-envelope text-3xl text-orange-500"></i>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {searchQuery.trim() ? 'No Matching Inquiries' : 'No Inquiries Yet'}
          </h3>
          <p className="text-slate-600 max-w-md mx-auto">
            {searchQuery.trim()
              ? 'Try a different customer name or phone number.'
              : 'Customer inquiries will appear here when visitors contact you through your website.'}
          </p>
        </div>
      )}

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
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(selectedInquiry.status)}`}
                >
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Service</p>
                  <p className="mt-2 text-base font-medium text-slate-900">
                    {selectedInquiry.service || 'Not provided'}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Source</p>
                  <p className="mt-2 text-base font-medium capitalize text-slate-900">
                    {selectedInquiry.source || 'website'}
                  </p>
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

export default InquiriesPage;
