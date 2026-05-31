import Link from 'next/link';
import Image from 'next/image';

// Mock data: This structure exactly mimics what you will get from a CMS like Strapi.
const blogPosts = [
  {
    id: 1,
    title: "Understanding the Impact of Your Saturn Return",
    excerpt: "Discover how the notorious Saturn return shapes your late twenties and forces profound life transformations. Embrace the cosmic reset.",
    category: "Astrology 101",
    date: "June 1, 2026",
    readTime: "6 min read",
    featured: true,
  },
  {
    id: 2,
    title: "Venus Retrograde: Navigating Love and Finances",
    excerpt: "Learn how to survive the turbulent waters of Venus retrograde without compromising your relationships or your bank account.",
    category: "Planetary Transits",
    date: "May 24, 2026",
    readTime: "4 min read",
    featured: false,
  },
  {
    id: 3,
    title: "The Power of Lal Kitab Remedies in Modern Life",
    excerpt: "Simple, practical, and highly effective karmic solutions to overcome persistent life obstacles and clear energetic blockages.",
    category: "Remedies",
    date: "May 18, 2026",
    readTime: "5 min read",
    featured: false,
  },
  {
    id: 4,
    title: "Career Astrology: Finding Your True Cosmic Calling",
    excerpt: "How your 10th house and midheaven reveal the professional path and industry you were cosmically designed to pursue.",
    category: "Career Guidance",
    date: "May 10, 2026",
    readTime: "7 min read",
    featured: false,
  }
];

export default function BlogPage() {
  const featuredPost = blogPosts.find(post => post.featured);
  const regularPosts = blogPosts.filter(post => !post.featured);

  return (
    <div className="min-h-screen bg-white pb-24">
      
      {/* --- BLOG HERO BANNER ---
        Replaced the plain text with a premium, full-width editorial header 
      */}
      <section className="relative w-full overflow-hidden bg-gray-50/30 pt-32 md:pt-40 pb-20 md:pb-28 mb-16 border-b border-gray-100 flex flex-col items-center text-center">
        
        {/* Soft Background Glow */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,_var(--tw-gradient-stops))] from-orange-100/40 via-white/0 to-white/0" />

        {/* Subtle Decorative Elements */}
        <div className="absolute top-24 left-[10%] md:left-[20%] text-orange-200/60 text-2xl md:text-3xl animate-pulse select-none pointer-events-none">✨</div>
        <div className="absolute bottom-16 right-[10%] md:right-[20%] text-orange-200/60 text-xl md:text-2xl animate-pulse select-none pointer-events-none" style={{ animationDelay: '1s' }}>✦</div>

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">
          
          <div className="flex items-center justify-center gap-3 mb-6 animate-fade-in-up">
            <span className="h-[1px] w-8 bg-orange-300"></span>
            <span className="text-orange-700 font-bold tracking-[0.2em] uppercase text-xs">
              Jupiter Astro
            </span>
            <span className="h-[1px] w-8 bg-orange-300"></span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight animate-fade-in-up delay-100 mb-6 leading-[1.1]">
            The Cosmic <br/>
            <span className="text-orange-700 font-light italic">Journal.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 font-light animate-fade-in-up delay-200 leading-relaxed max-w-2xl mx-auto">
            Explore profound planetary transits, practical Lal Kitab remedies, and expert astrological guidance for your everyday life.
          </p>

        </div>
      </section>

      {/* --- BLOG CONTENT GRID --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Featured Post (Spans full width) */}
        {featuredPost && (
          <Link href={`/blog/${featuredPost.id}`} className="group block mb-16 animate-fade-in-up delay-300">
            <div className="relative rounded-[2.5rem] bg-gray-50 border border-gray-100 p-8 md:p-12 lg:p-16 overflow-hidden transition-all duration-300 hover:shadow-[0_20px_40px_-12px_rgba(194,110,77,0.1)] hover:border-orange-100 flex flex-col md:flex-row items-center gap-10">
              
              {/* Image Placeholder - Uses your logo */}
              <div className="w-full md:w-1/2 h-64 md:h-80 rounded-3xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center transform transition-transform duration-500 group-hover:scale-[1.02] p-8">
                <Image 
                  src="/logos/logo.png" 
                  alt="Jupiter Astro Logo" 
                  width={180} 
                  height={180} 
                  className="object-contain opacity-50 transition-opacity duration-300 group-hover:opacity-70"
                />
              </div>

              {/* Featured Post Content */}
              <div className="w-full md:w-1/2 space-y-6">
                <div className="flex items-center gap-4 text-xs font-medium uppercase tracking-wider text-orange-700">
                  <span className="px-3 py-1 bg-orange-100 rounded-full">{featuredPost.category}</span>
                  <span className="text-gray-400 font-light">{featuredPost.readTime}</span>
                </div>
                
                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight group-hover:text-orange-700 transition-colors">
                  {featuredPost.title}
                </h3>
                
                <p className="text-lg text-gray-500 font-light leading-relaxed">
                  {featuredPost.excerpt}
                </p>
                
                <div className="flex items-center gap-2 text-sm font-medium text-orange-700 pt-2">
                  Read Full Article 
                  <svg className="w-4 h-4 transform transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Regular Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-fade-in-up delay-300">
          {regularPosts.map((post) => (
            <Link href={`/blog/${post.id}`} key={post.id} className="group flex flex-col">
              <div className="rounded-3xl bg-gray-50 border border-gray-100 p-6 flex flex-col h-full transition-all duration-300 hover:shadow-[0_12px_30px_-6px_rgba(194,110,77,0.1)] hover:-translate-y-1 hover:border-orange-100 hover:bg-white">
                
                {/* Category & Date */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-medium uppercase tracking-wider text-orange-700 px-3 py-1 bg-orange-50 rounded-full group-hover:bg-orange-100 transition-colors">
                    {post.category}
                  </span>
                  <span className="text-xs text-gray-400">{post.date}</span>
                </div>

                {/* Title */}
                <h4 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-orange-700 transition-colors line-clamp-2">
                  {post.title}
                </h4>

                {/* Excerpt */}
                <p className="text-gray-500 font-light leading-relaxed mb-6 flex-grow line-clamp-3">
                  {post.excerpt}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400 font-light">{post.readTime}</span>
                  <svg className="w-4 h-4 text-orange-700 transform transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}