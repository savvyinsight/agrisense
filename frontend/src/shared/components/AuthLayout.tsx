import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-surface-base">
      {/* Hero Section - Desktop Only */}
      <div className="hidden md:flex flex-col justify-center items-center p-12 bg-gradient-to-br from-[#1a3d1a] via-[#152a15] to-[#0f1117] relative overflow-hidden">
        {/* Decorative animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-accent/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center max-w-md">
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent-hover rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
            {title || 'AgriSense'}
          </h2>
          
          <p className="text-lg text-green-200 mb-8 leading-relaxed">
            {subtitle || 'Real-time monitoring and intelligent automation for modern agriculture'}
          </p>

          {/* Features list */}
          <div className="space-y-4 text-left">
            {[
              { icon: '📊', text: 'Real-time Data & Analytics' },
              { icon: '🤖', text: 'Smart Automation Rules' },
              { icon: '🌾', text: 'Field & Zone Management' },
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-green-100">
                <span className="text-xl">{feature.icon}</span>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-accent-hover to-accent/0"></div>
      </div>

      {/* Form Section */}
      <div className="flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
