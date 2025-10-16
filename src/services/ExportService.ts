/**
 * ExportService - Handles diagram export to various formats
 * Clean, reliable export without SVG parsing issues
 */

import { TableNode, Relationship } from '../components/DiagramEngine';

export interface ExportOptions {
  isDarkMode?: boolean;
  transparentBackground?: boolean;
  showCardinality?: boolean;
  showConstraints?: boolean;
  academicStyle?: boolean;
}

export class ExportService {
  /**
   * Generate clean SVG from diagram state
   */
  static generateSVG(
    tables: TableNode[],
    relationships: Relationship[],
    options: ExportOptions = {}
  ): string {
    const {
      isDarkMode = false,
      transparentBackground = false,
      showCardinality = true,
      showConstraints = true,
      academicStyle = false
    } = options;
    const TABLE_PADDING = 10;
    const COLUMN_HEIGHT = 24;
    const HEADER_HEIGHT = 32;
    const MIN_TABLE_WIDTH = 200;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    tables.forEach(table => {
      minX = Math.min(minX, table.x - 50);
      minY = Math.min(minY, table.y - 50);
      maxX = Math.max(maxX, table.x + (table.width || MIN_TABLE_WIDTH) + 50);
      maxY = Math.max(maxY, table.y + (table.height || 150) + 50);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    // Build SVG string directly - no parsing issues!
    const svg: string[] = [];
    
    // Add background if not transparent
    const bgColor = transparentBackground ? 'transparent' : (isDarkMode ? '#111827' : '#ffffff');
    
    svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">`);
    
    // Add background rect if not transparent
    if (!transparentBackground) {
      svg.push(`<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bgColor}" />`);
    }
    
    // Add styles - Academic style uses more formal appearance
    const tableStroke = academicStyle ? 1 : 2;
    const headerColor = academicStyle ? (isDarkMode ? '#4b5563' : '#374151') : (isDarkMode ? '#3b82f6' : '#2563eb');
    const fontFamily = academicStyle ? 'Times New Roman, serif' : 'system-ui, -apple-system, sans-serif';
    
    svg.push(`<style>
      .table-bg { 
        fill: ${isDarkMode ? '#1f2937' : '#ffffff'}; 
        stroke: ${isDarkMode ? '#4b5563' : '#000000'}; 
        stroke-width: ${tableStroke}; 
      }
      .table-header { 
        fill: ${headerColor}; 
      }
      .table-text { 
        fill: white; 
        font-family: ${fontFamily}; 
        font-size: ${academicStyle ? '12px' : '14px'}; 
        font-weight: bold; 
      }
      .column-text { 
        fill: ${isDarkMode ? '#e5e7eb' : '#1f2937'}; 
        font-family: ${fontFamily}; 
        font-size: ${academicStyle ? '11px' : '12px'}; 
      }
      .type-text { 
        fill: ${isDarkMode ? '#9ca3af' : '#6b7280'}; 
        font-family: ${fontFamily}; 
        font-size: ${academicStyle ? '10px' : '11px'}; 
        font-style: italic; 
      }
      .relationship { 
        stroke: ${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}; 
        stroke-width: ${academicStyle ? 1 : 2}; 
        fill: none; 
      }
      .cardinality-text {
        fill: ${isDarkMode ? '#e5e7eb' : '#1f2937'};
        font-family: ${fontFamily};
        font-size: ${academicStyle ? '10px' : '11px'};
        font-weight: ${academicStyle ? 'normal' : 'bold'};
      }
      .constraint-text {
        fill: ${isDarkMode ? '#fbbf24' : '#f59e0b'};
        font-family: ${fontFamily};
        font-size: 10px;
      }
    </style>`);

    // Add arrow markers for different relationship types
    svg.push(`<defs>
      <marker id="arrow-many" markerWidth="15" markerHeight="10" refX="15" refY="5" orient="auto">
        <path d="M0,0 L0,10 L10,5 z" fill="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" />
        <path d="M10,5 L15,0 M10,5 L15,5 M10,5 L15,10" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" fill="none" />
      </marker>
      <marker id="arrow-one" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
        <path d="M0,0 L0,10 L10,5 z" fill="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" />
        <line x1="10" y1="0" x2="10" y2="10" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" />
      </marker>
      <marker id="arrow-zero-one" markerWidth="15" markerHeight="10" refX="15" refY="5" orient="auto">
        <circle cx="5" cy="5" r="3" fill="none" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" />
        <line x1="8" y1="5" x2="15" y2="5" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" />
        <line x1="15" y1="0" x2="15" y2="10" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" />
      </marker>
      <marker id="arrow-zero-many" markerWidth="20" markerHeight="10" refX="20" refY="5" orient="auto">
        <circle cx="5" cy="5" r="3" fill="none" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" />
        <path d="M8,5 L15,5" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" />
        <path d="M15,5 L20,0 M15,5 L20,5 M15,5 L20,10" stroke="${isDarkMode ? '#60a5fa' : (academicStyle ? '#000000' : '#3b82f6')}" stroke-width="1" fill="none" />
      </marker>
    </defs>`);

    // Render relationships
    relationships.forEach(rel => {
      const fromTable = tables.find(t => t.id === rel.fromTable);
      const toTable = tables.find(t => t.id === rel.toTable);
      
      if (fromTable && toTable) {
        const fromX = fromTable.x + (fromTable.width || MIN_TABLE_WIDTH);
        const fromY = fromTable.y + HEADER_HEIGHT + 
          (fromTable.columns.findIndex(c => c.name === rel.fromColumn) + 0.5) * COLUMN_HEIGHT;
        
        const toX = toTable.x;
        const toY = toTable.y + HEADER_HEIGHT + 
          (toTable.columns.findIndex(c => c.name === rel.toColumn) + 0.5) * COLUMN_HEIGHT;
        
        const midX = (fromX + toX) / 2;
        
        // Determine arrow type based on relationship
        let markerEnd = 'arrow-many';
        let markerStart = 'arrow-one';
        
        if (rel.type === 'one-to-one') {
          markerEnd = 'arrow-one';
          markerStart = 'arrow-one';
        } else if (rel.type === 'one-to-many') {
          markerEnd = 'arrow-many';
          markerStart = 'arrow-one';
        }
        
        // Draw relationship line
        svg.push(`<path class="relationship" d="M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}" marker-end="url(#${markerEnd})" marker-start="url(#${markerStart})" />`);
        
        // Add cardinality labels if enabled
        if (showCardinality) {
          const cardinalityFrom = rel.type === 'one-to-one' ? '1' : '1';
          const cardinalityTo = rel.type === 'one-to-one' ? '1' : (rel.type === 'one-to-many' ? 'N' : 'M');
          
          svg.push(`<text class="cardinality-text" x="${fromX + 15}" y="${fromY - 5}">${cardinalityFrom}</text>`);
          svg.push(`<text class="cardinality-text" x="${toX - 25}" y="${toY - 5}">${cardinalityTo}</text>`);
        }
      }
    });

    // Render tables
    tables.forEach(table => {
      const width = table.width || MIN_TABLE_WIDTH;
      const height = table.height || (HEADER_HEIGHT + table.columns.length * COLUMN_HEIGHT + TABLE_PADDING * 2);
      
      svg.push(`<g transform="translate(${table.x}, ${table.y})">`);
      
      // Table background
      const cornerRadius = academicStyle ? 0 : 4;
      svg.push(`<rect class="table-bg" width="${width}" height="${height}" rx="${cornerRadius}" />`);
      
      // Table header
      svg.push(`<rect class="table-header" width="${width}" height="${HEADER_HEIGHT}" rx="${cornerRadius}" />`);
      if (!academicStyle) {
        svg.push(`<rect class="table-header" y="${HEADER_HEIGHT - 4}" width="${width}" height="4" />`);
      }
      
      // Table name
      svg.push(`<text class="table-text" x="${width / 2}" y="${HEADER_HEIGHT / 2 + 5}" text-anchor="middle">${this.escapeXml(table.name)}</text>`);
      
      // Columns
      table.columns.forEach((col, index) => {
        const y = HEADER_HEIGHT + index * COLUMN_HEIGHT;
        const bgColor = index % 2 === 0 ? 
          (isDarkMode ? '#374151' : '#f9fafb') : 
          (isDarkMode ? '#1f2937' : '#ffffff');
        
        svg.push(`<rect x="0" y="${y}" width="${width}" height="${COLUMN_HEIGHT}" fill="${bgColor}" />`);
        
        let prefix = '';
        if (academicStyle) {
          if (col.isPrimaryKey) prefix += 'PK ';
          if (col.isForeignKey) prefix += 'FK ';
        } else {
          if (col.isPrimaryKey) prefix += '🔑 ';
          if (col.isForeignKey) prefix += '🔗 ';
        }
        
        // Add constraints notation if enabled
        let constraints = '';
        if (showConstraints) {
          if (!col.nullable) constraints += ' NOT NULL';
          if (col.unique) constraints += ' UNIQUE';
        }
        
        svg.push(`<text class="column-text" x="${TABLE_PADDING}" y="${y + COLUMN_HEIGHT / 2 + 4}">${prefix}${this.escapeXml(col.name)}</text>`);
        svg.push(`<text class="type-text" x="${width - TABLE_PADDING}" y="${y + COLUMN_HEIGHT / 2 + 4}" text-anchor="end">${this.escapeXml(col.type)}${constraints}</text>`);
      });
      
      svg.push('</g>');
    });

    svg.push('</svg>');
    
    return svg.join('\n');
  }

  /**
   * Export as PNG using canvas
   */
  static async exportPNG(
    tables: TableNode[],
    relationships: Relationship[],
    options: ExportOptions = {},
    filename: string = 'diagram.png'
  ): Promise<void> {
    const svgString = this.generateSVG(tables, relationships, options);
    
    // Create image from SVG
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Background (transparent or solid)
        if (!options.transparentBackground) {
          ctx.fillStyle = options.isDarkMode ? '#111827' : '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw image
        ctx.drawImage(img, 0, 0);
        
        // Export
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }
          
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          
          URL.revokeObjectURL(a.href);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG'));
      };
      
      img.src = url;
    });
  }

  /**
   * Export as SVG file
   */
  static exportSVG(
    tables: TableNode[],
    relationships: Relationship[],
    options: ExportOptions = {},
    filename: string = 'diagram.svg'
  ): void {
    const svgString = this.generateSVG(tables, relationships, options);
    
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Export diagram state as JSON
   */
  static exportJSON(
    tables: TableNode[],
    relationships: Relationship[],
    filename: string = 'diagram.json'
  ): void {
    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tables,
      relationships
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Escape XML special characters
   */
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}