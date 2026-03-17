'use client';

import React, { useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormDataState = {
  email: string;
  password: string;
};

type FormErrors = Partial<Record<keyof FormDataState, string>>;

const LoginPage = () => {
  const [formData, setFormData] = useState<FormDataState>({
    email: '',
    password: ''
  });
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
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
    const validationErrors = validateForm(formData);
    
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setStatus('error');
      setErrorMessage('Please fix the highlighted fields');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    setFieldErrors({});

    try {
      const payload = {
        email: formData.email.trim(),
        password: formData.password,
      };

      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.errors && typeof data.errors === 'object') {
          const backendFieldErrors: FormErrors = {
            email: data.errors.email?.[0],
            password: data.errors.password?.[0],
          };
          setFieldErrors(backendFieldErrors);
        }
        throw new Error(data.message || data.error || 'Login failed');
      }

      // Store token and redirect to dashboard
      if (data.data?.token) {
        localStorage.setItem('access_token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        window.location.href = '/admin/dashboard';
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Column: Visual Content - Hidden on Mobile */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500 to-orange-600 items-center justify-center p-8">
        <div className="text-center text-white">
          <div className="mb-8">
            <div className="flex flex-col items-center mb-6">
              {/* Magic Brush Logo - Exact Frontend Style */}
              <div className="flex items-center space-x-3 group relative z-[70]">
                <img
                  src="/images/logo.png"
                  alt="Magic Brush Ltd"
                  className="transition-all duration-500 object-contain w-auto h-20"
                />
                <div className="flex flex-col leading-none">
                  <span className="font-black text-white tracking-tighter uppercase flex items-baseline transition-all text-2xl">
                    MAGIC <span className="text-orange-300 ml-1">BRUSH</span>{" "}
                    <span className="text-white ml-1">LTD</span>
                  </span>
                  <span className="font-black uppercase tracking-[0.3em] text-orange-100 mt-0.5 transition-all text-xs">
                    make your dream come true
                  </span>
                </div>
              </div>
            </div>
            <h2 className="text-4xl font-black mb-4">Welcome Back</h2>
            <p className="text-xl text-orange-100 max-w-md mx-auto">
              Manage your Magic Brush business with powerful tools and insights
            </p>
          </div>
          
          <div className="space-y-6 text-left max-w-md mx-auto">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i className="fas fa-chart-line text-2xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Real-time Analytics</h3>
                <p className="text-orange-100">Track inquiries and performance</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i className="fas fa-users text-2xl"></i>
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

      {/* Right Column: Login Form - Full Width on Mobile */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-8 bg-white min-h-screen lg:min-h-0">
        <div className="max-w-md w-full">
          {/* Mobile Logo - Only shown on mobile */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="flex items-center space-x-3 group relative z-[70] mb-4">
              <img
                src="/images/logo.png"
                alt="Magic Brush Ltd"
                className="transition-all duration-500 object-contain w-auto h-16"
              />
              <div className="flex flex-col leading-none">
                <span className="font-black text-slate-900 tracking-tighter uppercase flex items-baseline transition-all text-xl">
                  MAGIC <span className="text-orange-500 ml-1">BRUSH</span>{" "}
                  <span className="text-slate-900 ml-1">LTD</span>
                </span>
                <span className="font-black uppercase tracking-[0.3em] text-slate-400 mt-0.5 transition-all text-xs">
                  make your dream come true
                </span>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 shadow-2xl border border-slate-100">
            <p className="text-center text-slate-600 mb-6">Sign in to manage your business</p>
            
            {status === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✓</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Login Successful!</h2>
                <p className="text-slate-600">Redirecting to dashboard...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide ml-1">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                    placeholder="admin@magicbrushltd.co.uk"
                  />
                  {fieldErrors.email ? <p className="text-red-600 text-xs ml-1">{fieldErrors.email}</p> : null}
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wide ml-1">Password</label>
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 pr-12 py-4 outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all font-medium"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center"
                    >
                      <span className="text-slate-400 hover:text-slate-600">
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </span>
                    </button>
                  </div>
                  {fieldErrors.password ? <p className="text-red-600 text-xs ml-1">{fieldErrors.password}</p> : null}
                </div>

                {/* Error Message */}
                {status === 'error' && errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center space-x-3">
                    <span className="text-red-600 text-xl">⚠️</span>
                    <p className="text-red-700 text-sm font-medium">{errorMessage}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  disabled={status === 'submitting'}
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-lg py-4 rounded-2xl transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center space-x-3 transform active:scale-95"
                >
                  {status === 'submitting' ? (
                    <span className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span>→</span>
                    </>
                  )}
                </button>

                {/* Footer */}
                <div className="text-center pt-4 border-t border-slate-100">
                  <p className="text-slate-500 text-sm">
                    Magic Brush Ltd • Admin Portal
                  </p>
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
