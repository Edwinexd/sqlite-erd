/**
 * useDiagramState - Custom hook for managing diagram state
 * Handles persistence, import/export, and state management
 */

import { useState, useCallback, useEffect } from 'react';
import { TableNode, Relationship, DiagramState } from '../components/DiagramEngine';

interface UseDiagramStateProps {
  initialTables?: TableNode[];
  initialRelationships?: Relationship[];
  persistKey?: string;
}

interface ExportData {
  version: string;
  timestamp: string;
  tables: TableNode[];
  relationships: Relationship[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export const useDiagramState = ({
  initialTables = [],
  initialRelationships = [],
  persistKey = 'sqlite-erd-diagram-state'
}: UseDiagramStateProps = {}) => {
  const [tables, setTables] = useState<TableNode[]>(initialTables);
  const [relationships, setRelationships] = useState<Relationship[]>(initialRelationships);
  const [isDirty, setIsDirty] = useState(false);

  // Load persisted state
  useEffect(() => {
    if (!persistKey) return;
    
    try {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const data: ExportData = JSON.parse(saved);
        if (data.version === '1.0' && data.tables) {
          // Merge saved positions with current tables
          const positionMap = new Map(
            data.tables.map(t => [t.id, { x: t.x, y: t.y }])
          );
          
          setTables(prev => prev.map(table => ({
            ...table,
            x: positionMap.get(table.id)?.x ?? table.x,
            y: positionMap.get(table.id)?.y ?? table.y
          })));
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted diagram state:', error);
    }
  }, [persistKey]);

  // Save state changes
  const saveState = useCallback((state: DiagramState) => {
    const tablesArray = Array.from(state.tables.values());
    setTables(tablesArray);
    setIsDirty(true);
    
    if (persistKey) {
      const exportData: ExportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        tables: tablesArray,
        relationships: state.relationships,
        viewport: state.viewport
      };
      
      try {
        localStorage.setItem(persistKey, JSON.stringify(exportData));
      } catch (error) {
        console.warn('Failed to persist diagram state:', error);
      }
    }
  }, [persistKey]);

  // Export diagram as JSON
  const exportDiagram = useCallback((): string => {
    const exportData: ExportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      tables,
      relationships
    };
    
    return JSON.stringify(exportData, null, 2);
  }, [tables, relationships]);

  // Import diagram from JSON
  const importDiagram = useCallback((jsonString: string) => {
    try {
      const data: ExportData = JSON.parse(jsonString);
      if (data.version !== '1.0') {
        throw new Error('Unsupported diagram version');
      }
      
      setTables(data.tables);
      setRelationships(data.relationships);
      setIsDirty(true);
      
      return true;
    } catch (error) {
      console.error('Failed to import diagram:', error);
      return false;
    }
  }, []);

  // Reset to original positions
  const resetPositions = useCallback(() => {
    setTables(prev => prev.map((table, index) => {
      const cols = Math.ceil(Math.sqrt(prev.length));
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      return {
        ...table,
        x: col * 300 + 50,
        y: row * 250 + 50
      };
    }));
    setIsDirty(true);
    
    if (persistKey) {
      localStorage.removeItem(persistKey);
    }
  }, [persistKey]);

  // Clear all data
  const clearDiagram = useCallback(() => {
    setTables([]);
    setRelationships([]);
    setIsDirty(false);
    
    if (persistKey) {
      localStorage.removeItem(persistKey);
    }
  }, [persistKey]);

  return {
    tables,
    relationships,
    isDirty,
    saveState,
    exportDiagram,
    importDiagram,
    resetPositions,
    clearDiagram,
    setTables,
    setRelationships
  };
};