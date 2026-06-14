"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  
  // Using useRef for scroll position prevents unnecessary re-renders in the event listener
  const lastScrollY = useRef(0);
  
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  // Initialize Theme
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  // Scroll Behavior Logic with Framer Motion logic
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Handle hide/show logic based on scroll direction
      if (currentScrollY < lastScrollY.current || currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false);
        setIsMobileMenuOpen(false); // Close mobile menu when scrolling down
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Services" },
    { href: "/blog", label: "Blog" },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: isVisible ? 0 : -100, opacity: isVisible ? 1 : 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        // Removed the scroll background toggle here; it is always transparent now
        className="fixed top-0 left-0 right-0 z-50 w-full bg-transparent"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px]">

            {/* ── LOGO ── */}
            <Link href="/" className="flex items-center gap-3 group shrink-0">
              <div
                className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
                style={{ 
                  borderColor: "rgba(252, 76, 2, 0.35)", 
                  background: "rgba(252, 76, 2, 0.08)" 
                }}
              >
                <Image
                  src="/logos/logo.png"
                  alt="Jupiter Astro"
                  width={30}
                  height={30}
                  className="object-contain w-6 h-6"
                  priority
                />
              </div>
              <span className="text-[17px] font-semibold tracking-tight text-gray-900 dark:text-white group-hover:text-[#fc4c02] transition-colors duration-200">
                Jupiter Astro
              </span>
            </Link>

            {/* ── DESKTOP LINKS ── */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-4 py-2 text-[14px] font-medium rounded-lg transition-colors duration-200 ${
                    isActive(href)
                      ? "text-[#fc4c02]"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {label}
                  {isActive(href) && (
                    <motion.span
                      layoutId="activeTab"
                      className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full shadow-[0_0_8px_#fc4c02]"
                      style={{ background: "#fc4c02" }}
                    />
                  )}
                </Link>
              ))}
            </div>

            {/* ── DESKTOP RIGHT ACTIONS ── */}
            <div className="hidden md:flex items-center gap-3 lg:gap-4">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:border-[#fc4c02]/50 hover:text-[#fc4c02] dark:hover:text-[#fc4c02] transition-all duration-200 bg-white/10 dark:bg-black/10 backdrop-blur-md"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isDark ? "dark" : "light"}
                    initial={{ opacity: 0, rotate: -45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 45 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isDark ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <circle cx="12" cy="12" r="4" />
                        <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                      </svg>
                    )}
                  </motion.div>
                </AnimatePresence>
              </button>

              {/* CTA */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/book"
                  className="px-5 py-2.5 rounded-full text-white text-[13px] font-semibold tracking-wide shadow-[0_8px_20px_-6px_rgba(252,76,2,0.6)] hover:shadow-[0_8px_25px_-4px_rgba(252,76,2,0.8)] transition-shadow"
                  style={{ background: "linear-gradient(135deg, #fc4c02 0%, #d43f00 100%)" }}
                >
                  Book Consultation
                </Link>
              </motion.div>
            </div>

            {/* ── MOBILE ACTIONS (Hamburger & Theme) ── */}
            <div className="md:hidden flex items-center gap-3">
              <button
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 active:scale-95 transition-transform bg-white/10 dark:bg-black/10 backdrop-blur-md"
              >
                {isDark ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <circle cx="12" cy="12" r="4" />
                    <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-700 dark:text-gray-200 p-1 active:scale-95 transition-transform"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isMobileMenuOpen ? "close" : "open"}
                    initial={{ opacity: 0, rotate: -45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 45 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isMobileMenuOpen ? (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </motion.div>
                </AnimatePresence>
              </button>
            </div>
          </div>
        </div>
      </motion.nav>


      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden fixed top-[72px] left-0 w-full z-40 bg-white/95 dark:bg-[#080c14]/95 backdrop-blur-xl border-b border-gray-100 dark:border-white/[0.06] shadow-xl overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-[15px] font-medium transition-colors ${
                    isActive(href)
                      ? "bg-[#fc4c02]/10 text-[#fc4c02]"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/book"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block mt-4 text-center px-4 py-3.5 rounded-xl text-white text-[15px] font-semibold active:scale-[0.98] transition-transform shadow-md"
                style={{ background: "linear-gradient(135deg, #fc4c02 0%, #d43f00 100%)" }}
              >
                Book Consultation
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}