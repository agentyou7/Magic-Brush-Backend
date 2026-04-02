'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Image as ImageIcon, Save, X } from 'lucide-react';
import { handleUnauthorizedResponse } from '@/lib/client-auth';

interface NewPortfolioItem {
  title: string;
  metaText: string;
  imageUrl: string;
  imagePublicId: string;
  imageFile: File | null;
  isActive: boolean;
}

const EditPortfolioPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const portfolioId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [portfolioItem, setPortfolioItem] = useState<NewPortfolioItem>({
    title: '',
    metaText: '',
    imageUrl: '',
    imagePublicId: '',
    imageFile: null,
    isActive: true,
  });
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      const message = 'You have unsaved changes. Are you sure you want to leave?';
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let isMounted = true;

    const loadPortfolioItem = async () => {
      try {
        setPageLoading(true);
        setError('');

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
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(result?.message || 'Failed to fetch portfolio item');
        }

        const matchedItem = Array.isArray(result?.data?.portfolio)
          ? result.data.portfolio.find((item: { id: string }) => item.id === portfolioId)
          : null;

        if (!matchedItem) {
          throw new Error('Portfolio item not found');
        }

        if (!isMounted) {
          return;
        }

        setPortfolioItem({
          title: matchedItem.title || '',
          metaText: matchedItem.metaText || '',
          imageUrl: matchedItem.imageUrl || '',
          imagePublicId: matchedItem.imagePublicId || '',
          imageFile: null,
          isActive: matchedItem.isActive ?? true,
        });
        setHasUnsavedChanges(false);
      } catch (loadError) {
        console.error('Failed to load portfolio item:', loadError);

        if (isMounted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Unable to load portfolio item right now.'
          );
        }
      } finally {
        if (isMounted) {
          setPageLoading(false);
        }
      }
    };

    if (portfolioId) {
      void loadPortfolioItem();
    }

    return () => {
      isMounted = false;
    };
  }, [portfolioId, router]);

  const isFormValid = () =>
    portfolioItem.title.trim() !== '' &&
    portfolioItem.metaText.trim() !== '' &&
    portfolioItem.imageUrl.trim() !== '';

  const handleChange = (field: keyof NewPortfolioItem, value: string | boolean | File | null) => {
    setPortfolioItem((previousItem) => ({
      ...previousItem,
      [field]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
      return;
    }

    router.push('/admin/portfolio');
  };

  const handleDiscardChanges = () => {
    setShowDiscardDialog(false);
    setHasUnsavedChanges(false);
    router.push('/admin/portfolio');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const previousImagePublicId = portfolioItem.imagePublicId;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, GIF, WebP, or SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB.');
      return;
    }

    try {
      setImageUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to upload image');
      }

      const urlParts = String(result.url).split('/');
      const filenameWithExt = urlParts[urlParts.length - 1] || '';
      const publicId = `portfolio/${filenameWithExt.split('.')[0]}`;

      setPortfolioItem((previousItem) => ({
        ...previousItem,
        imageUrl: result.url,
        imagePublicId: publicId,
        imageFile: file,
      }));
      setHasUnsavedChanges(true);

      if (previousImagePublicId && previousImagePublicId !== publicId) {
        await fetch('/api/upload', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publicId: previousImagePublicId }),
        }).catch(() => undefined);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload image');
    } finally {
      setImageUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteImage = async () => {
    if (!portfolioItem.imagePublicId) {
      return;
    }

    try {
      setImageUploading(true);
      setError('');

      await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicId: portfolioItem.imagePublicId }),
      });

      setPortfolioItem((previousItem) => ({
        ...previousItem,
        imageUrl: '',
        imagePublicId: '',
        imageFile: null,
      }));
      setHasUnsavedChanges(true);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid()) {
      setError('Please fill in all required fields and upload an image.');
      return;
    }

    setLoading(true);
    setSaveState('saving');
    setError('');

    try {
      const response = await fetch(`/api/admin/portfolio/${portfolioId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: portfolioItem.title,
          metaText: portfolioItem.metaText,
          imageUrl: portfolioItem.imageUrl,
          imagePublicId: portfolioItem.imagePublicId,
          isActive: portfolioItem.isActive,
        }),
      });

      await handleUnauthorizedResponse(response, router);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update portfolio item');
      }

      setHasUnsavedChanges(false);
      setSaveState('saved');
      await new Promise((resolve) => setTimeout(resolve, 1200));
      router.push('/admin/portfolio');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to update portfolio item');
      setSaveState('idle');
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  if (pageLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={handleBackClick}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Edit Portfolio Item</h1>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-900">Portfolio Details</h2>

          <div className="grid gap-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Main Heading *
              </label>
              <input
                type="text"
                required
                value={portfolioItem.title}
                onChange={(event) => handleChange('title', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-black outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500"
                placeholder="e.g., Modern Kitchen Renovation"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Meta Text *
              </label>
              <textarea
                required
                rows={4}
                value={portfolioItem.metaText}
                onChange={(event) => handleChange('metaText', event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-black outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-orange-500"
                placeholder="Short supporting text for the portfolio card"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-900">Portfolio Image</h2>

          {!portfolioItem.imageUrl ? (
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-orange-400">
              <input
                type="file"
                id="portfolio-image-upload"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleImageUpload}
                disabled={imageUploading}
                className="hidden"
              />
              <label
                htmlFor="portfolio-image-upload"
                className={`flex cursor-pointer flex-col items-center ${imageUploading ? 'pointer-events-none opacity-60' : ''}`}
              >
                {imageUploading ? (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500"></div>
                    </div>
                    <span className="font-medium text-orange-600">Uploading to Cloudinary...</span>
                    <span className="mt-2 text-sm text-slate-500">Please wait</span>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                    </div>
                    <span className="font-medium text-slate-700">Click to upload image</span>
                    <span className="mt-2 text-sm text-slate-500">JPG, PNG, GIF, WebP, SVG up to 5MB</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={portfolioItem.imageUrl}
                    alt="Portfolio preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {portfolioItem.imageFile?.name || 'Portfolio image'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {portfolioItem.imageFile
                      ? `${(portfolioItem.imageFile.size / 1024 / 1024).toFixed(2)} MB`
                      : 'Uploaded to Cloudinary'}
                  </p>
                </div>
                <input
                  type="file"
                  id="portfolio-image-replace-upload"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                  className="hidden"
                />
                <label
                  htmlFor="portfolio-image-replace-upload"
                  className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors ${
                    imageUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-slate-50'
                  }`}
                >
                  Replace
                </label>
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  disabled={imageUploading}
                  className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                  title="Delete image"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              id="portfolio-active"
              checked={portfolioItem.isActive}
              onChange={(event) => handleChange('isActive', event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="portfolio-active" className="text-sm font-medium text-slate-700">
              Portfolio item is active and visible
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || imageUploading || !isFormValid()}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-medium text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Update Portfolio Item'}
          </button>
        </div>
      </form>

      {showDiscardDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Discard Changes?</h3>
            <p className="mt-3 text-slate-600">
              You have unsaved changes. Are you sure you want to leave this page?
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 font-medium text-white transition-colors hover:bg-red-600"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/20 backdrop-blur-lg">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            {saveState === 'saved' ? (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Portfolio Updated</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Your portfolio changes have been saved successfully.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500"></div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900">Updating Portfolio</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Please wait while we save your changes.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditPortfolioPage;
