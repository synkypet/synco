'use client';

import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-deep-void p-4 relative overflow-hidden font-inter">
      {/* Shared Dynamic Background Elements — Kinetic Glows */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[15%] -left-[10%] w-[50%] h-[50%] bg-kinetic-orange/5 rounded-full blur-[160px] animate-pulse duration-[8s]" />
        <div className="absolute top-1/4 right-0 w-[30%] h-[40%] bg-indigo-500/5 rounded-full blur-[140px]" />
        <div className="absolute -bottom-[20%] right-[10%] w-[50%] h-[50%] bg-kinetic-orange/5 rounded-full blur-[180px] animate-pulse duration-[10s]" />
      </div>

      <div className="w-full flex items-center justify-center relative z-10">
        {children}
      </div>
    </div>
  );
}
