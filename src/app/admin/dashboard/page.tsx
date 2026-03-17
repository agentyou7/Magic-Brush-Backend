'use client';

import React, { useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Inquiry {
  id: string;
  name: string;
  phone: string;
  service: string;
  message: string;
  status: string;
  createdAt: string;
}

const DashboardPage = () => {
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalInquiries: 0,
    newInquiries: 0,
    totalUsers: 0,
    activeUsers: 0,
  });
  const [recentInquiries, setRecentInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication using cookies
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const token = getCookie('access_token');
    const userData = localStorage.getItem('user');
    
    if (!token || !userData) {
      window.location.href = '/login';
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      fetchDashboardData(token);
    } catch (error) {
      // Clear invalid data and redirect
      document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }, []);

  const fetchDashboardData = async (token: string) => {
    try {
      // Fetch inquiries
      const inquiriesResponse = await fetch('/api/admin/inquiries', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (inquiriesResponse.ok) {
        const inquiriesData = await inquiriesResponse.json();
        const inquiries = inquiriesData.data.inquiries;
        
        setRecentInquiries(inquiries.slice(0, 5));
        setStats(prev => ({
          ...prev,
          totalInquiries: inquiries.length,
          newInquiries: inquiries.filter((i: Inquiry) => i.status === 'new').length,
        }));
      }

      // Fetch users
      const usersResponse = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        const users = usersData.data.users;
        
        setStats(prev => ({
          ...prev,
          totalUsers: users.length,
          activeUsers: users.filter((u: User) => u.isActive).length,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear cookie and localStorage
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-500/20">
            <span className="text-white text-2xl font-bold">MB</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <span className="text-white font-bold">MB</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-slate-600 text-sm">Magic Brush Ltd</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{user?.email?.split('@')[0]}</p>
                <p className="text-xs text-slate-600 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
              >
                <span className="text-xl">🚪</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome back, {user?.email?.split('@')[0]}!</h2>
          <p className="text-slate-600">Here's what's happening with your business today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📨</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.totalInquiries}</span>
            </div>
            <h3 className="text-slate-900 font-semibold">Total Inquiries</h3>
            <p className="text-slate-600 text-sm">All time submissions</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📈</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.newInquiries}</span>
            </div>
            <h3 className="text-slate-900 font-semibold">New Inquiries</h3>
            <p className="text-slate-600 text-sm">Awaiting response</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.totalUsers}</span>
            </div>
            <h3 className="text-slate-900 font-semibold">Total Users</h3>
            <p className="text-slate-600 text-sm">Registered accounts</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <span className="text-2xl font-bold text-slate-900">{stats.activeUsers}</span>
            </div>
            <h3 className="text-slate-900 font-semibold">Active Users</h3>
            <p className="text-slate-600 text-sm">Currently active</p>
          </div>
        </div>

        {/* Recent Inquiries */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Recent Inquiries</h3>
            
            {recentInquiries.length > 0 ? (
              <div className="space-y-4">
                {recentInquiries.map((inquiry) => (
                  <div key={inquiry.id} className="border border-slate-100 rounded-2xl p-4 hover:bg-slate-50 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h4 className="font-semibold text-slate-900">{inquiry.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            inquiry.status === 'new' ? 'bg-green-100 text-green-700' :
                            inquiry.status === 'called' ? 'bg-blue-100 text-blue-700' :
                            inquiry.status === 'quoted' ? 'bg-yellow-100 text-yellow-700' :
                            inquiry.status === 'won' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {inquiry.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-6 text-sm text-slate-600">
                          <div className="flex items-center space-x-1">
                            <span>📞</span>
                            <span>{inquiry.phone}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>📧</span>
                            <span>{inquiry.service}</span>
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm mt-2 line-clamp-2">{inquiry.message}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {new Date(inquiry.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <span className="text-4xl">📨</span>
                <p className="text-slate-600 mt-4">No inquiries yet</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
