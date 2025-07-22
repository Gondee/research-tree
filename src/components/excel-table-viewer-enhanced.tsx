'use client'

import React, { useState, useMemo, useEffect } from 'react'
import * as XLSX from 'xlsx'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  FilterFn,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  FileSpreadsheet,
  FileText,
  Copy,
  Columns,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExcelTableViewerEnhancedProps {
  tableData: any
  sessionName?: string
}

// Custom filter function for global search
const globalFilterFn: FilterFn<any> = (row, columnId, value) => {
  const search = value.toLowerCase()
  return Object.values(row.original).some(val => 
    String(val).toLowerCase().includes(search)
  )
}

export function ExcelTableViewerEnhanced({ tableData, sessionName = 'data' }: ExcelTableViewerEnhancedProps) {
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<ColumnDef<any>[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Parse table data on mount
  useEffect(() => {
    if (!tableData) return

    let parsedData = tableData
    if (typeof tableData === 'string') {
      try {
        parsedData = JSON.parse(tableData)
      } catch (e) {
        console.error('Failed to parse table data:', e)
        return
      }
    }

    // Extract rows and columns based on data structure
    let rows: any[] = []
    let columnDefs: ColumnDef<any>[] = []

    // Handle different data formats
    if (parsedData?.tableData && Array.isArray(parsedData.tableData)) {
      rows = parsedData.tableData
    } else if (parsedData?.data && Array.isArray(parsedData.data)) {
      rows = parsedData.data
    } else if (Array.isArray(parsedData)) {
      rows = parsedData
    }

    // Filter out metadata columns
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]).filter(key => !key.startsWith('_'))
      
      columnDefs = keys.map(key => ({
        id: key,
        accessorKey: key,
        header: ({ column }) => {
          const isSorted = column.getIsSorted()
          const hasFilter = columnFilters[key]
          
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{key}</span>
                <div className="flex items-center gap-1">
                  {hasFilter && (
                    <div className="h-2 w-2 bg-primary rounded-full" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => column.toggleSorting()}
                  >
                    {isSorted === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : isSorted === 'desc' ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Filter..."
                value={columnFilters[key] || ''}
                onChange={(e) => {
                  setColumnFilters(prev => ({
                    ...prev,
                    [key]: e.target.value
                  }))
                }}
                className="h-6 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )
        },
        cell: ({ getValue, row, column }) => {
          const value = getValue()
          const cellId = `${row.index}-${column.id}`
          const isSelected = selectedCells.has(cellId)
          
          // Format numbers and dates
          let displayValue = value
          if (value !== null && value !== undefined) {
            if (typeof value === 'number') {
              displayValue = value.toLocaleString()
            } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
              const date = new Date(value)
              if (!isNaN(date.getTime())) {
                displayValue = date.toLocaleDateString()
              }
            }
          }
          
          return (
            <div
              className={cn(
                "px-2 py-1 cursor-pointer min-h-[28px] flex items-center",
                isSelected && "bg-blue-100 dark:bg-blue-900"
              )}
              onClick={(e) => {
                if (e.shiftKey) {
                  setSelectedCells(prev => {
                    const newSet = new Set(prev)
                    if (newSet.has(cellId)) {
                      newSet.delete(cellId)
                    } else {
                      newSet.add(cellId)
                    }
                    return newSet
                  })
                } else {
                  setSelectedCells(new Set([cellId]))
                }
              }}
            >
              {displayValue === null || displayValue === undefined ? '-' : String(displayValue)}
            </div>
          )
        },
        size: 150,
        minSize: 50,
        maxSize: 500,
        enableSorting: true,
        enableHiding: true,
        filterFn: (row, columnId, filterValue) => {
          const value = row.getValue(columnId)
          if (!filterValue) return true
          return String(value).toLowerCase().includes(filterValue.toLowerCase())
        },
      }))

      // Initialize column visibility (all visible by default)
      const visibility: Record<string, boolean> = {}
      keys.forEach(key => {
        visibility[key] = true
      })
      setColumnVisibility(visibility)
    }

    setData(rows)
    setColumns(columnDefs)
  }, [tableData])

  // Apply column filters
  const filteredData = useMemo(() => {
    return data.filter(row => {
      return Object.entries(columnFilters).every(([key, filterValue]) => {
        if (!filterValue) return true
        const value = row[key]
        return String(value).toLowerCase().includes(filterValue.toLowerCase())
      })
    })
  }, [data, columnFilters])

  // Create table instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn,
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  })

  // Export to Excel with formatting
  const exportToExcel = () => {
    const exportData = table.getFilteredRowModel().rows.map(row => row.original)
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    
    // Add column widths based on content
    const maxWidths: Record<string, number> = {}
    
    // Check header widths
    Object.keys(exportData[0] || {}).forEach(key => {
      maxWidths[key] = key.length + 2
    })
    
    // Check data widths
    exportData.forEach(row => {
      Object.keys(row).forEach(key => {
        const len = String(row[key] || '').length
        maxWidths[key] = Math.max(maxWidths[key] || 10, Math.min(len + 2, 50))
      })
    })
    
    ws['!cols'] = Object.keys(maxWidths).map(key => ({ wch: maxWidths[key] }))
    
    // Add basic styling
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1'
      if (!ws[address]) continue
      ws[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'EFEFEF' } }
      }
    }
    
    XLSX.writeFile(wb, `${sessionName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Export to CSV
  const exportToCSV = () => {
    const exportData = table.getFilteredRowModel().rows.map(row => row.original)
    const ws = XLSX.utils.json_to_sheet(exportData)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionName}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Copy selected cells or visible data
  const copyData = () => {
    if (selectedCells.size === 0) {
      // Copy all visible data
      const visibleData = table.getRowModel().rows.map(row => 
        table.getVisibleFlatColumns().map(col => 
          row.getValue(col.id)
        ).join('\t')
      ).join('\n')
      
      // Add headers
      const headers = table.getVisibleFlatColumns().map(col => col.id).join('\t')
      navigator.clipboard.writeText(headers + '\n' + visibleData)
    } else {
      // Copy selected cells
      const selectedData: string[] = []
      selectedCells.forEach(cellId => {
        const [rowIndex, columnId] = cellId.split('-')
        const row = filteredData[parseInt(rowIndex)]
        if (row && row[columnId] !== undefined) {
          selectedData.push(String(row[columnId]))
        }
      })
      navigator.clipboard.writeText(selectedData.join('\t'))
    }
  }

  // Auto-fit columns
  const autoFitColumns = () => {
    // Since column resizing requires special setup with column sizing state,
    // we'll just provide a visual feedback for now
    alert('Auto-fit columns feature coming soon!')
  }

  // Clear all filters
  const clearAllFilters = () => {
    setGlobalFilter('')
    setColumnFilters({})
    setSorting([])
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            e.preventDefault()
            copyData()
            break
          case 'a':
            e.preventDefault()
            // Select all visible cells
            const allCells = new Set<string>()
            table.getRowModel().rows.forEach((row) => {
              table.getVisibleFlatColumns().forEach(col => {
                allCells.add(`${row.index}-${col.id}`)
              })
            })
            setSelectedCells(allCells)
            break
          case 'f':
            e.preventDefault()
            document.getElementById('global-search')?.focus()
            break
        }
      }
      
      if (e.key === 'Escape') {
        setSelectedCells(new Set())
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCells, filteredData])

  const hasActiveFilters = globalFilter || Object.values(columnFilters).some(f => f)

  return (
    <div className={cn(
      "flex flex-col h-full",
      isFullscreen && "fixed inset-0 z-50 bg-background p-4"
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="global-search"
              placeholder="Search all columns... (Ctrl+F)"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8"
            />
            {globalFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 w-7 p-0"
                onClick={() => setGlobalFilter('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="h-4 w-4 mr-2" />
                Columns ({table.getVisibleFlatColumns().length}/{table.getAllColumns().length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => table.toggleAllColumnsVisible(true)}>
                Show all columns
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => table.toggleAllColumnsVisible(false)}>
                Hide all columns
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns().map(column => (
                <DropdownMenuItem
                  key={column.id}
                  onClick={() => column.toggleVisibility()}
                  className="flex items-center gap-2"
                >
                  <div className={cn(
                    "h-4 w-4 border rounded-sm flex items-center justify-center",
                    column.getIsVisible() && "bg-primary border-primary text-primary-foreground"
                  )}>
                    {column.getIsVisible() && '✓'}
                  </div>
                  {column.id}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs"
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} of {data.length} rows
            {selectedCells.size > 0 && ` • ${selectedCells.size} cells selected`}
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyData}>
                <Copy className="h-4 w-4 mr-2" />
                Copy {selectedCells.size > 0 ? 'Selected' : 'All'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={autoFitColumns}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Auto-fit Columns
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={exportToExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleFullscreen}>
                <Maximize2 className="h-4 w-4 mr-2" />
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 rounded-md border overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full relative">
            <thead className="bg-muted/50 sticky top-0 z-10">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="relative px-2 py-2 text-left text-sm font-medium border-r last:border-r-0 bg-muted/50"
                      style={{ width: header.getSize() }}
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
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b hover:bg-muted/25">
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="border-r last:border-r-0"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          {table.getRowModel().rows.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {hasActiveFilters ? 'No results match your filters' : 'No data available'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm">Show</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100, 200].map(pageSize => (
                <SelectItem key={pageSize} value={String(pageSize)}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm">rows</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground mt-2">
        <p>• Click headers to sort • Drag borders to resize • Ctrl+C to copy • Ctrl+A to select all • Ctrl+F to search</p>
      </div>
    </div>
  )
}