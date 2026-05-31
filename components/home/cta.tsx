import Link from 'next/link';

export default function Cta() {
  return (
    // Removed the border-t class completely
    <section className="relative py-32 bg-white overflow-hidden flex items-center justify-center">
      
      {/* SEAMLESS TOP FADE 
        This blends the gray-50 from the Services section above it smoothly into this white section.
      */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gray-50 to-transparent pointer-events-none z-0" />

      {/* Soft Editorial Glow */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-orange-50/80 via-white/0 to-white/0" />

      {/* Subtle decorative sparkles */}
      <div className="absolute top-24 left-[15%] text-orange-200/60 text-4xl animate-pulse select-none pointer-events-none">✨</div>
      <div className="absolute bottom-24 right-[15%] text-orange-200/60 text-3xl animate-pulse select-none pointer-events-none" style={{ animationDelay: '1s' }}>✦</div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        
        {/* Elegant Subtitle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className="h-px w-12 bg-orange-200"></span>
          <span className="text-orange-700 font-bold tracking-[0.2em] uppercase text-xs">
            Take the Next Step
          </span>
          <span className="h-px w-12 bg-orange-200"></span>
        </div>

        {/* High-end Typography */}
        <h2 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-8 tracking-tight leading-tight">
          Ready to align with <br />
          <span className="text-orange-700 font-light italic">your destiny?</span>
        </h2>

        <p className="text-lg md:text-xl text-gray-500 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
          Dive deeper into Vedic astrology through our curated insights, or reach out to our expert astrologers directly to schedule a personalized reading.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <Link 
            href="/blog" 
            className="w-full sm:w-auto px-10 py-4 bg-orange-700 hover:bg-orange-600 text-white font-medium rounded-full transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(194,110,77,0.4)] transform hover:-translate-y-1"
          >
            Explore the Blog
          </Link>
          
          <a 
            href="mailto:hello@jupiterastro.com" 
            className="w-full sm:w-auto px-10 py-4 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-full border border-gray-200 transition-all duration-300 transform hover:-translate-y-1 shadow-sm"
          >
            Email Us Directly
          </a>
        </div>
        
      </div>
    </section>
  );
}