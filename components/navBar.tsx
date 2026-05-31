"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="fixed top-4 inset-x-4 md:inset-x-8 max-w-6xl mx-auto z-50 bg-white/70 backdrop-blur-md border border-black/50 rounded-full shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] transition-all duration-300 ">
      <div className="px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo Section - Added Site Name */}
          <div className="shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-3">
              <Image 
                src="/logos/logo.png" 
                alt="Jupiter Astro Logo" 
                width={160} 
                height={60} 
                className="h-10 md:h-12 w-auto object-contain hover:opacity-80 transition-opacity"
                priority
              />
              <span className="text-lg md:text-xl font-bold text-orange-700 tracking-tight">
                Jupiter Astro
              </span>
            </Link>
          </div>

          {/* Desktop Navigation - Pill Hover Style */}
          <div className="hidden md:flex items-center space-x-2">
            {['/', '/services', '/blog'].map((path) => {
              const label = path === '/' ? 'Home' : path.replace('/', '').charAt(0).toUpperCase() + path.slice(2);
              const active = isActive(path);
              
              return (
                <Link 
                  key={path}
                  href={path} 
                  className={`px-5 py-2 rounded-full text-[15px] font-medium transition-all duration-200 ${
                    active 
                      ? "bg-orange-50 text-orange-600" 
                      : "text-black hover:bg-gray-100/80 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            
            <div className="pl-4">
              <Link 
                href="/services" 
                className="px-6 py-2.5 bg-orange-700 hover:bg-orange-600 text-white text-sm font-medium rounded-full shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
              >
                Book Consultation
              </Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-orange-700 focus:outline-none transition-colors p-1"
            >
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute top-[calc(100%+0.5rem)] left-0 w-full md:hidden bg-white/95 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-xl overflow-hidden p-2">
          <div className="flex flex-col space-y-1">
            {['/', '/services', '/blog'].map((path) => {
              const label = path === '/' ? 'Home' : path.replace('/', '').charAt(0).toUpperCase() + path.slice(2);
              const active = isActive(path);
              
              return (
                <Link 
                  key={path}
                  href={path} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block w-full px-6 py-3 rounded-2xl text-base font-medium transition-colors ${
                    active 
                      ? "bg-orange-50 text-orange-700" 
                      : "text-gray-700 hover:bg-gray-50 hover:text-orange-700"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="px-2 pt-2 pb-1">
              <Link 
                href="/#book" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full text-center px-6 py-3 bg-orange-700 text-white font-medium rounded-2xl shadow-sm"
              >
                Book Consultation
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}