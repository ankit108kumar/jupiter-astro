"use client";

import Link from 'next/link';

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#07090f] flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300">
      
      {/* ── Background Glow & Grid ── */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_var(--tw-gradient-stops))] from-orange-100/30 dark:from-[#fc4c02]/10 via-white/0 dark:via-[#07090f]/0 to-white/0 dark:to-[#07090f]/0" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] z-0 opacity-35" />

      {/* ── Subtle Decorative Floating Elements ── */}
      <div className="absolute top-1/3 left-[15%] md:left-[25%] text-orange-300/40 dark:text-[#fc4c02]/30 text-3xl animate-pulse select-none pointer-events-none">✨</div>
      <div className="absolute bottom-1/3 right-[15%] md:right-[25%] text-orange-300/40 dark:text-[#fc4c02]/30 text-2xl animate-pulse select-none pointer-events-none" style={{ animationDelay: '1s' }}>✦</div>

      {/* ── Main Content ── */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Eyebrow text */}
        <div className="flex items-center justify-center gap-4 mb-8 animate-fade-in-up">
          <span className="h-px w-10 bg-orange-300 dark:bg-[#fc4c02]/40"></span>
          <span className="text-orange-700 dark:text-[#fc4c02] font-bold tracking-[0.2em] uppercase text-xs">
            The Cosmic Journal
          </span>
          <span className="h-px w-10 bg-orange-300 dark:bg-[#fc4c02]/40"></span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white tracking-tight animate-fade-in-up delay-100 mb-6 leading-tight">
          Coming <span className="text-orange-700 dark:text-[#fc4c02] font-light italic">Soon.</span>
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 font-light animate-fade-in-up delay-200 leading-relaxed max-w-xl mx-auto mb-10">
          We are currently aligning the stars. Our cosmic journal featuring planetary transits, practical remedies, and astrological guidance is launching shortly.
        </p>

        {/* Call to Action */}
        <div className="animate-fade-in-up delay-300">
          <Link 
            href="/" 
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white font-medium hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 dark:hover:bg-[#fc4c02]/10 dark:hover:border-[#fc4c02]/30 dark:hover:text-[#fc4c02] transition-all duration-300 shadow-sm"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Homepage
          </Link>
        </div>

      </div>
    </div>
  );
}