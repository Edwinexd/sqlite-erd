/**
 * SchemaConverter - Converts SQLite schema to diagram format
 * Clean separation between data source and visualization
 */

import { QueryExecResult } from 'sql.js';
import { TableNode, TableColumn, Relationship } from '../components/DiagramEngine';

interface SQLiteColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface SQLiteForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export class SchemaConverter {
  /**
   * Convert SQLite database to diagram format
   */
  static convertDatabase(
    executor: (query: string) => QueryExecResult
  ): { tables: TableNode[], relationships: Relationship[] } {
    const tables: TableNode[] = [];
    const relationships: Relationship[] = [];
    
    try {
      // Get all tables
      const tablesResult = executor(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      );
      
      if (!tablesResult.values) {
        return { tables: [], relationships: [] };
      }
      
      // Process each table
      tablesResult.values.forEach((row, tableIndex) => {
        const tableName = row[0] as string;
        
        // Get columns
        const columnsResult = executor(`PRAGMA table_info("${tableName}")`);
        const columns: TableColumn[] = [];
        const primaryKeys: Set<string> = new Set();
        
        if (columnsResult.values) {
          columnsResult.values.forEach((colRow) => {
            const col: SQLiteColumn = {
              name: colRow[1] as string,
              type: colRow[2] as string || 'ANY',
              notnull: colRow[3] as number,
              dflt_value: colRow[4],
              pk: colRow[5] as number
            };
            
            if (col.pk > 0) {
              primaryKeys.add(col.name);
            }
            
            columns.push({
              name: col.name,
              type: col.type,
              isPrimaryKey: col.pk > 0,
              nullable: col.notnull === 0
            });
          });
        }
        
        // Get foreign keys
        const foreignKeysResult = executor(`PRAGMA foreign_key_list("${tableName}")`);
        const foreignKeyColumns: Set<string> = new Set();
        
        if (foreignKeysResult.values) {
          const fkMap: Map<number, SQLiteForeignKey[]> = new Map();
          
          foreignKeysResult.values.forEach((fkRow) => {
            const fk: SQLiteForeignKey = {
              id: fkRow[0] as number,
              seq: fkRow[1] as number,
              table: fkRow[2] as string,
              from: fkRow[3] as string,
              to: fkRow[4] as string,
              on_update: fkRow[5] as string,
              on_delete: fkRow[6] as string
            };
            
            if (!fkMap.has(fk.id)) {
              fkMap.set(fk.id, []);
            }
            fkMap.get(fk.id)!.push(fk);
            foreignKeyColumns.add(fk.from);
            
            // Create relationship
            relationships.push({
              id: `${tableName}_${fk.from}_${fk.table}_${fk.to}`,
              fromTable: tableName,
              fromColumn: fk.from,
              toTable: fk.table,
              toColumn: fk.to,
              type: primaryKeys.has(fk.from) ? 'one-to-one' : 'one-to-many'
            });
          });
        }
        
        // Mark foreign key columns
        columns.forEach(col => {
          if (foreignKeyColumns.has(col.name)) {
            col.isForeignKey = true;
          }
        });
        
        // Calculate initial position (will be auto-layouted)
        tables.push({
          id: tableName,
          name: tableName,
          columns,
          x: 0,
          y: 0
        });
      });
      
    } catch (error) {
      console.error('Error converting database schema:', error);
    }
    
    return { tables, relationships };
  }
  
  /**
   * Import from DOT notation (for compatibility)
   */
  static importFromDot(dotString: string): { tables: TableNode[], relationships: Relationship[] } {
    // This would parse DOT notation if needed for backward compatibility
    // For now, return empty as we're moving away from DOT
    console.warn('DOT import not yet implemented in new architecture');
    return { tables: [], relationships: [] };
  }
}