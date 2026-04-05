'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, X, Image as ImageIcon, Search, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { handleUnauthorizedResponse } from '@/lib/client-auth';

interface Feature {
  iconName: string;
  heading: string;
  description: string;
}

interface NewService {
  title: string;
  shortHeading: string;
  description: string;
  fullDetails: string;
  iconName: string;
  imageUrl: string;
  imagePublicId: string;
  imageFile: File | null;
  features: Feature[];
  isActive: boolean;
}

const NewServicePage = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [service, setService] = useState<NewService>({
    title: '',
    shortHeading: '',
    description: '',
    fullDetails: '',
    iconName: 'Home',
    imageUrl: '',
    imagePublicId: '',
    imageFile: null,
    features: [
      { iconName: 'Star', heading: '', description: '' },
      { iconName: 'ShieldCheck', heading: '', description: '' }
    ],
    isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [imageUploading, setImageUploading] = useState(false);
  const [error, setError] = useState('');
  const [iconSearch, setIconSearch] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [featureIconSearch, setFeatureIconSearch] = useState('');
  const [showFeatureIconPicker, setShowFeatureIconPicker] = useState<number | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Handle page reload/exit with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        const message = 'You have unsaved changes. Are you sure you want to leave?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const renderIcon = (iconName: string) => {
    const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons];
    if (IconComponent) {
      return React.createElement(IconComponent as React.ComponentType<any>, { className: "w-5 h-5 text-slate-600" });
    }
    return React.createElement(LucideIcons.Home as React.ComponentType<any>, { className: "w-5 h-5 text-slate-600" });
  };

  const countWords = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const steps = [
    { id: 1, name: 'Basic Info', description: 'Service details' },
    { id: 2, name: 'Features', description: 'Key features' },
    { id: 3, name: 'Media & Status', description: 'Image and status' }
  ];

  const isStep1Valid = () => {
    const titleValid = service.title.trim() !== '';
    const shortHeadingValid = service.shortHeading.trim() !== '';
    const descriptionValid = service.description.trim() !== '';
    const fullDetailsValid = service.fullDetails.trim() !== '';

    return titleValid && shortHeadingValid && descriptionValid && fullDetailsValid;
  };

  const isStep2Valid = () => {
    const valid = service.features.every((feature, index) => {
      const headingValid = feature.heading.trim() !== '';
      const descriptionValid = feature.description.trim() !== '';
      const wordCount = countWords(feature.description);
      const wordCountValid = wordCount >= 5 && wordCount <= 12;

      return headingValid && descriptionValid && wordCountValid;
    });

    return valid;
  };

  const isStep3Valid = () => {
    return service.imageUrl !== '';
  };

  const canGoToNext = () => {
    switch(currentStep) {
      case 1: return isStep1Valid();
      case 2: return isStep2Valid();
      case 3: return isStep3Valid();
      default: return false;
    }
  };

  const debugFormValidation = () => {
    const step1Valid = isStep1Valid();
    const step2Valid = isStep2Valid();
    const step3Valid = isStep3Valid();

    return {
      step1Valid,
      step2Valid,
      step3Valid,
      canGoToNext: canGoToNext()
    };
  };

  const handleNext = () => {
    if (canGoToNext() && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      router.push('/admin/services');
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardDialog(false);
    setHasUnsavedChanges(false);
    router.push('/admin/services');
  };

  const addFeature = () => {
    if (service.features.length >= 3) return; // Max 3 features
    
    const newFeature: Feature = {
      iconName: 'Star',
      heading: '',
      description: ''
    };
    setService(prev => ({ ...prev, features: [...prev.features, newFeature] }));
  };

  const removeFeature = (index: number) => {
    if (service.features.length <= 2) return; // Cannot remove below 2 features
    setService(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  // Get all Lucide icons - simplified approach
  const iconList = [
    'Home', 'Paintbrush', 'Grid', 'Layers', 'Maximize', 'Star', 'ShieldCheck', 'Clock',
    'Award', 'TrendingUp', 'ChevronRight', 'ArrowLeft', 'Search', 'Filter', 'X', 'Phone',
    'Mail', 'Calendar', 'User', 'Settings', 'Heart', 'ShoppingCart', 'Truck', 'Package',
    'Wrench', 'Hammer', 'Drill', 'Saw', 'PaintBucket', 'Brush', 'Ruler', 'Clipboard',
    'FileText', 'Image', 'Camera', 'Video', 'Music', 'Volume2', 'Wifi', 'Battery',
    'Map', 'Navigation', 'Compass', 'Globe', 'Cloud', 'Sun', 'Moon', 'Zap',
    'Fire', 'Droplet', 'Wind', 'Snowflake', 'Thermometer', 'Eye', 'EyeOff'
  ];

  const filteredIcons = iconList.filter(iconName =>
    iconName.toLowerCase().includes(iconSearch.toLowerCase())
  );

  const filteredFeatureIcons = iconList.filter(iconName =>
    iconName.toLowerCase().includes(featureIconSearch.toLowerCase())
  );

  // Close icon picker when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.icon-picker-container')) {
        setShowIconPicker(false);
        setShowFeatureIconPicker(null);
      }
    };

    if (showIconPicker || showFeatureIconPicker !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIconPicker, showFeatureIconPicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let savedSuccessfully = false;
    
    // Debug validation before saving
    const validation = debugFormValidation();
    
    if (!validation.canGoToNext) {
      console.error('❌ Form validation failed - cannot save');
      setError('Please complete all required fields before saving');
      return;
    }
    
    setLoading(true);
    setSaveState('saving');
    setError('');

    try {
      // Prepare the service data
      const serviceId = `${service.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}-${Date.now()}`;

      const serviceData = {
        id: serviceId,
        title: service.title,
        shortHeading: service.shortHeading,
        description: service.description,
        fullDetails: service.fullDetails,
        iconName: service.iconName,
        imageUrl: service.imageUrl,
        imagePublicId: service.imagePublicId,
        features: service.features,
        isActive: service.isActive
      };

      // Save to Firebase via API
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch('/api/admin/services', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serviceData),
          signal: controller.signal,
        });
        await handleUnauthorizedResponse(response);

        clearTimeout(timeoutId);

        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error('💥 Failed to parse JSON response:', parseError);
          setError('Invalid response from server');
          return;
        }

        if (result.success) {
          // Reset unsaved changes flag
          setHasUnsavedChanges(false);
          setSaveState('saved');
          savedSuccessfully = true;

          // Small delay to show success
          await new Promise(resolve => setTimeout(resolve, 1400));

          router.push('/admin/services');
        } else {
          console.error('❌ API returned error:', result.error);
          setError(result.error || 'Failed to save service');
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('💥 Request timeout - Firebase rules likely blocking write');
          setError('Save timeout: Please check Firebase security rules and try again');
        } else {
          console.error('💥 Network/Fetch error:', fetchError);
          setError('Network error: Failed to connect to server');
        }
      }
    } catch (err) {
      console.error('💥 Frontend save error:', err);
      console.error('💥 Error details:', {
        message: (err as Error).message,
        stack: (err as Error).stack,
        name: (err as Error).name
      });
      setError('Failed to save service: ' + (err as Error).message);
    } finally {
      setLoading(false);
      if (!savedSuccessfully) {
        setSaveState('idle');
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a valid image file (JPG, PNG, GIF, WebP, or SVG)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      try {
        setImageUploading(true);
        setError('');
        
        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        
        // Upload to Cloudinary
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.success) {
          // Extract public ID from URL for deletion
          // Cloudinary URL format: https://cloudinary.com/.../portfolio/filename
          const urlParts = result.url.split('/');
          const filenameWithExt = urlParts[urlParts.length - 1];
          const publicId = `portfolio/${filenameWithExt.split('.')[0]}`;
          
          setService(prev => ({ 
            ...prev, 
            imageUrl: result.url,
            imagePublicId: publicId,
            imageFile: file 
          }));
          setHasUnsavedChanges(true);
        } else {
          setError(result.error || 'Failed to upload image');
        }
      } catch (error) {
        console.error('Upload error:', error);
        setError('Failed to upload image');
      } finally {
        setImageUploading(false);
      }
    }
  };

  const handleDeleteImage = async () => {
    if (!service.imagePublicId) return;
    
    try {
      setImageUploading(true);
      
      // Delete from Cloudinary
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publicId: service.imagePublicId }),
      });
      
      // Reset state
      setService(prev => ({ 
        ...prev, 
        imageUrl: '',
        imagePublicId: '',
        imageFile: null 
      }));
      setHasUnsavedChanges(true);
      
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleIconSelect = (iconName: string) => {
    setService(prev => ({ ...prev, iconName }));
    setShowIconPicker(false);
    setIconSearch('');
    setHasUnsavedChanges(true);
  };

  const handleFeatureIconSelect = (index: number, iconName: string) => {
    const newFeatures = [...service.features];
    newFeatures[index].iconName = iconName;
    setService(prev => ({ ...prev, features: newFeatures }));
    setShowFeatureIconPicker(null);
    setFeatureIconSearch('');
    setHasUnsavedChanges(true);
  };

  const handleChange = (field: keyof NewService, value: string | boolean) => {
    setService(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    setService(prev => ({
      ...prev,
      features: prev.features.map((feature, i) => 
        i === index ? { ...feature, [field]: value } : feature
      )
    }));
    setHasUnsavedChanges(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-slate-900">Add New Service</h1>
      </div>

      {/* Progress Stepper */}
      <div className="mb-12 flex justify-center">
        <div className="flex items-center justify-between w-full max-w-xl">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                  currentStep >= step.id 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="mt-2 text-center">
                  <p className={`font-medium text-sm ${
                    currentStep >= step.id ? 'text-slate-900' : 'text-slate-500'
                  }`}>
                    {step.name}
                  </p>
                  <p className="text-xs text-slate-500">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 transition-all ${
                  currentStep > step.id ? 'bg-orange-500' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        {currentStep === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Title (Main Heading) *
                </label>
                <input
                  type="text"
                  required
                  value={service.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                  placeholder="e.g., House Renovation"
                />
                <p className="mt-1 text-xs text-slate-500">This will be the main heading on the service page</p>
              </div>

              <div className="relative icon-picker-container">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Icon *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black bg-white flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {renderIcon(service.iconName)}
                      <span className="text-slate-900">{service.iconName}</span>
                    </div>
                    <Search className="w-4 h-4 text-slate-400" />
                  </button>

                  {showIconPicker && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-hidden">
                      <div className="p-3 border-b border-slate-200">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={iconSearch}
                            onChange={(e) => setIconSearch(e.target.value)}
                            placeholder="Search icons..."
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto p-3">
                        <div className="grid grid-cols-6 gap-4">
                          {filteredIcons.filter(iconName => iconName !== service.iconName).map((iconName) => {
                            const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons];
                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => {
                                  setService(prev => ({ ...prev, iconName }));
                                  setShowIconPicker(false);
                                  setIconSearch('');
                                  setHasUnsavedChanges(true);
                                }}
                                className="p-2 rounded-lg transition-all hover:bg-orange-50"
                                title={iconName}
                              >
                                {IconComponent ? 
                                  React.createElement(IconComponent as React.ComponentType<any>, { className: "w-5 h-5 text-slate-700" }) :
                                  React.createElement(LucideIcons.Home as React.ComponentType<any>, { className: "w-5 h-5 text-slate-700" })
                                }
                              </button>
                            );
                          })}
                        </div>
                        {filteredIcons.length === 0 && (
                          <div className="text-center py-8 text-slate-500 text-sm">
                            No icons found for "{iconSearch}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">Click to search and select an icon from the library</p>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Short Description (Meta Text) *
              </label>
              <input
                type="text"
                required
                value={service.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                placeholder="Brief description shown after main heading"
              />
              <p className="mt-1 text-xs text-slate-500">This text appears right after the main heading on the service page</p>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Paragraph Heading *
              </label>
              <input
                type="text"
                required
                value={service.shortHeading}
                onChange={(e) => handleChange('shortHeading', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                placeholder="Heading for detailed content section"
              />
              <p className="mt-1 text-xs text-slate-500">This appears as a heading before the detailed content paragraphs</p>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Details *
              </label>
              <textarea
                required
                rows={4}
                value={service.fullDetails}
                onChange={(e) => handleChange('fullDetails', e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                placeholder="Detailed description for service page"
              />
            </div>
          </div>
        )}

        {/* Step 2: Features */}
        {currentStep === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Features</h2>
                <p className="text-sm text-slate-600 mt-1">2 required features + 1 optional feature</p>
              </div>
              {service.features.length < 3 && (
                <button
                  type="button"
                  onClick={addFeature}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <i className="fas fa-plus"></i>
                  Add Optional Feature
                </button>
              )}
            </div>
            
            <div className="space-y-6">
              {service.features.map((feature, index) => (
                <div key={index} className="border border-slate-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {index < 2 ? `Required Feature ${index + 1}` : `Optional Feature ${index - 1}`}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {index < 2 ? 'This feature is required' : 'This is an optional feature'}
                      </p>
                    </div>
                    {index >= 2 && (
                      <button
                        type="button"
                        onClick={() => removeFeature(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title="Remove optional feature"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative icon-picker-container">
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Icon *
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowFeatureIconPicker(showFeatureIconPicker === index ? null : index)}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black bg-white flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            {renderIcon(feature.iconName)}
                            <span className="text-slate-900">{feature.iconName}</span>
                          </div>
                          <Search className="w-4 h-4 text-slate-400" />
                        </button>

                        {showFeatureIconPicker === index && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-64 overflow-hidden">
                            <div className="p-3 border-b border-slate-200">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                  type="text"
                                  value={featureIconSearch}
                                  onChange={(e) => setFeatureIconSearch(e.target.value)}
                                  placeholder="Search icons..."
                                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                                />
                              </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto p-3">
                              <div className="grid grid-cols-6 gap-4">
                                {filteredFeatureIcons.filter(iconName => iconName !== feature.iconName).map((iconName) => {
                                  const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons];
                                  return (
                                    <button
                                      key={iconName}
                                      type="button"
                                      onClick={() => {
                                        updateFeature(index, 'iconName', iconName);
                                        setShowFeatureIconPicker(null);
                                        setFeatureIconSearch('');
                                        setHasUnsavedChanges(true);
                                      }}
                                      className="p-2 rounded-lg transition-all hover:bg-orange-50"
                                      title={iconName}
                                    >
                                      {IconComponent ? 
                                        React.createElement(IconComponent as React.ComponentType<any>, { className: "w-5 h-5 text-slate-700" }) :
                                        React.createElement(LucideIcons.Home as React.ComponentType<any>, { className: "w-5 h-5 text-slate-700" })
                                      }
                                    </button>
                                  );
                                })}
                              </div>
                              {filteredFeatureIcons.length === 0 && (
                                <div className="text-center py-8 text-slate-500 text-sm">
                                  No icons found for "{featureIconSearch}"
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Feature Heading *
                      </label>
                      <input
                        type="text"
                        required
                        value={feature.heading}
                        onChange={(e) => {
                          updateFeature(index, 'heading', e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                        placeholder="e.g., Expert Installation"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Description (5-12 words) *
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={feature.description}
                        onChange={(e) => {
                          updateFeature(index, 'description', e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-black"
                        placeholder="Brief description in 5-12 words"
                      />
                      <div className="mt-1 text-xs">
                        <span className={`${countWords(feature.description) >= 5 && countWords(feature.description) <= 12 ? 'text-green-600' : 'text-red-600'}`}>
                          {countWords(feature.description)} words
                        </span>
                        <span className="text-slate-500 ml-2">(5-12 words required)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-600">
                  {service.features.length} features ({service.features.length >= 2 ? '✓' : '✗'})
                </span>
                {service.features.length < 2 && (
                  <span className="text-sm text-red-600 font-medium">
                    Please fill in all required features
                  </span>
                )}
                {service.features.length === 2 && (
                  <span className="text-sm text-green-600 font-medium">
                    All required features added ✓
                  </span>
                )}
                {service.features.length === 3 && (
                  <span className="text-sm text-green-600 font-medium">
                    Optional feature added ✓
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Media & Status */}
        {currentStep === 3 && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Service Image</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Upload Image * (JPG, PNG, GIF, WebP, SVG - Max 5MB)
                </label>
                
                {!service.imageUrl ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-orange-400 transition-colors">
                    <input
                      type="file"
                      id="image-upload"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={handleImageUpload}
                      disabled={imageUploading}
                      className="hidden"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`cursor-pointer flex flex-col items-center ${imageUploading ? 'pointer-events-none opacity-50' : ''}`}
                    >
                      {imageUploading ? (
                        <>
                          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                          </div>
                          <span className="text-orange-600 font-medium mb-2">Uploading to Cloudinary...</span>
                          <span className="text-slate-500 text-sm">Please wait</span>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                          </div>
                          <span className="text-slate-700 font-medium mb-2">Click to upload image</span>
                          <span className="text-slate-500 text-sm">or drag and drop</span>
                          <span className="text-slate-400 text-xs mt-2">JPG, PNG, GIF, WebP, SVG (MAX. 5MB)</span>
                        </>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                        {imageUploading ? (
                          <div className="w-full h-full bg-orange-100 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                          </div>
                        ) : (
                          <img
                            src={service.imageUrl}
                            alt="Service image preview"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {service.imageFile?.name || 'Service image'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {service.imageFile ? 
                            `${(service.imageFile.size / 1024 / 1024).toFixed(2)} MB • ${service.imageFile.type}` :
                            'Uploaded to Cloudinary'
                          }
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        disabled={imageUploading}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete image"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
                
                <p className="mt-2 text-sm text-slate-500">
                  Upload a high-quality image for your service. Images are stored in your Cloudinary portfolio folder.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Service Status</h2>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={service.isActive}
                  onChange={(e) => handleChange('isActive', e.target.checked)}
                  className="w-5 h-5 text-orange-500 border-slate-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Service is active and visible to customers
                </label>
              </div>
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-8">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium transition-all duration-200 hover:bg-slate-50"
              >
                Back
              </button>
            )}
          </div>
          <div>
            {currentStep < 3 && (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoToNext()}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !canGoToNext()}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Service'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Discard Changes Dialog */}
      {showDiscardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl transform transition-all">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Discard Changes?</h3>
            <p className="text-slate-600 mb-6">
              You have unsaved changes. Are you sure you want to discard them and leave this page?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium transition-all duration-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDiscardChanges}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-all duration-200"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl transform transition-all text-center">
            {saveState === 'saved' ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Resources Saved</h3>
                <p className="text-slate-600 text-sm">
                  Your resources have been saved successfully.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Saving Resources</h3>
                <p className="text-slate-600 text-sm">
                  Wait, we are saving your resources.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewServicePage;
