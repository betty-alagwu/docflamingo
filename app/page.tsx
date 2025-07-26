import './home.css';

import Image from 'next/image';

import { Footer } from './components/footer';
import TestimonialCarousel from './components/testimonial-carousel';
import TrustedCompanies from './components/trusted-companies';
import Button from './components/ui/button';
import { trustedCompanies } from './data/companies';
import { testimonials } from './data/testimonials';

export default function Home() {
  return (
    <div className="bg-black w-full min-h-screen">
      <main className="max-w-[75rem] mx-auto py-3 sm:py-5 px-4 sm:px-6 lg:px-8">
        <div>
          <header className="flex items-center justify-between w-full relative">
            <div className="flex gap-2 sm:gap-4">
              <a
                href="/docs"
                className="text-sm sm:text-lg text-gray-400 font-medium hover:text-grey-header leading-7"
              >
                Docs
              </a>
            </div>

            <div className="absolute right-0 sm:left-1/2 lg:left-[36rem] top-1/2 sm:-translate-x-1/2 -translate-y-1/2">
              <div className="">
                <div className="w-4 h-4 bg-white rounded-sm relative z-10 shadow-[0_0_20px_rgba(255,255,255,0.8)] sm:left-1/2  sm:-translate-x-1/2"></div>
              </div>

              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-20 bg-gradient-to-b from-white/70 via-white/40 to-transparent blur-md"></div>
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-32 bg-gradient-to-b from-white/40 via-white/20 to-transparent blur-md"></div>
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-48 bg-gradient-to-b from-white/25 via-white/10 to-transparent blur-lg"></div>
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 h-64 bg-gradient-to-b from-white/15 via-white/5 to-transparent blur-xl"></div>
            </div>

            <div className="hidden sm:flex items-center gap-4 sm:gap-6 lg:gap-10">
              <Button
                variant="outline"
                dimension="md"
                href="/sign-in"
                className="bg-transparent text-gray-400 border-none hover:text-grey-header hover:bg-transparent text-sm sm:text-lg font-medium leading-7 px-0"
              >
                Log in
              </Button>

              <Button variant="primary" dimension="md" href="/sign-up">
                Start for free
              </Button>
            </div>
          </header>
          <div className="text-center pt-20 sm:pt-28 md:pt-32 lg:pt-36">
            <h1 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light capitalize">
              Code Review
            </h1>
            <h1 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light capitalize">
              Made Easy For You
            </h1>
            <p className="text-gray-300 text-center text-base sm:text-lg md:text-xl max-w-sm mx-auto mt-6 sm:mt-8">
              Revlo helps modern software teams ship higher-quality code, 3x faster.
            </p>
            <Button variant="primary" dimension="md" className="mt-6 sm:mt-8" href="/sign-up">
              Get started for free
            </Button>
            <div className="flex items-center justify-center text-center pt-10">
              <Image
                src="https://framerusercontent.com/images/ythxKCuT8XMplgloTlIu0Qmvb0.png?scale-down-to=512"
                alt=""
                width={250}
                height={160}
                className="w-50 h-40"
              />
            </div>
            <div className="flex justify-center items-center flex-none flex-row gap-2.5 min-h-fit overflow-hidden relative w-full pt-16">
              <div className="flex flex-col flex-nowrap flex-1 justify-center relative items-center gap-2.5 w-full max-w-[67rem] mx-auto p-10">
                <div className="absolute inset-0">
                  <Image
                    src="https://framerusercontent.com/images/ClYv9ceke1tpVItSrjAWLZdZMM.png?scale-down-to=512"
                    alt="Hero"
                    fill
                    className="block w-full h-full object-cover object-center rounded-2xl"
                  />
                </div>
                <div className="rounded-xl relative w-full max-w-[90vw] sm:max-w-[85vw] md:max-w-[75vw] lg:max-w-[993px] mx-auto">
                  <div className="w-full">
                    <Image
                      src="https://res.cloudinary.com/dq5e0bbl8/image/upload/v1753286267/Screenshot_2025-07-23_at_4.57.35_PM_kulzrw.png"
                      alt="Hero"
                      width={1200}
                      height={800}
                      className="block w-full h-auto object-cover object-center rounded-2xl min-h-[250px] sm:min-h-[30px] md:min-h-[400px] lg:min-h-[400px] "
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="py-16 sm:py-20 md:py-24 lg:py-32">
          <div className="text-center mb-12 sm:mb-16 md:mb-20">
            <h2 className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light mb-4 sm:mb-6">
              What Developers Say
            </h2>
            <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto px-4">
              Join thousands of developers who trust DocFlamingo to improve their code quality
            </p>
          </div>

          <TestimonialCarousel
            testimonials={testimonials}
            autoPlay={true}
            autoPlayInterval={6000}
            showDots={true}
            showArrows={true}
            className="mb-8 sm:mb-12"
          />
        </section>

        <TrustedCompanies
          companies={trustedCompanies}
          title="Trusted by the best engineering teams"
          subtitle="Join thousands of developers and engineering teams who rely on DocFlamingo for better code reviews"
          autoScroll={true}
          scrollSpeed={40}
          showOnHover={true}
        />

        <div className="flex flex-col items-center justify-center text-center pt-32 max-w-[700px] mx-auto w-full">
          <h1 className="text-white text-center text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light">
            Built to make you extraordinarily productive
          </h1>
          <Button variant="primary" dimension="md" className="mt-12 lg:mt-16" href="/sign-up">
            Get started for free
          </Button>
          <div className="flex items-center justify-center text-center pt-4">
            <Image
              src="https://framerusercontent.com/images/ythxKCuT8XMplgloTlIu0Qmvb0.png?scale-down-to=512"
              alt=""
              width={320}
              height={200}
              className="w-80 h-50"
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
