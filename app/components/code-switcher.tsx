'use client';

import { useOrganization, useSession, useUser } from '@clerk/nextjs';
// eslint-disable-next-line import/no-named-as-default
import clsx from 'clsx';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

import theme from './theme';

const TYPES = ['user', 'session', 'organization'];

export function CodeSwitcher() {
  const [selectedType, setSelectedType] = useState(TYPES[0]);
  const { user } = useUser();
  const { session } = useSession();
  const { organization } = useOrganization();

  const selectedCode = JSON.stringify(
    {
      user,
      session,
      organization,
    }[selectedType],
    null,
    2
  );

  const typesToShow = organization ? TYPES : TYPES.filter((type) => type !== 'organization');

  return (
    <div className={clsx(organization ? 'h-[54.625rem]' : 'h-[41.625rem]')}>
      <div className="w-full bg-[#F7F7F8] rounded-md p-[0.1875rem] flex gap-1.5">
        {typesToShow.map((type) => (
          <button
            className={clsx(
              'capitalize rounded h-7 text-[0.8125rem] flex-1 hover:text-black font-medium',
              selectedType === type ? 'bg-white shadow-sm text-black' : 'text-[#5E5F6E]'
            )}
            key={type}
            onClick={() => setSelectedType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="relative h-[calc(100%-42px)]">
        <div className="mask h-full">
          {/* @ts-expect-error - SyntaxHighlighter has incomplete type definitions for its props */}
          <SyntaxHighlighter language="javascript" style={theme}>
            {selectedCode}
          </SyntaxHighlighter>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#EEEEF0]" />
      </div>
    </div>
  );
}
