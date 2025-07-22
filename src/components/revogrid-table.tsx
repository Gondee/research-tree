'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RevoGrid } from '@revolist/react-datagrid'
import type { RevoGridProps, ColumnRegular } from '@revolist/react-datagrid'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'

interface RevoGridTableProps {
  tableData: any
  sessionName?: string
}

export function RevoGridTable({ tableData, sessionName = 'data' }: RevoGridTableProps) {
  const gridRef = useRef<HTMLRevoGridElement | null>(null)
  const [columns, setColumns] = useState<ColumnRegular[]>([])
  const [source, setSource] = useState<any[]>([])
  const [rowCount, setRowCount] = useState(0)

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

    // Extract rows based on data structure
    let rows: any[] = []
    if (parsedData?.tableData && Array.isArray(parsedData.tableData)) {
      rows = parsedData.tableData
    } else if (parsedData?.data && Array.isArray(parsedData.data)) {
      rows = parsedData.data
    } else if (Array.isArray(parsedData)) {
      rows = parsedData
    }

    if (rows.length > 0) {
      // Filter out metadata columns
      const keys = Object.keys(rows[0]).filter(key => !key.startsWith('_'))
      
      // Create RevoGrid columns
      const gridColumns: ColumnRegular[] = keys.map(key => {
        // Calculate column width based on content
        const headerLength = key.length
        const maxContentLength = Math.max(
          ...rows.slice(0, 20).map(row => String(row[key] || '').length)
        )
        const width = Math.min(Math.max(headerLength, maxContentLength) * 8 + 20, 400)
        
        return {
          prop: key,
          name: key,
          size: width,
          sortable: true,
          resizable: true,
          cellProperties: () => ({
            class: 'text-xs',
          }),
        }
      })
      
      setColumns(gridColumns)
      setSource(rows)
      setRowCount(rows.length)
    }
  }, [tableData])

  // Export to Excel
  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(source)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    
    // Set column widths
    ws['!cols'] = columns.map(col => ({
      wch: Math.floor((col.size || 100) / 8)
    }))
    
    XLSX.writeFile(wb, `${sessionName}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Export to CSV
  const exportToCSV = () => {
    const ws = XLSX.utils.json_to_sheet(source)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionName}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // RevoGrid configuration
  const gridConfig: RevoGridProps = {
    columns: columns,
    source: source,
    theme: 'compact',
    rowSize: 24,
    colSize: 100,
    stretch: false,
    resize: true,
    columnSorting: true,
    rowHeaders: true,
    autoSizeColumn: {
      mode: 'autoSizeOnTextOverlap',
      allColumns: true,
      preciseSize: true,
    },
    filter: true,
    exporting: true,
    clipboard: true,
    readonly: true,
    // Enable range selection
    range: true,
    // Column resize
    columnCanResize: true,
    // Row resize
    rowCanResize: false,
  }

  // Calculate dynamic height based on row count
  const calculateHeight = () => {
    const headerHeight = 30
    const rowHeight = 24
    const toolbarHeight = 40
    const maxHeight = 800
    const minHeight = 200
    
    const calculatedHeight = headerHeight + (rowCount * rowHeight) + toolbarHeight
    return Math.min(maxHeight, Math.max(minHeight, calculatedHeight))
  }

  return (
    <div className="flex flex-col">
      {/* Compact header */}
      <div className="flex justify-between items-center p-3 border-b">
        <span className="text-sm text-gray-600">
          {rowCount.toLocaleString()} rows × {columns.length} columns
        </span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs" onClick={exportToExcel}>
              <FileSpreadsheet className="h-3 w-3 mr-2" />
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs" onClick={exportToCSV}>
              <FileText className="h-3 w-3 mr-2" />
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* RevoGrid container */}
      <div 
        className="border-x border-b overflow-hidden"
        style={{ height: `${calculateHeight()}px` }}
      >
        {columns.length > 0 && source.length > 0 && (
          <RevoGrid
            {...gridConfig}
            class="h-full w-full"
          />
        )}
        {(columns.length === 0 || source.length === 0) && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No data available
          </div>
        )}
      </div>
      
      {/* Help text */}
      <div className="text-xs text-gray-500 mt-1">
        Select cells • Ctrl+C to copy • Click column headers to sort • Drag borders to resize
      </div>
    </div>
  )
}