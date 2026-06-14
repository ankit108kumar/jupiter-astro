"use client";

import { motion } from "framer-motion";
import BookingForm from "@/components/BookingForm"; // Adjust if your form is elsewhere

export default function BookConsultationPage() {
  return (
    <main className="relative min-h-screen bg-gray-50 dark:bg-[#07090f] flex items-center justify-center p-4 md:p-8 overflow-hidden transition-colors  p-4 md:p-8 
  pt-20 md:pt-8 duration-300 z-0 ">
      
      {/* ── Professional Background Elements ── */}
      {/* Subtle Grid */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
      

      {/* ── Form Container ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl relative z-10"
      >
        <BookingForm />
      </motion.div>

    </main>
  );
}