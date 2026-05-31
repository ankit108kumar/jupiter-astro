import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative min-h-[calc(100dvh-8rem)] w-full flex items-center justify-center overflow-hidden">
      
      {/* --- SEAMLESS BACKGROUND LIGHTING --- */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-100/50 via-white/0 to-white/0" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_80%_20%,_var(--tw-gradient-stops))] from-[#C26E4D]/5 via-white/0 to-white/0" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_20%_80%,_var(--tw-gradient-stops))] from-orange-50/80 via-white/0 to-white/0" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center py-10">
        
        {/* --- FLOATING ASTROLOGY ELEMENTS --- */}
        <div className="absolute top-[5%] left-[2%] sm:left-[5%] lg:left-[15%] animate-float text-3xl sm:text-5xl md:text-7xl opacity-80 select-none pointer-events-none">
          ☀️
        </div>
        
        <div className="absolute top-[10%] right-[2%] sm:right-[5%] lg:right-[15%] animate-float delay-1000 text-4xl sm:text-6xl md:text-8xl opacity-90 select-none pointer-events-none">
          🪐
        </div>

        <div className="absolute top-[45%] left-[1%] sm:left-[5%] lg:left-[10%] animate-float delay-2000 text-3xl sm:text-4xl md:text-6xl opacity-70 select-none pointer-events-none">
          📜
        </div>

        <div className="absolute top-[50%] right-[1%] sm:right-[5%] lg:right-[10%] animate-float delay-3000 text-2xl sm:text-4xl md:text-5xl opacity-80 select-none pointer-events-none">
          ✨
        </div>

        <div className="absolute bottom-[5%] left-[5%] lg:left-[20%] animate-float delay-1000 text-4xl sm:text-5xl md:text-7xl opacity-90 select-none pointer-events-none">
          🌍
        </div>

        <div className="absolute bottom-[10%] right-[5%] lg:right-[20%] animate-float delay-2000 text-3xl sm:text-5xl md:text-6xl opacity-70 select-none pointer-events-none">
          ♈
        </div>
        {/* ---------------------------------- */}

        {/* Main Text Content - Shifted UP using -translate-y */}
        <div className="relative z-20 w-full max-w-3xl mx-auto text-center pointer-events-none transform -translate-y-8 md:-translate-y-12 scale-110">
          
          <div className="pointer-events-auto">
            
            {/* SEO H2 */}
            <div className="flex items-center justify-center gap-3 mb-4 md:mb-6 animate-fade-in-up opacity-0">
              <span className="h-[2px] w-6 md:w-8 bg-orange-700"></span>
              <h2 className="text-orange-700 font-bold tracking-[0.2em] uppercase text-[10px] md:text-xs lg:text-sm">
                Vedic Astrology
              </h2>
              <span className="h-[2px] w-6 md:w-8 bg-orange-700"></span>
            </div>

            {/* Main SEO H1 */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-gray-900 mb-4 md:mb-6 leading-[1.1] animate-fade-in-up opacity-0 delay-100 tracking-tight">
              <span className="font-medium text-gray-800">Discover your</span> <br/>
              <span className="font-bold text-orange-700">cosmic path.</span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-8 md:mb-10 leading-relaxed animate-fade-in-up opacity-0 delay-200 font-light max-w-2xl mx-auto px-2">
              Expert birth chart analysis, career forecasts, and personalized remedies. Navigate your life with absolute clarity.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-5 animate-fade-in-up opacity-0 delay-300 px-4 sm:px-0">
              <Link 
                href="#book" 
                className="w-full sm:w-auto px-8 py-3.5 bg-orange-700 hover:bg-orange-600 text-white font-medium rounded-full transition-all duration-300 transform hover:-translate-y-1 text-center shadow-[0_8px_20px_-6px_rgba(194,110,77,0.5)]"
              >
                Book Consultation
              </Link>
              <Link 
                href="/services" 
                className="w-full sm:w-auto px-8 py-3.5 bg-gray-200 hover:bg-orange-50 text-black font-medium rounded-full border border-black transition-all duration-300 text-center"
              >
                Explore Services
              </Link>
            </div>
            
            {/* Feature Dots */}
            <ul className="mt-8 md:mt-12 flex flex-wrap items-center justify-center gap-x-4 md:gap-x-6 gap-y-2 md:gap-y-3 text-xs md:text-sm text-gray-500 animate-fade-in-up opacity-0 delay-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span>
                Kundli Matching
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span>
                Career Guidance
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span>
                Yearly Forecasts
              </li>
            </ul>

          </div>
        </div>
      </div>
    </section>
  );
}