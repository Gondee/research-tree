declare module '@revolist/react-datagrid' {
  import { ComponentType } from 'react'
  
  export interface ColumnRegular {
    prop: string
    name?: string
    size?: number
    minSize?: number
    maxSize?: number
    sortable?: boolean
    resizable?: boolean
    readonly?: boolean
    cellProperties?: () => any
    cellTemplate?: any
  }
  
  export interface RevoGridProps {
    columns: ColumnRegular[]
    source: any[]
    theme?: 'default' | 'compact' | 'material' | 'ios'
    rowSize?: number
    colSize?: number
    stretch?: boolean | string
    resize?: boolean
    columnSorting?: boolean
    rowHeaders?: boolean
    autoSizeColumn?: {
      mode?: string
      allColumns?: boolean
      preciseSize?: boolean
    }
    filter?: boolean
    exporting?: boolean
    clipboard?: boolean
    readonly?: boolean
    range?: boolean
    columnCanResize?: boolean
    rowCanResize?: boolean
    class?: string
    style?: React.CSSProperties
  }
  
  export interface HTMLRevoGridElement extends HTMLElement {}
  
  export const RevoGrid: ComponentType<RevoGridProps>
}