import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';

// Mock data (In a real app, you would fetch this from Strapi using the ID)
const blogPosts = [
  {
    id: "1", 
    title: "Understanding the Impact of Your Saturn Return",
    category: "Astrology 101",
    date: "June 1, 2026",
    readTime: "6 min read",
    author: "Jupiter Astro Team",
    content: `
      <p class="lead text-xl text-gray-600 font-light mb-8 leading-relaxed">The Saturn Return is one of the most significant astrological milestones in a person's life, occurring roughly every 27 to 29.5 years when the planet Saturn returns to the exact position it occupied at the moment of your birth.</p>
      
      <h2 class="text-3xl font-bold text-gray-900 mt-12 mb-6 tracking-tight">What Exactly is a Saturn Return?</h2>
      
      <p class="mb-6 text-lg text-gray-600 font-light leading-relaxed">In astrology, Saturn is known as the great taskmaster. It represents structure, discipline, responsibility, and the hard lessons we must learn to mature. When Saturn completes its orbit around the sun and returns to your natal placement, it triggers a period of profound re-evaluation.</p>
      
      <p class="mb-6 text-lg text-gray-600 font-light leading-relaxed">Think of it as a cosmic audit. The universe is checking to see if the foundation you've built your life upon is solid. If you've been living out of alignment with your true self, this period can feel incredibly disruptive. Careers may suddenly end, relationships might dissolve, and deeply held beliefs are challenged.</p>
      
      <div class="my-12 p-8 bg-orange-50/50 rounded-3xl border border-orange-100">
        <p class="text-xl text-orange-800 font-medium italic text-center">"Saturn does not punish; it simply demands authenticity."</p>
      </div>

      <h2 class="text-3xl font-bold text-gray-900 mt-12 mb-6 tracking-tight">How to Navigate the Transition</h2>
      
      <p class="mb-6 text-lg text-gray-600 font-light leading-relaxed">While often feared, this transit is fundamentally about empowerment. It strips away what is false or outgrown so you can step fully into your adulthood. The key to surviving—and thriving—during this time is <strong>surrender and accountability</strong>.</p>
      
      <ul class="list-disc pl-6 mb-8 space-y-3 text-lg text-gray-600 font-light marker:text-orange-700">
        <li>Take responsibility for your choices and past actions.</li>
        <li>Embrace necessary endings without resisting the change.</li>
        <li>Focus on building long-term, sustainable structures for your future.</li>
      </ul>
      
      <p class="mb-6 text-lg text-gray-600 font-light leading-relaxed">Remember, the pressure of Saturn is designed to turn coal into diamonds. Embrace the cosmic reset, and you will emerge stronger, wiser, and more aligned with your ultimate destiny.</p>
    `
  },
  {
    id: "2",
    title: "Venus Retrograde: Navigating Love and Finances",
    category: "Planetary Transits",
    date: "May 24, 2026",
    readTime: "4 min read",
    author: "Jupiter Astro Team",
    content: "<p class='text-lg text-gray-600 font-light leading-relaxed'>Content for Venus Retrograde coming soon...</p>"
  }
];

// 1. We change the type of params to be a Promise
// 2. We make the default function async
export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  
  // 3. We await the params before extracting the id
  const { id } = await params;

  // Find the post that matches the ID in the URL
  const post = blogPosts.find(p => p.id === id);

  // If the post doesn't exist, show the Next.js 404 page
  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back Button */}
        <div className="mb-12 pt-8">
          <Link 
            href="/blog" 
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-orange-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Blog
          </Link>
        </div>

        {/* Article Header */}
        <header className="mb-12 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-medium uppercase tracking-wider text-orange-700 mb-6">
            <span className="px-3 py-1 bg-orange-50 rounded-full">{post.category}</span>
            <span className="text-gray-400 font-light flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              {post.date}
            </span>
            <span className="text-gray-400 font-light flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              {post.readTime}
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight mb-8 leading-[1.1]">
            {post.title}
          </h1>

          <div className="flex items-center justify-center md:justify-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              <Image src="/logos/logo.png" alt="Author" width={40} height={40} className="opacity-50" />
            </div>
            <span className="text-sm font-medium text-gray-900">By {post.author}</span>
          </div>
        </header>

        {/* Featured Image */}
        <div className="w-full h-[40vh] md:h-[60vh] rounded-[2rem] bg-gray-50 border border-gray-100 mb-16 flex items-center justify-center overflow-hidden">
          <Image 
            src="/logos/logo.png" 
            alt={post.title} 
            width={300} 
            height={300} 
            className="object-contain opacity-20"
            priority
          />
        </div>

        {/* Article Content */}
        <div 
          className="max-w-2xl mx-auto prose prose-lg prose-orange"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Footer / CTA */}
        <div className="max-w-2xl mx-auto mt-20 pt-10 border-t border-gray-100 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Want to dive deeper into your own chart?</h3>
          <p className="text-gray-500 font-light mb-8">
            Book a private consultation with our experts to understand exactly how these transits are affecting you.
          </p>
          <Link 
            href="/#book" 
            className="inline-block px-8 py-3.5 bg-orange-700 hover:bg-orange-600 text-white font-medium rounded-full transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(194,110,77,0.4)] transform hover:-translate-y-0.5"
          >
            Book a Consultation
          </Link>
        </div>

      </article>
    </div>
  );
}