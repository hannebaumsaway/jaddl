'use client';

import * as React from 'react';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronUp, ChevronDown, BarChart3 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface SeasonHistoryRow {
  year: number;
  record: string;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
}

interface SeasonHistoryDataTableProps {
  title: string;
  data: SeasonHistoryRow[];
}

export function SeasonHistoryDataTable({
  title,
  data,
}: SeasonHistoryDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'year', desc: true } // Default sort by year descending
  ]);

  const columns: ColumnDef<SeasonHistoryRow>[] = [
    {
      accessorKey: 'year',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Year
          {column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-medium text-foreground">
          {row.getValue('year')}
        </div>
      ),
    },
    {
      accessorKey: 'record',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Record
          {column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-mono text-foreground">
          {row.getValue('record')}
        </div>
      ),
    },
    {
      accessorKey: 'winPercentage',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Win %
          {column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-mono text-foreground">
          {Number(row.getValue('winPercentage')).toFixed(1)}%
        </div>
      ),
    },
    {
      accessorKey: 'pointsFor',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Points For
          {column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-mono text-foreground">
          {Number(row.getValue('pointsFor')).toFixed(1)}
        </div>
      ),
    },
    {
      accessorKey: 'pointsAgainst',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Points Against
          {column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-mono text-foreground">
          {Number(row.getValue('pointsAgainst')).toFixed(1)}
        </div>
      ),
    },
    {
      accessorKey: 'pointDiff',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Point Diff
          {column.getIsSorted() === 'asc' ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : column.getIsSorted() === 'desc' ? (
            <ChevronDown className="ml-1 h-3 w-3" />
          ) : (
            <ArrowUpDown className="ml-1 h-3 w-3" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const value = Number(row.getValue('pointDiff'));
        const isPositive = value > 0;
        const display = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);

        return (
          <div className={`text-center font-medium font-mono ${
            isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
          }`}>
            {display}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id}
                      className={header.column.id === 'year' ? 'text-left' : 'text-center'}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="hover:bg-muted"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
