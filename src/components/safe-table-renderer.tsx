'use client'

import React from 'react'

interface SafeTableRendererProps {
  tableData: any
}

export function SafeTableRenderer({ tableData }: SafeTableRendererProps) {
  try {
    // Early return if no data
    if (!tableData) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No table data available</p>
        </div>
      )
    }

    // Parse if string
    let parsedData = tableData
    if (typeof tableData === 'string') {
      try {
        parsedData = JSON.parse(tableData)
      } catch (e) {
        console.error('Failed to parse table data:', e)
        return (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Invalid table data format</p>
          </div>
        )
      }
    }

    // Extract columns and rows based on data structure
    let columns: string[] = []
    let rows: any[] = []

    // Case 1: { columns: [...], data: [...] }
    if (parsedData && typeof parsedData === 'object' && 'columns' in parsedData && 'data' in parsedData) {
      // Extract column names
      if (Array.isArray(parsedData.columns)) {
        columns = parsedData.columns.map((col: any) => {
          if (typeof col === 'string') return col
          if (col && typeof col === 'object' && 'id' in col) return col.id
          return String(col)
        })
      }
      // Extract rows
      if (Array.isArray(parsedData.data)) {
        rows = parsedData.data
      }
    }
    // Case 2: { tableData: [...] }
    else if (parsedData && typeof parsedData === 'object' && 'tableData' in parsedData) {
      if (Array.isArray(parsedData.tableData) && parsedData.tableData.length > 0) {
        rows = parsedData.tableData
        columns = Object.keys(rows[0])
      }
    }
    // Case 3: Direct array
    else if (Array.isArray(parsedData) && parsedData.length > 0) {
      rows = parsedData
      columns = Object.keys(rows[0])
    }
    // Case 4: Check if it's a wrapper object with nested structure
    else if (parsedData && typeof parsedData === 'object') {
      // Look for any array property
      const arrayProps = Object.keys(parsedData).filter(key => Array.isArray(parsedData[key]))
      if (arrayProps.length > 0 && parsedData[arrayProps[0]].length > 0) {
        rows = parsedData[arrayProps[0]]
        columns = Object.keys(rows[0])
      }
    }

    // Validate we have data to display
    if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows) || rows.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No table data to display</p>
        </div>
      )
    }

    // Render table
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th
                  key={`col-${index}-${col}`}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {columns.map((col, colIndex) => (
                  <td key={`cell-${rowIndex}-${colIndex}`} className="px-4 py-2 text-sm">
                    {(() => {
                      try {
                        const value = row[col]
                        if (value === null || value === undefined) return '-'
                        if (typeof value === 'object') return JSON.stringify(value)
                        return String(value)
                      } catch (e) {
                        return '-'
                      }
                    })()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  } catch (error) {
    console.error('Error rendering table:', error)
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Error displaying table data</p>
      </div>
    )
  }
}