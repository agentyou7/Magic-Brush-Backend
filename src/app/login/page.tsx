'use client';

import React, { useState } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormDataState = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormDataState, string>>;

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

const LoginPage = () => {
  const [formData, setFormData] = useState<FormDataState>({
    email: '',
    password: '',
  });
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [loginStep, setLoginStep] = useState<'credentials' | 'twoFactor'>('credentials');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactorCode, setShowTwoFactorCode] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleFieldChange = (field: keyof FormDataState, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = (data: FormDataState): FormErrors => {
    const errors: FormErrors = {};
    const email = data.email.trim();
    const password = data.password;

    if (!email) {
      errors.email = 'Email is required';
    } else if (!EMAIL_REGEX.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent multiple submissions
    if (status === 'submitting') {
      return;
    }
    
    setStatus('submitting');
    setErrorMessage('');
    setFieldErrors({});

    const errors = validateForm(formData);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus('error');
      return;
    }

    try {
      console.log('🚀 Submitting login form...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📥 Response data:', result);

      if (result.success) {
        console.log('✅ Login successful!');
        setStatus('success');
        
        // Store user data in localStorage
        if (result.data?.user) {
          localStorage.setItem('user', JSON.stringify(result.data.user));
          console.log('💾 User data saved to localStorage');
        }

        // If Firebase custom token is provided, you can use it for client-side Firebase auth
        if (result.data?.customToken) {
          console.log('🔥 Firebase custom token received for client-side auth');
        }

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          console.log('🔄 Redirecting to dashboard...');
          window.location.href = '/admin/dashboard';
        }, 1200);
      } else {
        console.error('❌ Login failed:', result.message);
        setStatus('error');
        if (result.errors) {
          setFieldErrors(result.errors);
        } else {
          setErrorMessage(result.message || 'Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('💥 Network error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Login failed. Please try again.');
    }
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const formEvent = new Event('submit', { cancelable: true }) as any;
    formEvent.preventDefault = () => {};
    handleSubmit(formEvent);
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMessage('');

    if (!twoFactorCode.trim()) {
      setStatus('error');
      setErrorMessage('Enter your 2FA code.');
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-2fa-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          challengeToken,
          code: twoFactorCode,
        }),
      });

      const result = await readJsonSafely(response);

      if (!response.ok || !result.success) {
        throw new Error(result?.message || 'Wrong 2FA code. Please try again.');
      }

      if (result.data?.user) {
        localStorage.setItem('user', JSON.stringify(result.data.user));
      }

      setStatus('success');
      setTimeout(() => {
        window.location.href = '/admin/dashboard';
      }, 1200);
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Wrong 2FA code. Please try again.');
    }
  };

  const handleBackToLogin = () => {
    setLoginStep('credentials');
    setChallengeToken('');
    setTwoFactorCode('');
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500 to-orange-600 items-center justify-center p-8">
        <div className="text-center text-white">
          <div className="flex items-center space-x-3 group relative z-[70] mb-8">
            <img
              src="/images/logo.png"
              alt="Magic Brush Ltd"
              className="transition-all duration-500 object-contain w-auto h-20"
            />
            <div className="flex flex-col leading-none">
              <span className="font-black text-white tracking-tighter uppercase flex items-baseline transition-all text-2xl">
                MAGIC <span className="text-orange-300 ml-1">BRUSH</span>{' '}
                <span className="text-white ml-1">LTD</span>
              </span>
              <span className="font-black uppercase tracking-[0.3em] text-orange-100 mt-0.5 transition-all text-xs">
                make your dream come true
              </span>
            </div>
          </div>

          <div className="space-y-6 text-left max-w-md mx-auto">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i className="fas fa-chart-line text-2xl text-white"></i>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Real-time Analytics</h3>
                <p className="text-orange-100">Track inquiries and performance</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i className="fas fa-users text-2xl text-white"></i>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Customer Management</h3>
                <p className="text-orange-100">Manage leads and communications</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Fast & Secure</h3>
                <p className="text-orange-100">Enterprise-grade security</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-white min-h-screen lg:min-h-0">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-2xl border border-slate-100">
            <div className="flex flex-col items-center mb-6">
              <div className="flex items-center space-x-3 group relative z-[70] mb-4">
                <img
                  src="/images/logo.png"
                  alt="Magic Brush Ltd"
                  className="transition-all duration-500 object-contain w-auto h-16"
                />
                <div className="flex flex-col leading-none">
                  <span className="font-black text-slate-900 tracking-tighter uppercase flex items-baseline transition-all text-xl">
                    MAGIC <span className="text-orange-500 ml-1">BRUSH</span>{' '}
                    <span className="text-slate-900 ml-1">LTD</span>
                  </span>
                  <span className="font-black uppercase tracking-[0.3em] text-slate-400 mt-0.5 transition-all text-xs">
                    make your dream come true
                  </span>
                </div>
              </div>
            </div>

            <p className="text-center text-slate-600 mb-6">Sign in to manage your business</p>

            {status === 'success' ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Login Successful!</h2>
                <p className="text-slate-600">Redirecting to dashboard...</p>
              </div>
            ) : status === 'submitting' ? (
              <div className="flex flex-col items-center justify-center py-16 backdrop-blur-sm bg-white/30 border border-white/20 rounded-2xl">
                <img
                  src="/images/logo.png"
                  alt="Magic Brush Ltd"
                  className="mb-4 h-20 w-auto animate-pulse object-contain"
                />
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {loginStep === 'twoFactor' ? 'Verifying 2FA...' : 'Signing In...'}
                </h2>
                <p className="text-slate-600">
                  {loginStep === 'twoFactor'
                    ? 'Please wait while we verify your authenticator code'
                    : 'Please wait while we authenticate you'}
                </p>
              </div>
            ) : loginStep === 'twoFactor' ? (
              <form onSubmit={handleTwoFactorSubmit} className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-slate-900">Enter 2FA Code</h2>
                  <p className="mt-2 text-slate-600">
                    Enter the 6-digit code from your authenticator app to continue.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide ml-1">Authenticator Code</label>
                  <div className="relative">
                    <input
                      required
                      type={showTwoFactorCode ? 'text' : 'password'}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 pr-20 py-4 outline-none text-slate-900 placeholder:text-slate-300 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                      placeholder="Enter 6-digit code"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTwoFactorCode((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-sm font-semibold text-slate-500 hover:text-slate-700"
                    >
                      {showTwoFactorCode ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {status === 'error' && errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center space-x-3">
                    <span className="text-red-600 text-xl">⚠</span>
                    <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="flex-1 border border-slate-300 text-slate-700 font-bold py-4 rounded-2xl transition-all hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/20"
                  >
                    Verify Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none text-slate-900 placeholder:text-slate-300 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                    placeholder="admin@magicbrushltd.co.uk"
                  />
                  {fieldErrors.email ? <p className="text-red-600 text-xs ml-1">{fieldErrors.email}</p> : null}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide ml-1">Password</label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 pr-12 py-4 outline-none text-slate-900 placeholder:text-slate-300 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      <span className="text-slate-400 hover:text-slate-600">
                        {showPassword ? 'Show' : 'Hide'}
                      </span>
                    </button>
                  </div>
                  {fieldErrors.password ? <p className="text-red-600 text-xs ml-1">{fieldErrors.password}</p> : null}
                </div>

                {status === 'error' && errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center space-x-3">
                    <span className="text-red-600 text-xl">⚠</span>
                    <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                  </div>
                )}

                <button
                  type="submit"
                  onClick={handleButtonClick}
                  disabled={status === 'submitting'}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-lg py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center space-x-3 transform active:scale-95"
                >
                  <>
                    <span>Sign In</span>
                    <span>→</span>
                  </>
                </button>

                <div className="text-center pt-4 border-t border-slate-100">
                  <p className="text-slate-500 text-sm">Magic Brush Ltd • Admin Portal</p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
