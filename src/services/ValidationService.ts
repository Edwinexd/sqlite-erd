/**
 * ValidationService - Input validation and sanitization
 * Production-grade data validation
 */

import { TableNode, Relationship } from '../components/DiagramEngine';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class ValidationService {
  /**
   * Validate SQLite database file
   */
  static async validateDatabaseFile(file: File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size (max 100MB for web)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (100MB)`);
    }

    // Check file type
    const validTypes = ['application/x-sqlite3', 'application/vnd.sqlite3', 'application/octet-stream'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      warnings.push('File may not be a valid SQLite database based on extension');
    }

    // Check file name for suspicious patterns
    if (!/^[\w\-. ]+$/.test(file.name)) {
      warnings.push('File name contains special characters');
    }

    // Read file header to verify SQLite format
    try {
      const header = await this.readFileHeader(file);
      if (!header.startsWith('SQLite format 3')) {
        errors.push('File does not appear to be a valid SQLite database');
      }
    } catch (e) {
      errors.push('Failed to read file header');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Read file header
   */
  private static async readFileHeader(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const blob = file.slice(0, 16);
      
      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        const header = String.fromCharCode(...bytes);
        resolve(header);
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * Validate table structure
   */
  static validateTable(table: TableNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate table name
    if (!table.name || table.name.trim().length === 0) {
      errors.push('Table name is required');
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table.name)) {
      warnings.push(`Table name "${table.name}" contains special characters`);
    }

    // Validate columns
    if (!table.columns || table.columns.length === 0) {
      errors.push('Table must have at least one column');
    } else {
      const columnNames = new Set<string>();
      let hasPrimaryKey = false;

      table.columns.forEach((col, index) => {
        // Check for duplicate column names
        if (columnNames.has(col.name)) {
          errors.push(`Duplicate column name: ${col.name}`);
        }
        columnNames.add(col.name);

        // Check column name validity
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col.name)) {
          warnings.push(`Column name "${col.name}" contains special characters`);
        }

        // Check for primary key
        if (col.isPrimaryKey) {
          hasPrimaryKey = true;
        }

        // Validate data type
        if (!col.type || col.type.trim().length === 0) {
          errors.push(`Column ${col.name} has no data type`);
        }
      });

      if (!hasPrimaryKey) {
        warnings.push('Table has no primary key defined');
      }
    }

    // Validate position
    if (table.x < 0 || table.y < 0) {
      warnings.push('Table position is negative');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate relationship
   */
  static validateRelationship(
    relationship: Relationship,
    tables: Map<string, TableNode>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if tables exist
    const fromTable = tables.get(relationship.fromTable);
    const toTable = tables.get(relationship.toTable);

    if (!fromTable) {
      errors.push(`Source table "${relationship.fromTable}" not found`);
    }
    if (!toTable) {
      errors.push(`Target table "${relationship.toTable}" not found`);
    }

    // Check if columns exist
    if (fromTable) {
      const hasColumn = fromTable.columns.some(col => col.name === relationship.fromColumn);
      if (!hasColumn) {
        errors.push(`Column "${relationship.fromColumn}" not found in table "${relationship.fromTable}"`);
      }
    }

    if (toTable) {
      const hasColumn = toTable.columns.some(col => col.name === relationship.toColumn);
      if (!hasColumn) {
        errors.push(`Column "${relationship.toColumn}" not found in table "${relationship.toTable}"`);
      }
    }

    // Check for self-referencing relationships
    if (relationship.fromTable === relationship.toTable) {
      warnings.push('Self-referencing relationship detected');
    }

    // Validate relationship type
    const validTypes = ['one-to-one', 'one-to-many', 'many-to-many'];
    if (!validTypes.includes(relationship.type)) {
      errors.push(`Invalid relationship type: ${relationship.type}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate entire diagram
   */
  static validateDiagram(
    tables: TableNode[],
    relationships: Relationship[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const tableMap = new Map(tables.map(t => [t.id, t]));

    // Validate all tables
    tables.forEach(table => {
      const result = this.validateTable(table);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    });

    // Validate all relationships
    relationships.forEach(rel => {
      const result = this.validateRelationship(rel, tableMap);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    });

    // Check for orphaned tables (no relationships)
    const connectedTables = new Set<string>();
    relationships.forEach(rel => {
      connectedTables.add(rel.fromTable);
      connectedTables.add(rel.toTable);
    });

    tables.forEach(table => {
      if (!connectedTables.has(table.id) && relationships.length > 0) {
        warnings.push(`Table "${table.name}" has no relationships`);
      }
    });

    // Check for circular dependencies
    const cycles = this.detectCycles(relationships);
    if (cycles.length > 0) {
      warnings.push(`Circular dependencies detected: ${cycles.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detect circular dependencies
   */
  private static detectCycles(relationships: Relationship[]): string[] {
    const graph = new Map<string, Set<string>>();
    const cycles: string[] = [];

    // Build adjacency list
    relationships.forEach(rel => {
      if (!graph.has(rel.fromTable)) {
        graph.set(rel.fromTable, new Set());
      }
      graph.get(rel.fromTable)!.add(rel.toTable);
    });

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string, path: string[] = []): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, [...path])) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          const cycle = [...path.slice(cycleStart), neighbor];
          cycles.push(cycle.join(' -> '));
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }

    return cycles;
  }

  /**
   * Sanitize user input
   */
  static sanitizeInput(input: string): string {
    // Remove potentially dangerous characters
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Validate export options
   */
  static validateExportOptions(options: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate boolean options
    const booleanFields = ['isDarkMode', 'transparentBackground', 'showCardinality', 'showConstraints', 'academicStyle'];
    booleanFields.forEach(field => {
      if (options[field] !== undefined && typeof options[field] !== 'boolean') {
        errors.push(`${field} must be a boolean value`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}