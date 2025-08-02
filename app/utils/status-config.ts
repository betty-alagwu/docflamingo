export type PullRequestStatus = 'merged' | 'open' | 'review' | 'closed';

export const statusConfig = {
  merged: {
    label: 'Merged',
    className: 'bg-purple-900 text-purple-300',
  },
  open: {
    label: 'Open',
    className: 'bg-green-900 text-green-300',
  },
  review: {
    label: 'Review',
    className: 'bg-yellow-900 text-yellow-300',
  },
  closed: {
    label: 'Closed',
    className: 'bg-red-900 text-red-300',
  },
} as const;
