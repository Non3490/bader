'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  PaginationState,
  SortingState,
} from '@tanstack/react-table'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  pagination?: {
    pageIndex: number
    pageSize: number
    pageCount: number
    onPageChange: (page: number) => void
  }
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  className?: string
  actions?: ReactNode
  selectable?: boolean
  onSelectionChange?: (selectedRows: Set<string>) => void
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  pagination,
  sorting,
  onSortingChange,
  className,
  actions,
  selectable,
  onSelectionChange,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    pageCount: pagination?.pageCount ?? -1,
    state: {
      pagination: pagination
        ? { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize }
        : undefined,
      sorting,
    },
    onPaginationChange: (updater) => {
      if (pagination) {
        const newPagination =
          typeof updater === 'function'
            ? updater({ pageIndex: pagination.pageIndex, pageSize: pagination.pageSize })
            : updater
        pagination.onPageChange(newPagination.pageIndex)
      }
    },
    onSortingChange,
    enableRowSelection: selectable,
    onRowSelectionChange: (updater) => {
      if (onSelectionChange) {
        const newSelection =
          typeof updater === 'function' ? updater(new Set<string>()) : updater
        onSelectionChange(new Set(Object.keys(newSelection)))
      }
    },
  })

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and Actions Bar */}
      {(searchPlaceholder || actions) && (
        <div className="flex items-center justify-between gap-4">
          {searchPlaceholder && (
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="w-full h-10 px-4 border border-border rounded-lg text-[11px] focus:border-orange focus:ring-2 focus:ring-orange/10 outline-none"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#f8f8f8]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-[8.5px] uppercase tracking-wide text-text-muted font-bold"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-[#fffcf5] transition-colors"
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-3 text-[11.5px]"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="h-24 text-center text-text-muted"
                >
                  Aucun résultat
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-text-muted">
            Affichage {pagination.pageIndex * pagination.pageSize + 1}-
            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.length)}{' '}
            de {data.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
              disabled={pagination.pageIndex === 0}
              className="px-3 py-1 text-[10px] font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-border hover:bg-[#f8f8f8]"
            >
              Précédent
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.pageCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => pagination.onPageChange(i)}
                  className={cn(
                    'w-8 h-8 rounded-md text-[10px] font-medium',
                    pagination.pageIndex === i
                      ? 'bg-orange text-white'
                      : 'bg-white border border-border hover:bg-[#f8f8f8] text-text-secondary'
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
              disabled={pagination.pageIndex >= pagination.pageCount - 1}
              className="px-3 py-1 text-[10px] font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-border hover:bg-[#f8f8f8]"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
