'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  beforeImage: string;
  afterImage: string;
}

const mockPortfolio: PortfolioItem[] = [
  {
    id: '1',
    title: 'Modern Kitchen Renovation',
    category: 'Kitchen',
    image: '/portfolio_kitchen.png',
    description: 'Complete kitchen makeover with modern appliances and custom cabinets',
    beforeImage: '/portfolio_before_kitchen.png',
    afterImage: '/portfolio_after_kitchen.png',
  },
  {
    id: '2',
    title: 'Bathroom Transformation',
    category: 'Bathroom',
    image: '/portfolio_bathroom.png',
    description: 'Luxury bathroom renovation with premium fixtures and tiling',
    beforeImage: '/portfolio_before_bathroom.png',
    afterImage: '/portfolio_after_bathroom.png',
  },
  {
    id: '3',
    title: 'Living Room Makeover',
    category: 'Living Room',
    image: '/portfolio_living.png',
    description: 'Contemporary living room design with smart lighting solutions',
    beforeImage: '/portfolio_before_living.png',
    afterImage: '/portfolio_after_living.png',
  },
];

const PortfolioPage = () => {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
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

        if (isMounted) {
          setPortfolio(mockPortfolio);
          setErrorMessage('');
        }
      } catch (error) {
        console.error('Failed to load portfolio page:', error);

        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load portfolio right now.'
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Portfolio Management</h1>
          <p className="text-slate-600">Showcase your best work and transformations</p>
        </div>
        <button className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200">
          <i className="fas fa-plus mr-2"></i>
          Add Portfolio Item
        </button>
      </div>

      {errorMessage ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {portfolio.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200"
          >
            <div className="h-64 bg-gradient-to-br from-slate-100 to-slate-200 relative">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(event) => {
                  event.currentTarget.src = `https://picsum.photos/seed/${item.id}/400/300.jpg`;
                }}
              />
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-orange-500 text-white text-xs font-medium rounded-full">
                  {item.category}
                </span>
              </div>
            </div>

            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">{item.title}</h3>
              <p className="text-slate-600 text-sm mb-4 line-clamp-2">{item.description}</p>

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
          <div className="h-64 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-plus text-2xl text-orange-500"></i>
              </div>
              <p className="text-slate-600 font-medium">Add Portfolio Item</p>
            </div>
          </div>
        </div>
      </div>

      {portfolio.length === 0 && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-orange-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-images text-3xl text-orange-500"></i>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Portfolio Items Yet</h3>
          <p className="text-slate-600 max-w-md mx-auto">
            Start by adding your completed projects to showcase your expertise to potential clients.
          </p>
          <button className="mt-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200">
            <i className="fas fa-plus mr-2"></i>
            Add Your First Project
          </button>
        </div>
      )}
    </div>
  );
};

export default PortfolioPage;
