"use client";

import { motion } from "framer-motion";

// ── Expanded Services List (All 8 Services) ──
const SERVICES = [
  {
    id: "birth-chart",
    title: "Birth Chart Analysis",
    description: "A profound deep-dive into your cosmic blueprint. We analyze the precise planetary alignments at the moment of your birth to uncover your core personality, hidden strengths, and ultimate destiny path.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    bullets: ["Ascendant & Moon Sign", "Dasha period analysis"]
  },
  {
    id: "career-finances",
    title: "Career & Finances",
    description: "Strategic guidance for professional growth. We identify periods of financial abundance, optimal times for career transitions, and the sectors where you are most likely to find success.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    bullets: ["10th House reading", "Wealth timelines"]
  },
  {
    id: "relationships",
    title: "Relationship & Marriage",
    description: "Navigate the complexities of human connection. Whether you are seeking a partner or looking to deepen an existing bond, we map out your astrological compatibility and relationship timing.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    bullets: ["Synastry & Compatibility", "7th House prospects"]
  },
  {
    id: "matchmaking",
    title: "Matchmaking (Kundali)",
    description: "Find your perfect cosmic match. We analyze Gunas and Doshas to ensure long-term harmony, family stability, and deep spiritual alignment with your prospective partner.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    bullets: ["Ashtakoot Guna Milan", "Manglik Dosha check"]
  },
  {
    id: "education",
    title: "Education & Exams",
    description: "Unlock your academic potential. Discover the best fields of study, overcome concentration hurdles, and identify optimal timing for competitive exams based on planetary transits.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    bullets: ["Optimal study paths", "Exam success timing"]
  },
  {
    id: "varshaphal",
    title: "Varshaphal Reading",
    description: "Your annual solar return chart. Get a detailed, month-by-month forecast for your upcoming birthday year, highlighting immediate opportunities and challenges.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    bullets: ["Annual forecast", "Monthly transits"]
  },
  {
    id: "muhurta",
    title: "Muhurta Selection",
    description: "Timing is everything. We calculate the most auspicious astrological windows for your major life events, ensuring cosmic alignment for weddings, business launches, or major purchases.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bullets: ["Auspicious dates", "Event-specific alignment"]
  },
  {
    id: "other",
    title: "Custom Consultation",
    description: "Have a specific question? Whether it's regarding a complex business deal, foreign relocation, or deep spiritual growth, get targeted astrological advice for your unique situation.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
    bullets: ["Prashna Kundali", "Targeted problem solving"]
  }
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-[#07090f] pt-28 pb-32 transition-colors duration-300">
      
      {/* ── Page Header ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-4 mb-6"
        >
          <span className="h-px w-8 bg-[#fc4c02]/30"></span>
          <h1 className="text-[#fc4c02] font-bold tracking-[0.2em] uppercase text-xs">
            Our Offerings
          </h1>
          <span className="h-px w-8 bg-[#fc4c02]/30"></span>
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-950 dark:text-white tracking-tight mb-6"
        >
          Find clarity in the <span className="text-[#fc4c02] font-light italic">stars above.</span>
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto font-light leading-relaxed"
        >
          Expert astrological readings tailored to illuminate your career, relationships, and ultimate life path.
        </motion.p>
      </section>

      {/* ── Services Grid ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {SERVICES.map((service, index) => (
            <motion.div 
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
              className="group flex flex-col p-8 rounded-3xl bg-white dark:bg-[#0f1117] border border-gray-200 dark:border-white/[0.06] shadow-xl shadow-black/5 dark:shadow-none hover:border-[#fc4c02]/30 transition-all duration-300 relative overflow-hidden h-full"
            >
              {/* Subtle hover gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#fc4c02]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10 flex flex-col h-full">
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05] text-[#fc4c02] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#fc4c02]/10 transition-all duration-300 shrink-0">
                  {service.icon}
                </div>
                
                {/* Title */}
                <h3 className="text-xl lg:text-2xl font-bold text-gray-950 dark:text-white mb-3">
                  {service.title}
                </h3>
                
                {/* Description */}
                <p className="text-sm lg:text-base text-gray-600 dark:text-gray-400 leading-relaxed font-light mb-8 flex-grow">
                  {service.description}
                </p>
                
                {/* Bullets */}
                <ul className="space-y-3 mt-auto pt-6 border-t border-gray-100 dark:border-white/[0.04]">
                  {service.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs lg:text-sm text-gray-700 dark:text-gray-300 font-medium">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#fc4c02]/10 text-[#fc4c02] shrink-0">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}

        </div>
      </section>
    </main>
  );
}