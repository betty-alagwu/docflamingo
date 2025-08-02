import { ChevronRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

import { statusConfig, type PullRequestStatus } from '../utils/status-config';

import { Table } from './ui/table';

interface PullRequest {
  id: string;
  title: string;
  repository: string;
  status: PullRequestStatus;
  author: string;
  date: string;
}

interface PullRequestTableProps {
  pullRequests: PullRequest[];
  title?: string;
  className?: string;
  maxItems?: number;
  showSeeMore?: boolean;
}

export function PullRequestTable({
  pullRequests,
  title = 'Recent Pull Requests',
  className = '',
  maxItems = 6,
  showSeeMore = true,
}: PullRequestTableProps) {
  const displayedPullRequests = maxItems ? pullRequests.slice(0, maxItems) : pullRequests;
  const hasMoreItems = pullRequests.length > maxItems;
  return (
    <div className={`bg-neutral-800 border border-neutral-700 rounded-lg p-6 ${className}`}>
      <h3 className="text-white text-lg font-semibold mb-4">{title}</h3>
      <Table>
        <Table.Header>
          <Table.Row className="border-b border-neutral-700" hover={false}>
            <Table.Head>Title</Table.Head>
            <Table.Head>Repository</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Author</Table.Head>
            <Table.Head>Date</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {displayedPullRequests.map((pr, index) => (
            <Table.Row
              key={pr.id}
              className={
                index < displayedPullRequests.length - 1 ? 'border-b border-neutral-700' : ''
              }
            >
              <Table.Cell className="text-white font-medium">{pr.title}</Table.Cell>
              <Table.Cell className="text-neutral-400">{pr.repository}</Table.Cell>
              <Table.Cell>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig[pr.status].className}`}
                >
                  {statusConfig[pr.status].label}
                </span>
              </Table.Cell>
              <Table.Cell className="text-neutral-400">{pr.author}</Table.Cell>
              <Table.Cell className="text-neutral-400">{pr.date}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {displayedPullRequests.length === 0 && (
        <div className="text-center py-8">
          <p className="text-neutral-400 text-sm">No pull requests found.</p>
        </div>
      )}

      {hasMoreItems && showSeeMore && (
        <div className="mt-4 text-center">
          <Link
            href="/analytics"
            className="inline-flex items-center text-neutral-400 hover:text-white transition-colors duration-200 text-sm font-medium"
          >
            See more
            <ChevronRightIcon className="ml-1 h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
