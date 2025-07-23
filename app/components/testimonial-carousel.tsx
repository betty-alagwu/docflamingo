'use client';

import { useState, useEffect } from 'react';

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  company: string;
  avatar: string;
  content: string;
  rating: number;
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  className?: string;
}

export default function TestimonialCarousel({
  testimonials,
  autoPlay = true,
  autoPlayInterval = 5000,
  showDots = true,
  showArrows = true,
  className = '',
}: TestimonialCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1));
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isAutoPlaying, autoPlayInterval, testimonials.length]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
    // Resume auto-play after 10 seconds
    setTimeout(() => setIsAutoPlaying(autoPlay), 10000);
  };

  const goToPrevious = () => {
    setCurrentIndex(currentIndex === 0 ? testimonials.length - 1 : currentIndex - 1);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(autoPlay), 10000);
  };

  const goToNext = () => {
    setCurrentIndex(currentIndex === testimonials.length - 1 ? 0 : currentIndex + 1);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(autoPlay), 10000);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-4 h-4 sm:w-5 sm:h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  return (
    <div className={`relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {/* Main carousel container */}
      <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
        {/* Testimonial cards */}
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="w-full flex-shrink-0 p-6 sm:p-8 md:p-12">
              <div className="flex flex-col items-center text-center space-y-4 sm:space-y-6">
                {/* Avatar */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-white/20">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Rating */}
                <div className="flex space-x-1">{renderStars(testimonial.rating)}</div>

                {/* Content */}
                <blockquote className="text-white text-base sm:text-lg md:text-xl lg:text-2xl font-light leading-relaxed max-w-4xl">
                  &ldquo;{testimonial.content}&rdquo;
                </blockquote>

                {/* Author info */}
                <div className="space-y-1">
                  <div className="text-white font-semibold text-sm sm:text-base md:text-lg">
                    {testimonial.name}
                  </div>
                  <div className="text-gray-400 text-xs sm:text-sm md:text-base">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation arrows */}
        {showArrows && testimonials.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 group"
              aria-label="Previous testimonial"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white group-hover:text-white/90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-200 group"
              aria-label="Next testimonial"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white group-hover:text-white/90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Dots indicator */}
      {showDots && testimonials.length > 1 && (
        <div className="flex justify-center space-x-2 mt-6 sm:mt-8">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full transition-all duration-200 ${
                index === currentIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
