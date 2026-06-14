"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const customEase = [0.16, 1, 0.3, 1];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6, ease: customEase } 
    },
  };

  return (
    <footer className="bg-white dark:bg-[#07090f] border-t border-gray-100 dark:border-white/[0.06] pt-20 pb-8 text-gray-600 dark:text-gray-400 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ── TOP GRID SECTION ── */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16"
        >
          
          {/* Column 1: Brand */}
          <motion.div variants={itemVariants} className="space-y-6">
            <Link href="/" className="flex items-center gap-3 group w-fit">
              <div
                className="relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden border transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110"
                style={{ 
                  borderColor: "rgba(252, 76, 2, 0.35)", 
                  background: "rgba(252, 76, 2, 0.08)" 
                }}
              >
                <Image 
                  src="/logos/logo.png" 
                  alt="Jupiter Astro Logo" 
                  width={36} 
                  height={36} 
                  className="object-contain w-6 h-6"
                />
              </div>
              <span className="text-[19px] font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-[#fc4c02] transition-colors duration-300">
                Jupiter Astro
              </span>
            </Link>
            <p className="text-[15px] leading-relaxed text-gray-500 dark:text-gray-400 font-normal pr-4">
              Your trusted guide for accurate birth chart analysis, career forecasts, and personalized cosmic remedies. Align with your destiny today.
            </p>
          </motion.div>

          {/* Column 2: Quick Links */}
          <motion.div variants={itemVariants}>
            <h3 className="text-gray-900 dark:text-white font-bold mb-6 uppercase tracking-wider text-xs">Quick Links</h3>
            <ul className="space-y-4 text-[15px]">
              <li>
                <Link href="/" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Home</Link>
              </li>
              <li>
                <Link href="/about" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">About Our Astrologers</Link>
              </li>
              <li>
                <Link href="/blog" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Astrology Blog</Link>
              </li>
              <li>
                <Link href="/#book" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Book Consultation</Link>
              </li>
            </ul>
          </motion.div>

          {/* Column 3: Services */}
          <motion.div variants={itemVariants}>
            <h3 className="text-gray-900 dark:text-white font-bold mb-6 uppercase tracking-wider text-xs">Our Services</h3>
            <ul className="space-y-4 text-[15px]">
              <li>
                <Link href="/services#birth-chart" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Birth Chart Analysis</Link>
              </li>
              <li>
                <Link href="/services#career" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Career Guidance</Link>
              </li>
              <li>
                <Link href="/services#marriage" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Marriage Matching</Link>
              </li>
              <li>
                <Link href="/services#remedies" className="inline-block hover:text-[#fc4c02] transition-all duration-300 hover:translate-x-1">Lal Kitab Remedies</Link>
              </li>
            </ul>
          </motion.div>

          {/* Column 4: Contact & Legal */}
          <motion.div variants={itemVariants}>
            <h3 className="text-gray-900 dark:text-white font-bold mb-6 uppercase tracking-wider text-xs">Connect</h3>
            <ul className="space-y-4 text-[15px]">
              <li>
                <a href="mailto:consult@jupiterastrology108.com" className="group flex items-start gap-3 hover:text-[#fc4c02] transition-colors duration-300">
                  <svg className="w-5 h-5 text-[#fc4c02] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="break-all">consult@jupiterastrology108.com</span>
                </a>
              </li>
              <li>
                <a href="#" className="group flex items-center gap-3 hover:text-[#fc4c02] transition-colors duration-300">
                  <svg className="w-5 h-5 text-[#fc4c02] shrink-0 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                  <span>Join our WhatsApp Group</span>
                </a>
              </li>
            </ul>
            <div className="mt-8 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 font-medium">
              <Link href="/privacy" className="hover:text-[#fc4c02] transition-colors">Privacy Policy</Link>
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
              <Link href="/terms" className="hover:text-[#fc4c02] transition-colors">Terms of Service</Link>
            </div>
          </motion.div>
        </motion.div>

        {/* ── BOTTOM BAR ── */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="pt-8 border-t border-gray-100 dark:border-white/[0.06] flex flex-col md:flex-row justify-between items-center gap-4 text-[13px] text-gray-500 dark:text-gray-500"
        >
          <p>© {currentYear} Jupiter Astro. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Designed for cosmic clarity <span className="text-[#fc4c02]">✦</span>
          </p>
        </motion.div>

      </div>
    </footer>
  );
}