"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Cta() {
  const customEase = [0.16, 1, 0.3, 1];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: customEase } 
    },
  };

  return (
    <section className="relative py-32 bg-white dark:bg-[#07090f] overflow-hidden flex items-center justify-center font-sans">
      
      {/* ── SEAMLESS TOP FADE ── 
        Blends the background from the Services section (#fafafa) smoothly into this section.
      */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#fafafa] dark:from-[#07090f] to-transparent pointer-events-none z-0" />

      {/* ── SOFT BRAND GLOW ── */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#fc4c02]/10 dark:from-[#fc4c02]/5 via-transparent to-transparent" />

      {/* ── DECORATIVE SPARKLES ── */}
      <div className="absolute top-24 left-[15%] text-[#fc4c02]/30 dark:text-[#fc4c02]/40 text-4xl animate-pulse select-none pointer-events-none">✨</div>
      <div className="absolute bottom-24 right-[15%] text-[#fc4c02]/30 dark:text-[#fc4c02]/40 text-3xl animate-pulse select-none pointer-events-none" style={{ animationDelay: '1s' }}>✦</div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
      >
        
        {/* Elegant Subtitle */}
        <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 mb-8">
          <span className="h-[2px] w-12 bg-[#fc4c02]/40 dark:bg-[#fc4c02]/30"></span>
          <span className="text-[#fc4c02] font-bold tracking-[0.2em] uppercase text-xs">
            Take the Next Step
          </span>
          <span className="h-[2px] w-12 bg-[#fc4c02]/40 dark:bg-[#fc4c02]/30"></span>
        </motion.div>

        {/* High-end Typography */}
        <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 dark:text-white mb-8 tracking-tight leading-[1.1]">
          Ready to align with <br />
          <span className="text-[#fc4c02] font-light italic">your destiny?</span>
        </motion.h2>

        <motion.p variants={itemVariants} className="text-lg md:text-[1.35rem] text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto font-normal leading-relaxed">
          Dive deeper into Vedic astrology through our curated insights, or reach out to our expert astrologers directly to schedule a personalized reading.
        </motion.p>

        {/* Buttons */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <Link 
            href="/blog" 
            className="w-full sm:w-auto px-10 py-4 text-white text-[15px] font-semibold rounded-full shadow-[0_8px_20px_-6px_rgba(252,76,2,0.6)] hover:shadow-[0_8px_25px_-4px_rgba(252,76,2,0.8)] transition-all duration-300 transform hover:-translate-y-1"
            style={{ background: "linear-gradient(135deg, #fc4c02 0%, #d43f00 100%)" }}
          >
            Explore Our Blog
          </Link>
          
      
        </motion.div>
        
      </motion.div>
    </section>
  );
}