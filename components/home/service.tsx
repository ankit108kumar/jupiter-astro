import Link from "next/link";

const servicesList = [
  {
    title: "Birth Chart Analysis",
    desc: "A profound deep-dive into your cosmic blueprint. Understand your core personality, hidden strengths, life challenges, and ultimate destiny path.",
    href: "/services#birth-chart",
    featured: true, 
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    title: "Varshphal Predictions",
    desc: "Comprehensive yearly forecasts detailing the exact timelines of upcoming opportunities and challenges.",
    href: "/services#annual",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Career & Finances",
    desc: "Strategic guidance for business growth, job transitions, and periods of financial abundance.",
    href: "/services#career",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: "Marriage & Matchmaking",
    desc: "Kundli matching, compatibility analysis, and targeted guidance for harmonious relationships.",
    href: "/services#marriage",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    title: "Health Astrology",
    desc: "Analyze planetary alignments to foresee health tendencies and adopt proactive wellness insights.",
    href: "/services#health",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.636 5.364a9 9 0 0112.728 0M12 11v.01M12 21a9 9 0 110-18 9 9 0 010 18z" />
      </svg>
    ),
  },
  {
    title: "Muhurta Timings",
    desc: "Discover the most auspicious astronomical timings for weddings, business launches, and major life events.",
    href: "/services#muhurta",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Lal Kitab Remedies",
    desc: "Highly personalized, practical, and effective karmic solutions including gemstone recommendations.",
    href: "/services#remedies",
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
];

export default function Services() {
  return (
    // Removed the border-t class completely
    <section id="services" className="py-24 bg-gray-50 relative">
      
      {/* SEAMLESS TOP FADE 
        This div sits at the absolute top of the section. It starts pure white (matching the Hero)
        and smoothly fades into transparent, blending perfectly with the bg-gray-50 of this section.
      */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white to-transparent pointer-events-none z-0" />

      {/* Added relative and z-10 so the content sits above the fade layer */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Editorial Header Section */}
        <div className="flex flex-col items-center text-center mb-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="h-[2px] w-8 bg-orange-700"></span>
            <h2 className="text-orange-700 font-bold tracking-[0.2em] uppercase text-xs">
              What We Offer
            </h2>
            <span className="h-[2px] w-8 bg-orange-700"></span>
          </div>
          <h3 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-6">
            Premium Astrology Services
          </h3>
          <p className="text-lg text-gray-500 max-w-2xl font-light">
            Unlock the secrets of your stars. Our expert astrologers provide accurate readings and practical remedies to help you navigate life with absolute clarity.
          </p>
        </div>

        {/* Custom Bento-Style Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servicesList.map((service, index) => (
            <Link 
              href={service.href} 
              key={index} 
              className={`group block p-8 rounded-3xl bg-white border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_30px_-6px_rgba(194,110,77,0.15)] hover:border-orange-200 ${
                service.featured ? "md:col-span-2" : ""
              }`}
            >
              {/* Icon Container */}
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-orange-700 mb-6 group-hover:scale-110 group-hover:bg-orange-50 transition-all duration-300">
                {service.icon}
              </div>
              
              <h4 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-orange-700 transition-colors">
                {service.title}
              </h4>
              
              <p className="text-gray-500 leading-relaxed font-light mb-6">
                {service.desc}
              </p>
              
              {/* Animated 'Read More' Link */}
              <div className="flex items-center gap-2 text-sm font-medium text-orange-700 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                Explore Service 
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}