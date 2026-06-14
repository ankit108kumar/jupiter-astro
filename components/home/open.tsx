"use client";

import { motion } from "framer-motion";

export default function OpenLetter() {
  // Smooth, spring-like ease used in high-end interfaces
const customEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15, // Staggers the appearance of each paragraph
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
    <section className="relative w-full bg-white dark:bg-[#07090f] overflow-hidden py-20 md:py-32 font-sans">
      <div className="max-w-[1400px] mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          
          {/* ── Left Column: Badge & Headline ── */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: customEase }}
            className="lg:col-span-5 flex flex-col items-start"
          >
            {/* Open Envelope SVG matching your video */}
            <div className="flex items-center gap-2.5 mb-6 md:mb-8">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#fc4c02" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21.2 8.4c.5.3.8.8.8 1.4v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V9.8c0-.6.3-1.1.8-1.4l8-5.3c.7-.5 1.7-.5 2.4 0l8 5.3z" />
                <path d="m22 10-8.9 7.1c-.6.5-1.5.5-2.1 0L2 10" />
              </svg>
              <span className="text-[#fc4c02] italic font-medium text-[17px] tracking-wide">
                Open Letter
              </span>
            </div>
            
            <h2 className="text-[2.5rem] sm:text-[3.5rem] lg:text-[4rem] font-extrabold text-gray-900 dark:text-white leading-[1.05] tracking-tight">
              Dear Seeker,<br />
              Your Path to<br />
              Clarity is Written<br />
              in the Stars.
            </h2>
          </motion.div>

          {/* Spacer for Desktop */}
          <div className="hidden lg:block lg:col-span-1"></div>

          {/* ── Right Column: Staggered Paragraphs ── */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="lg:col-span-6 flex flex-col justify-center gap-6 sm:gap-8 text-[1.1rem] sm:text-[1.25rem] text-gray-600 dark:text-gray-400 leading-[1.65]"
          >
            <motion.p variants={itemVariants}>
              Life can often feel like a maze. Every tough decision, every sleepless night wondering what the future holds, and every moment of self-doubt — it is entirely natural to feel lost in the noise of the world.
            </motion.p>
            
            <motion.p variants={itemVariants}>
              But let's face it: you don't have to navigate this journey in the dark. The universe has a unique blueprint designed exactly for you, waiting patiently to be understood.
            </motion.p>
            
            <motion.p variants={itemVariants}>
              The truth is, your birth chart holds the profound answers you've been searching for. It reveals your hidden strengths, your karmic lessons, and the perfect timing for your next big leap in career, love, and life.
            </motion.p>
            
            <motion.p variants={itemVariants} className="font-bold text-gray-900 dark:text-white text-[1.15rem] sm:text-[1.3rem] mt-2">
              All you have to do is listen to what the cosmos is telling you. That's where Jupiter Astro comes in.
            </motion.p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}