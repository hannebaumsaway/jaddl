'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TeamRecord } from '@/types/database';
import { EnrichedTeam } from '@/lib/utils/team-mapping';

interface StandingsDataTableProps {
  title: string;
  records: TeamRecord[];
  teamLookup: Map<number, EnrichedTeam>;
  isSubTable?: boolean;
}

export interface StandingsTableRow {
  rank: number;
  team_id: number;
  teamName: string;
  shortName: string;
  logo?: string;
  wins: number;
  losses: number;
  ties: number;
  groupWins: number; // Div or Quad, shown as Div
  groupLosses: number;
  groupTies: number;
  winPercentage: string;
  pointsFor: string;
  pointsAgainst: string;
  pointDifferential: number;
  pointDifferentialDisplay: string;
}

export function StandingsDataTable({
  title,
  records,
  teamLookup,
  isSubTable = false,
}: StandingsDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Transform data for the table
  const tableData: StandingsTableRow[] = React.useMemo(() => 
    records.map((record, index) => {
      const team = teamLookup.get(record.team_id);
      const teamName = team?.teamName || record.team?.team_name || 'Unknown Team';
      const shortName = team?.shortName || record.team?.short_name || 'UNK';
      const logo = team?.logo?.url;

      return {
        rank: index + 1,
        team_id: record.team_id,
        teamName,
        shortName,
        logo,
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        groupWins: ((record as any).quad_wins ?? record.division_wins ?? 0),
        groupLosses: ((record as any).quad_losses ?? record.division_losses ?? 0),
        groupTies: ((record as any).quad_ties ?? record.division_ties ?? 0),
        winPercentage: record.win_percentage.toFixed(1),
        pointsFor: record.points_for.toFixed(1),
        pointsAgainst: record.points_against.toFixed(1),
        pointDifferential: record.point_differential,
        pointDifferentialDisplay: record.point_differential > 0 
          ? `+${record.point_differential.toFixed(1)}`
          : record.point_differential.toFixed(1),
      };
    }),
    [records, teamLookup]
  );

  const columns: ColumnDef<StandingsTableRow>[] = [
    {
      accessorKey: 'rank',
      header: '#',
      cell: ({ row }) => (
        <div className="font-mono text-sm text-muted-foreground">
          {row.getValue('rank')}
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'teamName',
      header: 'Team',
      cell: ({ row }) => {
        const logo = row.original.logo;
        const teamName = row.getValue('teamName') as string;
        const shortName = row.original.shortName;

        return (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 flex items-center justify-center">
              {logo ? (
                <Image
                  src={logo}
                  alt={`${teamName} logo`}
                  width={32}
                  height={32}
                  className="rounded-lg object-cover"
                />
              ) : (
                <span className="text-xl">🏈</span>
              )}
            </div>
            <div>
              <Link 
                href={`/teams/${row.original.team_id}`}
                className="font-semibold text-foreground hover:text-primary hover:underline transition-colors"
              >
                {teamName}
              </Link>
              <div className="text-sm text-muted-foreground">{shortName}</div>
            </div>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'wins',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          W
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('wins')}
        </div>
      ),
    },
    {
      accessorKey: 'losses',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          L
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('losses')}
        </div>
      ),
    },
    {
      accessorKey: 'ties',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          T
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('ties')}
        </div>
      ),
    },
    // Div record W-L-T (uses quads when applicable)
    {
      accessorKey: 'groupWins',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Div W
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('groupWins') as number}
        </div>
      ),
      sortingFn: (a, b) => (a.original.groupWins ?? 0) - (b.original.groupWins ?? 0),
    },
    {
      accessorKey: 'groupLosses',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Div L
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('groupLosses') as number}
        </div>
      ),
      sortingFn: (a, b) => (a.original.groupLosses ?? 0) - (b.original.groupLosses ?? 0),
    },
    {
      accessorKey: 'groupTies',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          Div T
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('groupTies') as number}
        </div>
      ),
      sortingFn: (a, b) => (a.original.groupTies ?? 0) - (b.original.groupTies ?? 0),
    },
    {
      accessorKey: 'winPercentage',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          %
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
        <div className="text-center font-mono text-foreground font-semibold">
          {row.getValue('winPercentage')}
        </div>
      ),
      sortingFn: (rowA, rowB) => {
        const a = parseFloat(rowA.original.winPercentage);
        const b = parseFloat(rowB.original.winPercentage);
        return a - b;
      },
    },
    {
      accessorKey: 'pointsFor',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          PF
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
          {row.getValue('pointsFor')}
        </div>
      ),
      sortingFn: (rowA, rowB) => {
        const a = parseFloat(rowA.original.pointsFor);
        const b = parseFloat(rowB.original.pointsFor);
        return a - b;
      },
    },
    {
      accessorKey: 'pointsAgainst',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          PA
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
          {row.getValue('pointsAgainst')}
        </div>
      ),
      sortingFn: (rowA, rowB) => {
        const a = parseFloat(rowA.original.pointsAgainst);
        const b = parseFloat(rowB.original.pointsAgainst);
        return a - b;
      },
    },
    {
      accessorKey: 'pointDifferential',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-2 font-mono"
        >
          +/-
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
        const value = row.original.pointDifferential;
        const display = row.original.pointDifferentialDisplay;
        const isPositive = value > 0;

        return (
          <div className={`text-center font-mono font-semibold ${
            isPositive ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-foreground'
          }`}>
            {display}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-center">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <Table className="min-w-[800px]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead 
                      key={header.id}
                      className={`${header.column.id === 'teamName' ? 'text-left' : 'text-center'} ${
                        header.column.id === 'rank' || header.column.id === 'teamName' 
                          ? 'sticky left-0 z-20 bg-card' 
                          : ''
                      }`}
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
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell 
                        key={cell.id}
                        className={
                          cell.column.id === 'rank' || cell.column.id === 'teamName' 
                            ? 'sticky left-0 z-10 bg-card' 
                            : ''
                        }
                      >
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
    </div>
  );
}
