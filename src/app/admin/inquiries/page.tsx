'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleUnauthorizedResponse } from '@/lib/client-auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  email?: string;
  service: string;
  message: string;
  source: string;
  status: string;
  createdAt: string;
}

type ExportFormat = 'excel' | 'pdf';

type ExportRange = {
  from: string;
  to: string;
};

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

const TODAY_DATE = new Date().toISOString().split('T')[0];

const formatDisplayDate = (value: string) => new Date(value).toLocaleDateString();

const formatDateForFilename = (value: string) => value.replace(/-/g, '');

const getDateRangeFileName = (format: ExportFormat, range: ExportRange) =>
  `inquiries_${formatDateForFilename(range.from)}_to_${formatDateForFilename(range.to)}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

const isInquiryWithinRange = (inquiry: Inquiry, range: ExportRange) => {
  const inquiryDate = new Date(inquiry.createdAt);
  const startDate = new Date(`${range.from}T00:00:00`);
  const endDate = new Date(`${range.to}T23:59:59.999`);

  return inquiryDate >= startDate && inquiryDate <= endDate;
};

const buildExportRows = (items: Inquiry[]) =>
  items.map((inquiry) => ({
    Name: inquiry.name || 'Not provided',
    Phone: inquiry.phone || 'Not provided',
    Email: inquiry.email || 'Not provided',
    Service: inquiry.service || 'Not provided',
    Message: inquiry.message || 'No message provided',
    Source: inquiry.source || 'website',
    Status: inquiry.status || 'new',
    Date: new Date(inquiry.createdAt).toLocaleString(),
  }));

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const InquiriesPage = () => {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [inquiryPendingDelete, setInquiryPendingDelete] = useState<Inquiry | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('excel');
  const [exportRange, setExportRange] = useState<ExportRange>({
    from: TODAY_DATE,
    to: TODAY_DATE,
  });
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingInquiry, setIsDeletingInquiry] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      try {
        const authResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        });

        await handleUnauthorizedResponse(authResponse);

        const response = await fetch('/api/admin/inquiries', {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        await handleUnauthorizedResponse(response);

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

  const openDeleteModal = (event: React.MouseEvent, inquiry: Inquiry) => {
    event.stopPropagation();
    setInquiryPendingDelete(inquiry);
    setErrorMessage('');
  };

  const closeDeleteModal = () => {
    if (isDeletingInquiry) {
      return;
    }

    setInquiryPendingDelete(null);
  };

  const openExportModal = (format: ExportFormat) => {
    setSelectedExportFormat(format);
    setShowDownloadMenu(false);
    setExportError('');
    setExportRange({
      from: TODAY_DATE,
      to: TODAY_DATE,
    });
    setShowExportModal(true);
  };

  const closeExportModal = () => {
    if (isExporting) {
      return;
    }

    setShowExportModal(false);
    setExportError('');
  };

  const handleRangeChange = (field: keyof ExportRange, value: string) => {
    setExportRange((previousRange) => ({
      ...previousRange,
      [field]: value,
    }));
    setExportError('');
  };

  const exportInquiries = async () => {
    if (!exportRange.from || !exportRange.to) {
      setExportError('Please select both start and end dates.');
      return;
    }

    if (exportRange.from > exportRange.to) {
      setExportError('Start date cannot be after end date.');
      return;
    }

    const rangedInquiries = inquiries.filter((inquiry) => isInquiryWithinRange(inquiry, exportRange));

    if (rangedInquiries.length === 0) {
      setExportError('No inquiries found in the selected date range.');
      return;
    }

    const exportRows = buildExportRows(rangedInquiries);
    const fileName = getDateRangeFileName(selectedExportFormat, exportRange);

    try {
      setIsExporting(true);

      if (selectedExportFormat === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Inquiries');
        XLSX.writeFile(workbook, fileName);
      } else {
        const document = new jsPDF({
          orientation: 'landscape',
          unit: 'pt',
          format: 'a4',
        });

        document.setFontSize(16);
        document.text('Customer Inquiries Report', 40, 40);
        document.setFontSize(10);
        document.text(
          `Date range: ${formatDisplayDate(exportRange.from)} to ${formatDisplayDate(exportRange.to)}`,
          40,
          58
        );

        autoTable(document, {
          startY: 76,
          head: [['Name', 'Phone', 'Email', 'Service', 'Message', 'Source', 'Status', 'Date']],
          body: exportRows.map((row) => [
            row.Name,
            row.Phone,
            row.Email,
            row.Service,
            row.Message,
            row.Source,
            row.Status,
            row.Date,
          ]),
          styles: {
            fontSize: 8,
            cellPadding: 6,
            overflow: 'linebreak',
            valign: 'middle',
          },
          headStyles: {
            fillColor: [249, 115, 22],
          },
          columnStyles: {
            0: { cellWidth: 85 },
            1: { cellWidth: 80 },
            2: { cellWidth: 120 },
            3: { cellWidth: 95 },
            4: { cellWidth: 165 },
            5: { cellWidth: 55 },
            6: { cellWidth: 55 },
            7: { cellWidth: 85 },
          },
          margin: { left: 40, right: 40, bottom: 30 },
        });

        const pdfBlob = document.output('blob');
        downloadBlob(pdfBlob, fileName);
      }

      setShowExportModal(false);
      setExportError('');
    } catch (error) {
      console.error('Failed to export inquiries:', error);
      setExportError('Unable to export inquiries right now. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const deleteInquiry = async () => {
    if (!inquiryPendingDelete) {
      return;
    }

    try {
      setIsDeletingInquiry(true);

      const response = await fetch(`/api/admin/inquiries/${inquiryPendingDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      await handleUnauthorizedResponse(response);
      const data = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete inquiry');
      }

      setInquiries((previousInquiries) =>
        previousInquiries.filter((inquiry) => inquiry.id !== inquiryPendingDelete.id)
      );
      setSelectedInquiry((previousInquiry) =>
        previousInquiry?.id === inquiryPendingDelete.id ? null : previousInquiry
      );
      setInquiryPendingDelete(null);
      setErrorMessage('');
    } catch (error) {
      console.error('Failed to delete inquiry:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to delete inquiry right now.'
      );
    } finally {
      setIsDeletingInquiry(false);
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

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by name or phone number"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500"
          />
          <i className="fas fa-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
        </div>

        <div className="relative self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowDownloadMenu((previousState) => !previousState)}
            className="inline-flex items-center gap-3 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600"
          >
            <i className="fas fa-download text-sm"></i>
            <span>Download</span>
            <i className={`fas fa-chevron-${showDownloadMenu ? 'up' : 'down'} text-xs`}></i>
          </button>

          {showDownloadMenu ? (
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
              <button
                type="button"
                onClick={() => openExportModal('excel')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <i className="fas fa-file-excel text-green-600"></i>
                <span>Download Excel</span>
              </button>
              <button
                type="button"
                onClick={() => openExportModal('pdf')}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <i className="fas fa-file-pdf text-red-500"></i>
                <span>Download PDF</span>
              </button>
            </div>
          ) : null}
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
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
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
                    <button
                      type="button"
                      onClick={(event) => openDeleteModal(event, inquiry)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 transition-all hover:bg-red-100 hover:text-red-600"
                      aria-label={`Delete inquiry from ${inquiry.name}`}
                      title="Delete inquiry"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
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
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
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

      {showExportModal ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Export as {selectedExportFormat === 'excel' ? 'Excel' : 'PDF'}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Select a start and end date to download all inquiries in that range.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExportModal}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                aria-label="Close export dialog"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  From
                </label>
                <input
                  type="date"
                  value={exportRange.from}
                  max={TODAY_DATE}
                  onChange={(event) => handleRangeChange('from', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  To
                </label>
                <input
                  type="date"
                  value={exportRange.to}
                  min={exportRange.from}
                  max={TODAY_DATE}
                  onChange={(event) => handleRangeChange('to', event.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {exportError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {exportError}
              </div>
            ) : null}

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={closeExportModal}
                disabled={isExporting}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={exportInquiries}
                disabled={isExporting}
                className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isExporting ? 'Preparing...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inquiryPendingDelete ? (
        <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <i className="fas fa-trash-alt text-xl"></i>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Delete inquiry?</h2>
              <p className="mt-3 text-sm text-slate-600">
                This will permanently delete the inquiry from <span className="font-semibold text-slate-900">{inquiryPendingDelete.name}</span>.
              </p>
            </div>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeletingInquiry}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteInquiry}
                disabled={isDeletingInquiry}
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingInquiry ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InquiriesPage;
