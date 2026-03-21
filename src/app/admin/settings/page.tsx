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

async function readJsonSafely(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  throw new Error(
    text.startsWith('<')
      ? 'The server returned an HTML page instead of JSON. Please restart the dev server and try again.'
      : text || 'Unexpected server response'
  );
}

const SettingsPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorStatus, setTwoFactorStatus] = useState({
    isSetup: false,
    enabled: false,
  });
  const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(true);
  const [isTogglingTwoFactor, setIsTogglingTwoFactor] = useState(false);
  const [pendingTwoFactorState, setPendingTwoFactorState] = useState<boolean | null>(null);
  const [showDisableTwoFactorModal, setShowDisableTwoFactorModal] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [isPreparingTwoFactor, setIsPreparingTwoFactor] = useState(false);
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    secret: string;
    otpauthUrl: string;
    qrCodeUrl: string;
  } | null>(null);
  const [twoFactorMessage, setTwoFactorMessage] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
  }>({
    type: 'idle',
    message: '',
  });
  useEffect(() => {
    let isMounted = true;

    const loadUserProfile = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        await handleUnauthorizedResponse(response, router);

        const result = await response.json();
        const authenticatedUser = result?.data?.user as User | undefined;

        if (!authenticatedUser) {
          throw new Error('User data missing');
        }

        localStorage.setItem('user', JSON.stringify(authenticatedUser));

        if (isMounted) {
          setUser(authenticatedUser);
          setLoading(false);
        }

        const twoFactorResponse = await fetch('/api/auth/2fa/status', {
          credentials: 'include',
        });
        await handleUnauthorizedResponse(twoFactorResponse, router);

        if (twoFactorResponse.ok) {
          const twoFactorResult = await twoFactorResponse.json();

          if (isMounted) {
            setTwoFactorStatus({
              isSetup: Boolean(twoFactorResult?.data?.isSetup),
              enabled: Boolean(twoFactorResult?.data?.enabled),
            });
          }
        }
      } catch (error) {
        console.error('Failed to load settings profile:', error);
        localStorage.removeItem('user');

        if (isMounted) {
          setUser(null);
          setLoading(false);
          router.replace('/login');
        }
      } finally {
        if (isMounted) {
          setIsTwoFactorLoading(false);
        }
      }
    };

    void loadUserProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const closeTwoFactorModal = () => {
    setShowTwoFactorModal(false);
    setTwoFactorSetup(null);
    setTwoFactorCode('');
    setTwoFactorMessage({
      type: 'idle',
      message: '',
    });
  };

  const handleSetupTwoFactor = async () => {
    setShowTwoFactorModal(true);
    setIsPreparingTwoFactor(true);
    setTwoFactorCode('');
    setTwoFactorMessage({
      type: 'idle',
      message: '',
    });

    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include',
      });
      await handleUnauthorizedResponse(response, router);
      const result = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(result?.message || 'Failed to start 2FA setup');
      }

      setTwoFactorSetup(result.data);
    } catch (error) {
      setTwoFactorMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to start 2FA setup',
      });
    } finally {
      setIsPreparingTwoFactor(false);
    }
  };

  const handleVerifyTwoFactor = async () => {
    if (!twoFactorCode.trim()) {
      setTwoFactorMessage({
        type: 'error',
        message: 'Enter the 6-digit code from your authenticator app.',
      });
      return;
    }

    setIsVerifyingTwoFactor(true);
    setTwoFactorMessage({
      type: 'idle',
      message: '',
    });

    try {
      const response = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: twoFactorCode }),
      });
      await handleUnauthorizedResponse(response, router);
      const result = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(result?.message || 'Failed to verify 2FA code');
      }

      setTwoFactorStatus({
        isSetup: true,
        enabled: true,
      });
      setTwoFactorMessage({
        type: 'success',
        message: result?.message || '2FA enabled successfully.',
      });

      setTimeout(() => {
        closeTwoFactorModal();
      }, 1200);
    } catch (error) {
      setTwoFactorMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to verify 2FA code',
      });
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  };

  const handleToggleTwoFactor = async () => {
    setPendingTwoFactorState(!twoFactorStatus.enabled);
    setShowDisableTwoFactorModal(true);
  };

  const updateTwoFactorState = async (enabled: boolean) => {
    setIsTogglingTwoFactor(true);

    try {
      const response = await fetch('/api/auth/2fa/toggle', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      await handleUnauthorizedResponse(response, router);
      const result = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(result?.message || 'Failed to update 2FA');
      }

      setTwoFactorStatus((prev) => ({
        ...prev,
        enabled,
      }));
    } catch (error) {
      setTwoFactorMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update 2FA',
      });
    } finally {
      setIsTogglingTwoFactor(false);
    }
  };

  const handleConfirmDisableTwoFactor = async () => {
    setShowDisableTwoFactorModal(false);
    await updateTwoFactorState(pendingTwoFactorState ?? false);
    setPendingTwoFactorState(null);
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

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-600">Manage your account settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900">Profile Information</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full cursor-not-allowed pointer-events-none px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <input
                  type="text"
                  value={user.role}
                  disabled
                  className="w-full cursor-not-allowed pointer-events-none px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Member Since</label>
                <input
                  type="text"
                  value={new Date(user.createdAt).toLocaleDateString()}
                  disabled
                  className="w-full cursor-not-allowed pointer-events-none px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Security Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">2FA</p>
                  <p className="text-sm text-slate-500">
                    {twoFactorStatus.isSetup
                      ? twoFactorStatus.enabled
                        ? 'Authenticator app protection is turned on'
                        : 'Authenticator app is setup but currently turned off'
                      : 'Secure your account with an authenticator app'}
                  </p>
                </div>
                {isTwoFactorLoading ? (
                  <div className="h-11 w-24 animate-pulse rounded-xl bg-slate-200"></div>
                ) : twoFactorStatus.isSetup ? (
                  <button
                    onClick={handleToggleTwoFactor}
                    disabled={isTogglingTwoFactor}
                    aria-label={twoFactorStatus.enabled ? 'Turn off 2FA' : 'Turn on 2FA'}
                    className={`relative inline-flex h-10 w-20 items-center rounded-full px-1 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 ${
                      twoFactorStatus.enabled
                        ? 'bg-green-500'
                        : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 ${
                        twoFactorStatus.enabled
                          ? 'left-2.5 text-white'
                          : 'right-2.5 text-slate-700'
                      }`}
                    >
                      {isTogglingTwoFactor ? '...' : twoFactorStatus.enabled ? 'On' : 'Off'}
                    </span>
                    <span
                      className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-md transition-all duration-200 ${
                        twoFactorStatus.enabled ? 'translate-x-10' : 'translate-x-0'
                      }`}
                    />
                  </button>
                ) : (
                  <button
                    onClick={handleSetupTwoFactor}
                    className="rounded-xl bg-slate-900 px-5 py-2.5 font-medium text-white transition-all duration-200 hover:bg-slate-800"
                  >
                    Setup
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          {/* System Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">System Information</h2>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Version</span>
                <span className="font-medium text-slate-900">v1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Login</span>
                <span className="font-medium text-slate-900">{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Browser</span>
                <span className="font-medium text-slate-900">{typeof window !== 'undefined' ? window.navigator.userAgent.split(' ')[0] : 'Unknown'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showTwoFactorModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Setup Authenticator App</h2>
              <p className="mt-2 text-sm text-slate-500">
                Scan the QR code with Google Authenticator or another authenticator app, then enter the 6-digit code to finish setup.
              </p>
            </div>

            {isPreparingTwoFactor ? (
              <div className="flex flex-col items-center justify-center py-14">
                <img
                  src="/images/logo.png"
                  alt="Magic Brush Ltd"
                  className="h-20 w-auto animate-pulse object-contain"
                />
                <p className="mt-4 text-sm text-slate-500">Preparing your authenticator setup...</p>
              </div>
            ) : twoFactorSetup ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
                  <img
                    src={twoFactorSetup.qrCodeUrl}
                    alt="Authenticator QR code"
                    className="h-52 w-52 rounded-2xl bg-white p-3 shadow-sm"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Manual setup key</p>
                    <p className="mt-2 break-all rounded-2xl bg-white px-4 py-3 font-mono text-sm text-slate-700">
                      {twoFactorSetup.secret}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>
            ) : null}

            {twoFactorMessage.message && (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
                  twoFactorMessage.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {twoFactorMessage.message}
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <button
                onClick={closeTwoFactorModal}
                disabled={isPreparingTwoFactor || isVerifyingTwoFactor}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyTwoFactor}
                disabled={!twoFactorSetup || isPreparingTwoFactor || isVerifyingTwoFactor}
                className="flex-1 rounded-2xl bg-orange-500 px-4 py-3 font-medium text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
              >
                {isVerifyingTwoFactor ? 'Verifying...' : 'Verify Setup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisableTwoFactorModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <i className="fas fa-shield-alt text-2xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {pendingTwoFactorState ? 'Turn On 2FA?' : 'Turn Off 2FA?'}
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                {pendingTwoFactorState
                  ? 'This will enable authenticator app protection for your account.'
                  : 'This will remove the extra authenticator app protection from your account.'}
              </p>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowDisableTwoFactorModal(false)}
                disabled={isTogglingTwoFactor}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                No
              </button>
              <button
                onClick={handleConfirmDisableTwoFactor}
                disabled={isTogglingTwoFactor}
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3 font-medium text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
