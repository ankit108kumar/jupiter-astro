import Cta from "@/components/home/cta";
import Hero from "@/components/home/hero";
import Services from "@/components/home/service";


export default function Home() {
  return (
    <main className="min-h-screen font-sans">
      <Hero />
      <Services />
      <Cta />
    </main>
  );
}