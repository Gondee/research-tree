'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  MoreVertical,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExcelTableCompactProps {
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

export function ExcelTableCompact({ tableData, sessionName = 'data' }: ExcelTableCompactProps) {
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<ColumnDef<any>[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})

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

    // Filter out metadata columns and create column definitions
    if (rows.length > 0) {
      const keys = Object.keys(rows[0]).filter(key => !key.startsWith('_'))
      const widths: Record<string, number> = {}
      
      columnDefs = keys.map(key => {
        // Calculate initial column width based on content
        const headerLength = key.length
        const maxContentLength = Math.max(
          ...rows.slice(0, 20).map(row => String(row[key] || '').length)
        )
        widths[key] = Math.min(Math.max(headerLength, maxContentLength) * 8 + 20, 300)
        
        return {
          id: key,
          accessorKey: key,
          header: ({ column }) => {
            const isSorted = column.getIsSorted()
            const hasFilter = columnFilters[key]
            
            return (
              <div className="flex items-center justify-between gap-1 px-1 py-0.5">
                <span className="text-xs font-medium truncate" title={key}>
                  {key}
                </span>
                <div className="flex items-center">
                  {hasFilter && (
                    <div className="h-1.5 w-1.5 bg-blue-600 rounded-full mr-1" />
                  )}
                  <button
                    className="hover:bg-gray-100 rounded p-0.5"
                    onClick={(e) => {
                      e.stopPropagation()
                      column.toggleSorting()
                    }}
                  >
                    {isSorted === 'asc' ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : isSorted === 'desc' ? (
                      <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            )
          },
          cell: ({ getValue, row, column }) => {
            const value = getValue()
            const cellId = `${row.index}-${column.id}`
            const isSelected = selectedCell === cellId
            const isExpanded = expandedCell === cellId
            
            // Format value for display
            let displayValue = value
            if (value !== null && value !== undefined) {
              if (typeof value === 'number') {
                displayValue = value.toLocaleString()
              } else if (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-')) {
                const date = new Date(value)
                if (!isNaN(date.getTime())) {
                  displayValue = date.toLocaleDateString()
                }
              }
              displayValue = String(displayValue)
            } else {
              displayValue = ''
            }
            
            const needsTruncation = String(displayValue).length > 30
            
            return (
              <div
                className={cn(
                  "px-1 py-0.5 text-xs cursor-pointer relative group",
                  "border-b border-r border-gray-200",
                  isSelected && "ring-2 ring-blue-500 ring-inset bg-blue-50",
                  "hover:bg-gray-50"
                )}
                onClick={() => {
                  setSelectedCell(cellId)
                  if (needsTruncation) {
                    setExpandedCell(expandedCell === cellId ? null : cellId)
                  }
                }}
                title={needsTruncation ? String(displayValue) : undefined}
              >
                <div className={cn(
                  "overflow-hidden",
                  !isExpanded && "truncate"
                )}>
                  {String(displayValue)}
                </div>
                
                {/* Expanded content popover */}
                {isExpanded && needsTruncation && (
                  <div className="absolute z-50 top-full left-0 mt-1 p-2 bg-white border rounded-md shadow-lg max-w-md">
                    <div className="text-xs whitespace-pre-wrap break-words">
                      {String(displayValue)}
                    </div>
                    <button
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(String(displayValue))
                      }}
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            )
          },
          size: widths[key],
          enableSorting: true,
          enableHiding: true,
          filterFn: (row, columnId, filterValue) => {
            const value = row.getValue(columnId)
            if (!filterValue) return true
            return String(value).toLowerCase().includes(filterValue.toLowerCase())
          },
        }
      })

      setColumnWidths(widths)
      
      // Initialize column visibility
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
    globalFilterFn,
  })

  // Export functions
  const exportToExcel = () => {
    const exportData = table.getFilteredRowModel().rows.map(row => row.original)
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    
    // Set column widths
    ws['!cols'] = Object.entries(columnWidths).map(([key, width]) => ({
      wch: Math.floor(width / 8)
    }))
    
    XLSX.writeFile(wb, `${sessionName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

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

  // Copy selected cell
  const copySelectedCell = () => {
    if (!selectedCell) return
    
    const [rowIndex, columnId] = selectedCell.split('-')
    const row = filteredData[parseInt(rowIndex)]
    if (row && row[columnId] !== undefined) {
      navigator.clipboard.writeText(String(row[columnId]))
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            if (selectedCell) {
              e.preventDefault()
              copySelectedCell()
            }
            break
          case 'f':
            e.preventDefault()
            document.getElementById('compact-search')?.focus()
            break
        }
      }
      
      if (e.key === 'Escape') {
        setSelectedCell(null)
        setExpandedCell(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell, filteredData])

  const hasActiveFilters = globalFilter || Object.values(columnFilters).some(f => f)

  // Calculate dynamic height
  const calculateHeight = () => {
    const headerHeight = 30
    const rowHeight = 24
    const toolbarHeight = 40
    const maxHeight = 800
    const minHeight = 200
    
    const calculatedHeight = headerHeight + (filteredData.length * rowHeight) + toolbarHeight
    return Math.min(maxHeight, Math.max(minHeight, calculatedHeight))
  }

  return (
    <div className="flex flex-col">
      {/* Compact Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
            <Input
              id="compact-search"
              placeholder="Search..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-7 text-xs pl-7 pr-2 w-48"
            />
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                <Filter className="h-3 w-3" />
                Filters
                {Object.keys(columnFilters).length > 0 && (
                  <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1 rounded">
                    {Object.keys(columnFilters).length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3">
              <div className="space-y-2">
                <div className="font-medium text-sm mb-2">Column Filters</div>
                {columns.map(col => {
                  const key = col.id!
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label className="text-xs w-24 truncate" title={key}>
                        {key}:
                      </label>
                      <Input
                        placeholder="Filter..."
                        value={columnFilters[key] || ''}
                        onChange={(e) => {
                          setColumnFilters(prev => ({
                            ...prev,
                            [key]: e.target.value
                          }))
                        }}
                        className="h-6 text-xs flex-1"
                      />
                      {columnFilters[key] && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setColumnFilters(prev => {
                              const newFilters = { ...prev }
                              delete newFilters[key]
                              return newFilters
                            })
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )
                })}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => {
                      setGlobalFilter('')
                      setColumnFilters({})
                    }}
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <Columns className="h-3 w-3 mr-1" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                className="text-xs"
                onClick={() => table.toggleAllColumnsVisible(true)}
              >
                Show all
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onClick={() => table.toggleAllColumnsVisible(false)}
              >
                Hide all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="max-h-60 overflow-y-auto">
                {table.getAllLeafColumns().map(column => (
                  <DropdownMenuItem
                    key={column.id}
                    className="text-xs"
                    onClick={() => column.toggleVisibility()}
                  >
                    <div className={cn(
                      "mr-2 h-3 w-3 border rounded-sm",
                      column.getIsVisible() && "bg-blue-600 border-blue-600"
                    )} />
                    {column.id}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {table.getFilteredRowModel().rows.length} rows
          </span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs" onClick={exportToExcel}>
                <FileSpreadsheet className="h-3 w-3 mr-2" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onClick={exportToCSV}>
                <FileText className="h-3 w-3 mr-2" />
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Compact Table */}
      <div 
        className="border rounded-sm overflow-hidden"
        style={{ height: `${calculateHeight()}px` }}
      >
        <div className="overflow-auto h-full relative">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-gray-50 border-b">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="border-r border-gray-200 bg-gray-50 font-medium text-left"
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
              {table.getRowModel().rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className={cn(
                    rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  )}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="p-0"
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
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-xs text-gray-500">
                {hasActiveFilters ? 'No matching results' : 'No data'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Status bar */}
      <div className="text-xs text-gray-500 mt-1 px-1">
        {selectedCell && `Cell selected • `}
        Click cells to view/copy • Long text shows "..." (click to expand)
      </div>
    </div>
  )
}