/**
 * DiagramEngineOptimized - Lightweight and performant diagram renderer
 * Uses RAF and optimized rendering for smooth interactions
 */

import React, { useCallback, useEffect, useRef, useState, memo } from 'react';

export interface TableColumn {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  nullable?: boolean;
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

interface DiagramEngineProps {
  tables: TableNode[];
  relationships: Relationship[];
  isDarkMode: boolean;
  onStateChange?: () => void;
}

// Constants
const TABLE_PADDING = 10;
const COLUMN_HEIGHT = 24;
const HEADER_HEIGHT = 32;
const MIN_TABLE_WIDTH = 200;

// Memoized table component
const Table = memo(({ 
  table, 
  isDarkMode, 
  isDragging,
  onMouseDown 
}: {
  table: TableNode;
  isDarkMode: boolean;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent, tableId: string) => void;
}) => {
  const width = table.width || MIN_TABLE_WIDTH;
  const height = table.height || (HEADER_HEIGHT + table.columns.length * COLUMN_HEIGHT + TABLE_PADDING * 2);
  
  return (
    <g
      transform={`translate(${table.x}, ${table.y})`}
      onMouseDown={(e) => onMouseDown(e, table.id)}
      style={{ 
        cursor: isDragging ? 'grabbing' : 'grab',
        pointerEvents: 'all'
      }}
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
      
      {/* Columns - simplified rendering */}
      {table.columns.map((col, index) => {
        const y = HEADER_HEIGHT + index * COLUMN_HEIGHT;
        const bgColor = index % 2 === 0 ? 
          (isDarkMode ? '#374151' : '#f9fafb') : 
          (isDarkMode ? '#1f2937' : '#ffffff');
        
        return (
          <g key={col.name}>
            <rect
              y={y}
              width={width}
              height={COLUMN_HEIGHT}
              fill={bgColor}
            />
            <text
              x={TABLE_PADDING}
              y={y + COLUMN_HEIGHT / 2 + 4}
              fill={isDarkMode ? '#e5e7eb' : '#1f2937'}
              fontSize="12"
            >
              {col.isPrimaryKey ? '🔑 ' : ''}
              {col.isForeignKey ? '🔗 ' : ''}
              {col.name}
            </text>
            <text
              x={width - TABLE_PADDING}
              y={y + COLUMN_HEIGHT / 2 + 4}
              textAnchor="end"
              fill={isDarkMode ? '#9ca3af' : '#6b7280'}
              fontSize="11"
              fontStyle="italic"
            >
              {col.type}
            </text>
          </g>
        );
      })}
    </g>
  );
});

Table.displayName = 'Table';

const DiagramEngineOptimized: React.FC<DiagramEngineProps> = ({
  tables: initialTables,
  relationships,
  isDarkMode,
  onStateChange
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tables, setTables] = useState(initialTables);
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<{
    tableId: string | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  }>({ tableId: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  
  const rafRef = useRef<number>();

  // Update tables when props change
  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  // Calculate table dimensions once
  useEffect(() => {
    const updatedTables = tables.map(table => {
      if (!table.width || !table.height) {
        const width = MIN_TABLE_WIDTH;
        const height = HEADER_HEIGHT + (table.columns.length * COLUMN_HEIGHT) + TABLE_PADDING * 2;
        return { ...table, width, height };
      }
      return table;
    });
    
    const hasChanges = updatedTables.some((t, i) => t !== tables[i]);
    if (hasChanges) {
      setTables(updatedTables);
    }
  }, [tables]);

  // Auto-layout if needed
  useEffect(() => {
    const needsLayout = tables.some(t => t.x === 0 && t.y === 0);
    if (!needsLayout) return;
    
    const cols = Math.ceil(Math.sqrt(tables.length));
    const layoutTables = tables.map((table, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...table,
        x: col * 300 + 50,
        y: row * 250 + 50
      };
    });
    
    setTables(layoutTables);
  }, []);

  // Optimized mouse handlers using RAF
  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const table = tables.find(t => t.id === tableId);
    if (!table || !svgRef.current) return;
    
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    
    const point = svgPoint.matrixTransform(ctm.inverse());
    
    dragRef.current = {
      tableId,
      startX: point.x,
      startY: point.y,
      offsetX: point.x - table.x,
      offsetY: point.y - table.y
    };
  }, [tables]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.tableId || !svgRef.current) return;
      
      // Cancel previous RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Use RAF for smooth updates
      rafRef.current = requestAnimationFrame(() => {
        const svgPoint = svgRef.current!.createSVGPoint();
        svgPoint.x = e.clientX;
        svgPoint.y = e.clientY;
        
        const ctm = svgRef.current!.getScreenCTM();
        if (!ctm) return;
        
        const point = svgPoint.matrixTransform(ctm.inverse());
        
        setTables(prev => prev.map(table => 
          table.id === dragRef.current.tableId
            ? { ...table, x: point.x - dragRef.current.offsetX, y: point.y - dragRef.current.offsetY }
            : table
        ));
      });
    };

    const handleMouseUp = () => {
      if (dragRef.current.tableId) {
        dragRef.current = { tableId: null, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
        onStateChange?.();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    svgRef.current?.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      svgRef.current?.removeEventListener('wheel', handleWheel);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [onStateChange]);

  // Simple viewBox calculation
  const viewBox = (() => {
    if (tables.length === 0) return '0 0 1000 600';
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    tables.forEach(table => {
      minX = Math.min(minX, table.x - 50);
      minY = Math.min(minY, table.y - 50);
      maxX = Math.max(maxX, table.x + (table.width || MIN_TABLE_WIDTH) + 50);
      maxY = Math.max(maxY, table.y + (table.height || 100) + 50);
    });
    
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  })();

  return (
    <div className="w-full h-full overflow-hidden border-2 border-gray-300 dark:border-gray-700 rounded-lg">
      <svg
        ref={svgRef}
        width="100%"
        height="600"
        viewBox={viewBox}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center',
          transition: 'none', // Remove transition for better performance
          willChange: 'transform'
        }}
      >
        {/* Simple relationship rendering */}
        {relationships.map(rel => {
          const fromTable = tables.find(t => t.id === rel.fromTable);
          const toTable = tables.find(t => t.id === rel.toTable);
          
          if (!fromTable || !toTable) return null;
          
          const fromX = fromTable.x + (fromTable.width || MIN_TABLE_WIDTH);
          const fromY = fromTable.y + HEADER_HEIGHT + 20;
          const toX = toTable.x;
          const toY = toTable.y + HEADER_HEIGHT + 20;
          const midX = (fromX + toX) / 2;
          
          return (
            <path
              key={rel.id}
              d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
              fill="none"
              stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
              strokeWidth="2"
              pointerEvents="none"
            />
          );
        })}
        
        {/* Render tables */}
        {tables.map(table => (
          <Table
            key={table.id}
            table={table}
            isDarkMode={isDarkMode}
            isDragging={dragRef.current.tableId === table.id}
            onMouseDown={handleMouseDown}
          />
        ))}
      </svg>
      
      {/* Simple zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg">
        <button
          onClick={() => setZoom(prev => Math.min(3, prev * 1.2))}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          aria-label="Zoom In"
        >
          +
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(0.1, prev / 1.2))}
          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
          aria-label="Zoom Out"
        >
          −
        </button>
        <div className="text-center text-xs text-gray-700 dark:text-gray-300">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
};

export default memo(DiagramEngineOptimized);