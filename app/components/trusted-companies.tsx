'use client';

import { useState } from 'react';

export interface Company {
  id: string;
  name: string;
  logo: string;
  logoLight?: string; // Optional light version for dark backgrounds
  website?: string;
}

interface TrustedCompaniesProps {
  companies: Company[];
  title?: string;
  subtitle?: string;
  autoScroll?: boolean;
  scrollSpeed?: number;
  showOnHover?: boolean;
  className?: string;
}

export default function TrustedCompanies({
  companies,
  title = 'Trusted by the best engineering teams',
  subtitle,
  autoScroll = true,
  scrollSpeed = 30, // seconds for one complete cycle
  showOnHover = true,
  className = '',
}: TrustedCompaniesProps) {
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate companies for seamless infinite scroll
  const duplicatedCompanies = [...companies, ...companies];

  if (!companies || companies.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-white text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light mb-4 sm:mb-6">
            {title}
          </h2>
          {subtitle && (
            <p className="text-gray-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>

        <div className="block sm:hidden">
          <div className="grid grid-cols-2 gap-6 sm:gap-8">
            {companies.slice(0, 6).map((company) => (
              <div
                key={company.id}
                className="flex items-center justify-center p-4 sm:p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300 group"
              >
                {company.logo.startsWith('<svg') ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: company.logo }}
                    className="h-8 sm:h-10 md:h-12 w-auto text-white opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                  />
                ) : (
                  <img
                    src={company.logoLight || company.logo}
                    alt={`${company.name} logo`}
                    className="h-8 sm:h-10 md:h-12 w-auto object-contain filter brightness-0 invert opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="hidden sm:block overflow-hidden">
          <div
            className={`flex space-x-8 md:space-x-12 lg:space-x-16 ${
              autoScroll && !isPaused ? 'animate-scroll' : ''
            }`}
            style={{
              animationDuration: `${scrollSpeed}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            }}
            onMouseEnter={() => showOnHover && setIsPaused(true)}
            onMouseLeave={() => showOnHover && setIsPaused(false)}
          >
            {duplicatedCompanies.map((company, index) => (
              <button
                key={`${company.id}-${index}`}
                className="flex-shrink-0 flex items-center justify-center p-6 md:p-8 lg:p-10 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-300 group cursor-pointer min-w-[200px] md:min-w-[240px] lg:min-w-[280px]"
                onClick={() => {
                  if (company.website) {
                    window.open(company.website, '_blank');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (company.website) {
                      window.open(company.website, '_blank');
                    }
                  }
                }}
                aria-label={`Visit ${company.name} website`}
              >
                {company.logo.startsWith('<svg') ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: company.logo }}
                    className="h-10 md:h-12 lg:h-14 w-auto text-white opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110"
                  />
                ) : (
                  <img
                    src={company.logoLight || company.logo}
                    alt={`${company.name} logo`}
                    className="h-10 md:h-12 lg:h-14 w-auto object-contain filter brightness-0 invert opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 sm:mt-16 md:mt-20 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 md:space-x-12">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                10,000+
              </div>
              <div className="text-sm sm:text-base text-gray-400">Pull Requests Reviewed</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-white/20"></div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">500+</div>
              <div className="text-sm sm:text-base text-gray-400">Engineering Teams</div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-white/20"></div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1">
                99.9%
              </div>
              <div className="text-sm sm:text-base text-gray-400">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll linear infinite;
        }
      `}</style>
    </section>
  );
}
