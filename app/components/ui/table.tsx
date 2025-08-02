import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

function Table({ children, className = '' }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${className}`}>{children}</table>
    </div>
  );
}

function TableHeader({ children, className = '' }: TableHeaderProps) {
  return <thead className={className}>{children}</thead>;
}

function TableBody({ children, className = '' }: TableBodyProps) {
  return <tbody className={className}>{children}</tbody>;
}

function TableRow({ children, className = '', hover = true }: TableRowProps) {
  const hoverClass = hover ? 'hover:bg-neutral-700/50 transition-colors duration-200' : '';
  return <tr className={`${hoverClass} ${className}`}>{children}</tr>;
}

function TableHead({ children, className = '' }: TableHeadProps) {
  return (
    <th className={`text-left text-neutral-400 text-sm font-medium py-3 px-4 ${className}`}>
      {children}
    </th>
  );
}

function TableCell({ children, className = '' }: TableCellProps) {
  return <td className={`py-3 px-4 text-sm ${className}`}>{children}</td>;
}

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;

export { Table };
