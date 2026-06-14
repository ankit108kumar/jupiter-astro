"use client";

import Link from "next/link";

const PERSIMMON = "#fc4c02";


const floatingRashis = [
  {
    name: "Aries",
    svg: (
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M15 28 C15 15 30 15 30 30 M45 28 C45 15 30 15 30 30 M30 30 L30 50" stroke={PERSIMMON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    pos: { top: "15%", left: "12%" },
    rotate: -10,
    floatDelay: "0s",
    size: 100, 
  },
  {
    name: "Taurus",
    svg: (
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="30" cy="35" r="12" stroke={PERSIMMON} strokeWidth="1.5" fill="none"/>
        <path d="M16 22 C22 30 38 30 44 22" stroke={PERSIMMON} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    pos: { top: "18%", right: "12%" },
    rotate: 8,
    floatDelay: "0.6s",
    size: 110,
  },
  {
    name: "Leo",
    svg: (
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="22" cy="22" r="8" stroke={PERSIMMON} strokeWidth="1.5" fill="none"/>
        <path d="M28 28 C38 38 48 45 48 35 C48 25 38 25 38 35 C38 45 48 50 52 48" stroke={PERSIMMON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    pos: { top: "60%", left: "8%" },
    rotate: 15,
    floatDelay: "1s",
    size: 92,
  },
  {
    name: "Scorpio",
    svg: (
      <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M15 25 L15 40 M25 25 L25 40 M35 25 L35 40" stroke={PERSIMMON} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        <path d="M15 30 C15 22 25 22 25 30 C25 22 35 22 35 30 C35 22 45 22 45 30 L45 42 L50 37" stroke={PERSIMMON} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M42 39 L45 42 L48 45" stroke={PERSIMMON} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    pos: { top: "55%", right: "10%" },
    rotate: -6,
    floatDelay: "1.4s",
    size: 92,
  },
];

const zodiacMarquee = [
  { name: "Aries", symbol: "♈" },
  { name: "Taurus", symbol: "♉" },
  { name: "Gemini", symbol: "♊" },
  { name: "Cancer", symbol: "♋" },
  { name: "Leo", symbol: "♌" },
  { name: "Virgo", symbol: "♍" },
  { name: "Libra", symbol: "♎" },
  { name: "Scorpio", symbol: "♏" },
  { name: "Sagittarius", symbol: "♐" },
  { name: "Capricorn", symbol: "♑" },
  { name: "Aquarius", symbol: "♒" },
  { name: "Pisces", symbol: "♓" },
];

export default function Hero() {
  return (
    <section className="relative min-h-[100svh] w-full flex items-center justify-center overflow-hidden bg-[#fdfdfd] dark:bg-[#07090f] font-sans">

      <div 
        className="absolute top-0 left-0 w-full h-[45vh] sm:h-[35vh] pointer-events-none opacity-50 dark:opacity-5 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)'
        }}
      />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background: `radial-gradient(circle at center, ${PERSIMMON}15 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {floatingRashis.map((r) => (
        <div
          key={r.name}
          className="absolute hidden md:flex select-none pointer-events-none flex-col items-center gap-2 z-10 opacity-70 dark:opacity-50"
          style={{
            ...r.pos,
            animation: `rashiFloat 6s ease-in-out infinite alternate`,
            animationDelay: r.floatDelay,
          }}
        >
          <div style={{ width: r.size, height: r.size, transform: `rotate(${r.rotate}deg)` }}>
            {r.svg}
          </div>
        </div>
      ))}

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center pt-10 pb-32 lg:py-0 scale-105">
        
        <h1
          className="font-extrabold text-black dark:text-white tracking-tight mb-4 sm:mb-6 leading-[1.1]"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
            animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            opacity: 0,
          }}
        >
          Navigate life with <br className="hidden sm:block" />
          <span style={{ color: PERSIMMON }}>Cosmic Wisdom.</span>
        </h1>

        <p
          className="text-gray-500 dark:text-gray-400 text-base sm:text-lg md:text-xl font-normal leading-relaxed max-w-2xl mb-8 sm:mb-10 px-2 sm:px-0"
          style={{ animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards", opacity: 0 }}
        >
          Expert birth chart analysis, career forecasts, and personalized remedies. Navigate your life with clarity.
        </p>

       <div
        className="flex flex-col items-center"
        style={{
          animation: "fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards",
          opacity: 0,
        }}
      >
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 w-full">
          <Link
            href="/book"
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-gray-100 text-[15px] font-semibold tracking-wide transition-all duration-300 hover:-translate-y-1 shadow-lg flex items-center justify-center group"
          >
            <svg
              className="w-4 h-4 mr-2.5 transition-transform group-hover:scale-110 group-hover:rotate-12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3c.132 5.827 4.173 9.868 10 10-5.827.132-9.868 4.173-10 10-.132-5.827-4.173-9.868-10-10 5.827-.132 9.868-4.173 10-10z" />
            </svg>
            Book Consultation
          </Link>
      
          <Link
            href="/services"
            className="w-full sm:w-auto px-8 py-4 rounded-full border border-[#fc4c02]/90 bg-white hover:bg-white/10 dark:bg-[#111] dark:border-[#fc4c02]/90 text-black dark:text-gray-200 text-[15px] font-semibold tracking-wide transition-all duration-300 flex items-center justify-center"
          >
            Explore Services
          </Link>
        </div>
      </div>
      </div>

      <div className="absolute bottom-20 sm:bottom-28 left-4 sm:left-8 z-40">
        <a 
          href="https://wa.me/9060734382" 
          target="_blank" 
          rel="noreferrer" 
          className="group flex items-center gap-2 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white p-3.5 sm:px-5 sm:py-3 rounded-full sm:rounded-2xl text-sm font-semibold transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#fc4c02]/30 hover:border-[#fc4c02]/60 hover:scale-105"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 sm:w-5 sm:h-5 text-[#25D366]">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          <span className="hidden sm:inline">Connect on WhatsApp</span>
        </a>
      </div>

      <div 
        className="absolute bottom-6 sm:bottom-8 left-0 w-full overflow-hidden z-20"
        style={{

          maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)'
        }}
      >
        <div className="flex animate-marquee min-w-max">
          {[...Array(4)].flatMap(() => zodiacMarquee).map((zodiac, index) => (
            <div
              key={index}
              className="flex items-center gap-3 shrink-0 mx-8"
            >
              <span className="text-lg text-gray-400 dark:text-gray-500">
                {zodiac.symbol}
              </span>
          
              <span className="text-sm font-medium tracking-[0.15em] uppercase text-gray-700 dark:text-gray-500">
                {zodiac.name}
              </span>
          
              <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes rashiFloat {
          from { transform: translateY(0px); }
          to   { transform: translateY(-20px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); } 
        }
        .animate-marquee {
          animation: marquee 80s linear infinite;
        }
      `}</style>
    </section>
  );
}