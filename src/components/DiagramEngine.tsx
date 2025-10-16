/**
 * DiagramEngine - Core diagram rendering and interaction engine
 * Handles table positioning, relationships, and rendering
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';

// Types
export interface TableColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: string;
}

export interface TableNode {
  id: string;
  name: string;
  columns: TableColumn[];
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Relationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface DiagramState {
  tables: Map<string, TableNode>;
  relationships: Relationship[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

interface DiagramEngineProps {
  tables: TableNode[];
  relationships: Relationship[];
  isDarkMode: boolean;
  onStateChange?: (state: DiagramState) => void;
}

// Constants
const TABLE_PADDING = 10;
const COLUMN_HEIGHT = 24;
const HEADER_HEIGHT = 32;
const MIN_TABLE_WIDTH = 200;

const DiagramEngine: React.FC<DiagramEngineProps> = ({
  tables: initialTables,
  relationships,
  isDarkMode,
  onStateChange
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<DiagramState>({
    tables: new Map(initialTables.map(t => [t.id, t])),
    relationships,
    viewport: { x: 0, y: 0, zoom: 1 }
  });
  
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    tableId: string | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  }>({
    isDragging: false,
    tableId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  });

  const [panState, setPanState] = useState<{
    isPanning: boolean;
    startX: number;
    startY: number;
  }>({
    isPanning: false,
    startX: 0,
    startY: 0
  });

  // Calculate table dimensions
  const calculateTableDimensions = useCallback((table: TableNode) => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return { width: MIN_TABLE_WIDTH, height: 100 };
    
    ctx.font = '14px system-ui, -apple-system, sans-serif';
    
    let maxWidth = ctx.measureText(table.name).width;
    table.columns.forEach(col => {
      const text = `${col.name}: ${col.type}`;
      maxWidth = Math.max(maxWidth, ctx.measureText(text).width);
    });
    
    const width = Math.max(MIN_TABLE_WIDTH, maxWidth + TABLE_PADDING * 4);
    const height = HEADER_HEIGHT + (table.columns.length * COLUMN_HEIGHT) + TABLE_PADDING * 2;
    
    return { width, height };
  }, []);

  // Initialize table dimensions
  useEffect(() => {
    const updatedTables = new Map(state.tables);
    let hasChanges = false;
    
    updatedTables.forEach((table, id) => {
      if (!table.width || !table.height) {
        const dims = calculateTableDimensions(table);
        updatedTables.set(id, { ...table, ...dims });
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setState(prev => ({ ...prev, tables: updatedTables }));
    }
  }, [state.tables, calculateTableDimensions]);

  // Auto-layout if tables don't have positions
  useEffect(() => {
    const needsLayout = Array.from(state.tables.values()).some(t => t.x === 0 && t.y === 0);
    if (!needsLayout) return;
    
    const updatedTables = new Map(state.tables);
    const tableArray = Array.from(updatedTables.values());
    const cols = Math.ceil(Math.sqrt(tableArray.length));
    
    tableArray.forEach((table, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      updatedTables.set(table.id, {
        ...table,
        x: col * 300 + 50,
        y: row * 250 + 50
      });
    });
    
    setState(prev => ({ ...prev, tables: updatedTables }));
  }, [state.tables]);

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    const table = state.tables.get(tableId);
    if (!table) return;
    
    const svgPoint = svgRef.current?.createSVGPoint();
    if (!svgPoint || !svgRef.current) return;
    
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    
    const point = svgPoint.matrixTransform(ctm.inverse());
    
    setDragState({
      isDragging: true,
      tableId,
      startX: point.x,
      startY: point.y,
      offsetX: point.x - table.x,
      offsetY: point.y - table.y
    });
  }, [state.tables]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.tableId) return;
    
    const svgPoint = svgRef.current?.createSVGPoint();
    if (!svgPoint || !svgRef.current) return;
    
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    
    const point = svgPoint.matrixTransform(ctm.inverse());
    
    setState(prev => {
      const updatedTables = new Map(prev.tables);
      const table = updatedTables.get(dragState.tableId!);
      if (table) {
        updatedTables.set(dragState.tableId!, {
          ...table,
          x: point.x - dragState.offsetX,
          y: point.y - dragState.offsetY
        });
      }
      return { ...prev, tables: updatedTables };
    });
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && onStateChange) {
      onStateChange(state);
    }
    setDragState({
      isDragging: false,
      tableId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    });
  }, [dragState.isDragging, state, onStateChange]);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setState(prev => ({
      ...prev,
      viewport: {
        ...prev.viewport,
        zoom: Math.max(0.1, Math.min(3, prev.viewport.zoom * delta))
      }
    }));
  }, []);

  // Render connection path
  const renderConnection = useCallback((rel: Relationship) => {
    const fromTable = state.tables.get(rel.fromTable);
    const toTable = state.tables.get(rel.toTable);
    
    if (!fromTable || !toTable) return null;
    
    const fromX = fromTable.x + (fromTable.width || MIN_TABLE_WIDTH);
    const fromY = fromTable.y + HEADER_HEIGHT + 
      (fromTable.columns.findIndex(c => c.name === rel.fromColumn) + 0.5) * COLUMN_HEIGHT;
    
    const toX = toTable.x;
    const toY = toTable.y + HEADER_HEIGHT + 
      (toTable.columns.findIndex(c => c.name === rel.toColumn) + 0.5) * COLUMN_HEIGHT;
    
    const midX = (fromX + toX) / 2;
    
    const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
    
    return (
      <g key={rel.id}>
        <path
          d={path}
          fill="none"
          stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
          strokeWidth="2"
          markerEnd={`url(#arrow-${rel.type})`}
        />
      </g>
    );
  }, [state.tables, isDarkMode]);

  // Render table
  const renderTable = useCallback((table: TableNode) => {
    const width = table.width || MIN_TABLE_WIDTH;
    const height = table.height || 100;
    
    return (
      <g
        key={table.id}
        transform={`translate(${table.x}, ${table.y})`}
        onMouseDown={(e) => handleMouseDown(e, table.id)}
        style={{ cursor: dragState.tableId === table.id ? 'grabbing' : 'grab' }}
      >
        {/* Table background */}
        <rect
          width={width}
          height={height}
          fill={isDarkMode ? '#1f2937' : '#ffffff'}
          stroke={isDarkMode ? '#4b5563' : '#d1d5db'}
          strokeWidth="2"
          rx="4"
        />
        
        {/* Table header */}
        <rect
          width={width}
          height={HEADER_HEIGHT}
          fill={isDarkMode ? '#3b82f6' : '#2563eb'}
          rx="4"
        />
        <rect
          y={HEADER_HEIGHT - 4}
          width={width}
          height="4"
          fill={isDarkMode ? '#3b82f6' : '#2563eb'}
        />
        
        {/* Table name */}
        <text
          x={width / 2}
          y={HEADER_HEIGHT / 2 + 5}
          textAnchor="middle"
          fill="white"
          fontSize="14"
          fontWeight="bold"
        >
          {table.name}
        </text>
        
        {/* Columns */}
        {table.columns.map((col, index) => (
          <g key={col.name} transform={`translate(0, ${HEADER_HEIGHT + index * COLUMN_HEIGHT})`}>
            <rect
              width={width}
              height={COLUMN_HEIGHT}
              fill={index % 2 === 0 ? 
                (isDarkMode ? '#374151' : '#f9fafb') : 
                (isDarkMode ? '#1f2937' : '#ffffff')
              }
            />
            <text
              x={TABLE_PADDING}
              y={COLUMN_HEIGHT / 2 + 4}
              fill={isDarkMode ? '#e5e7eb' : '#1f2937'}
              fontSize="12"
            >
              {col.isPrimaryKey ? '🔑 ' : ''}
              {col.isForeignKey ? '🔗 ' : ''}
              {col.name}
            </text>
            <text
              x={width - TABLE_PADDING}
              y={COLUMN_HEIGHT / 2 + 4}
              textAnchor="end"
              fill={isDarkMode ? '#9ca3af' : '#6b7280'}
              fontSize="11"
              fontStyle="italic"
            >
              {col.type}
            </text>
          </g>
        ))}
      </g>
    );
  }, [isDarkMode, dragState.tableId, handleMouseDown]);

  // Calculate SVG viewBox
  const viewBox = useMemo(() => {
    const tables = Array.from(state.tables.values());
    if (tables.length === 0) return '0 0 1000 600';
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    tables.forEach(table => {
      minX = Math.min(minX, table.x - 50);
      minY = Math.min(minY, table.y - 50);
      maxX = Math.max(maxX, table.x + (table.width || MIN_TABLE_WIDTH) + 50);
      maxY = Math.max(maxY, table.y + (table.height || 100) + 50);
    });
    
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [state.tables]);

  return (
    <div className="w-full h-full overflow-hidden border-2 border-gray-300 dark:border-gray-700 rounded-lg">
      <svg
        ref={svgRef}
        width="100%"
        height="600"
        viewBox={viewBox}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{
          transform: `scale(${state.viewport.zoom})`,
          transformOrigin: 'center',
          transition: 'transform 0.1s ease-out'
        }}
      >
        {/* Define markers for relationships */}
        <defs>
          <marker
            id="arrow-one-to-many"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={isDarkMode ? '#60a5fa' : '#3b82f6'} />
          </marker>
        </defs>
        
        {/* Render relationships first (below tables) */}
        {state.relationships.map(renderConnection)}
        
        {/* Render tables */}
        {Array.from(state.tables.values()).map(renderTable)}
      </svg>
    </div>
  );
};

export default DiagramEngine;