/**
 * AppOptimized - Lightweight, fast, and responsive version
 * Focuses on performance over excessive features
 */

import React, { useCallback, useEffect, useState, useMemo, memo } from 'react';
import initSqlJs from 'sql.js';
import { format as formatFns } from 'date-fns';

import DiagramEngine from './components/DiagramEngineOptimized';
import ExportModal from './components/ExportModal';
import SqliteInput from './SqliteInput';
import ThemeToggle from './ThemeToggle';
import useTheme from './useTheme';
import { SchemaConverter } from './services/SchemaConverter';
import { ExportService, ExportOptions } from './services/ExportService';

import './App.css';

// Memoized components to prevent unnecessary re-renders
const MemoizedDiagramEngine = memo(DiagramEngine);
const MemoizedExportModal = memo(ExportModal);

function AppOptimized() {
  const [engine, setEngine] = useState<initSqlJs.SqlJsStatic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const { setTheme, isDarkMode } = useTheme();
  
  // Use simple state instead of complex state management
  const [tables, setTables] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize SQL.js engine once
  useEffect(() => {
    let mounted = true;
    
    initSqlJs({
      locateFile: (file) => `/dist/sql.js/${file}`,
    }).then(sql => {
      if (mounted) setEngine(sql);
    }).catch(() => {
      if (mounted) setError('Failed to initialize SQL engine');
    });

    return () => { mounted = false; };
  }, []);

  // Simple file handler without excessive validation
  const handleFile = useCallback(async (file: File) => {
    if (!engine) {
      setError('SQL engine not ready');
      return;
    }

    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const db = new engine.Database(data);
      
      // Basic validation
      db.exec("PRAGMA foreign_keys = ON;");
      
      // Convert schema
      const executor = (query: string) => {
        const res = db.exec(query);
        return res.length > 0 ? res[0] : { columns: [], values: [] };
      };
      
      const { tables: newTables, relationships: newRelationships } = 
        SchemaConverter.convertDatabase(executor);
      
      setTables(newTables);
      setRelationships(newRelationships);
      db.close(); // Clean up
      
    } catch (err) {
      setError(`Failed to load database: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [engine]);

  // Optimized export handlers
  const handleExport = useCallback(async (format: 'png' | 'svg', options: ExportOptions) => {
    const timestamp = formatFns(new Date(), 'yyyyMMdd_HHmm');
    const suffix = options.academicStyle ? '_academic' : '';
    const filename = `sqlite_erd_${timestamp}${suffix}.${format}`;
    
    try {
      if (format === 'png') {
        await ExportService.exportPNG(tables, relationships, options, filename);
      } else {
        ExportService.exportSVG(tables, relationships, options, filename);
      }
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [tables, relationships]);

  // Simple state save without complex persistence
  const handleStateChange = useCallback(() => {
    setHasChanges(true);
    // Simple debounced save to localStorage
    if (window.saveTimeout) clearTimeout(window.saveTimeout);
    window.saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('erd-positions', JSON.stringify({ tables, relationships }));
        setHasChanges(false);
      } catch {
        // Ignore storage errors
      }
    }, 1000);
  }, [tables, relationships]);

  // Load saved positions
  useEffect(() => {
    try {
      const saved = localStorage.getItem('erd-positions');
      if (saved && tables.length === 0) {
        const data = JSON.parse(saved);
        if (data.tables?.length > 0) {
          setTables(data.tables);
          setRelationships(data.relationships || []);
        }
      }
    } catch {
      // Ignore load errors
    }
  }, []);

  const resetPositions = useCallback(() => {
    const resetTables = tables.map((table, index) => {
      const cols = Math.ceil(Math.sqrt(tables.length));
      const row = Math.floor(index / cols);
      const col = index % cols;
      return {
        ...table,
        x: col * 300 + 50,
        y: row * 250 + 50
      };
    });
    setTables(resetTables);
    localStorage.removeItem('erd-positions');
  }, [tables]);

  const clearDiagram = useCallback(() => {
    setTables([]);
    setRelationships([]);
    setError(null);
    localStorage.removeItem('erd-positions');
  }, []);

  // Memoize the diagram visibility check
  const showDiagram = useMemo(() => tables.length > 0, [tables.length]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Simple Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              SQLite ERD Generator
            </h1>
            <div className="flex items-center gap-4">
              {hasChanges && (
                <span className="text-sm text-green-600 dark:text-green-400">✓</span>
              )}
              <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {showDiagram ? (
          <>
            {/* Simple Toolbar */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Export
              </button>
              <button
                onClick={() => handleExport('png', { isDarkMode: isDarkMode() })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Quick PNG
              </button>
              <button
                onClick={resetPositions}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg"
              >
                Reset Layout
              </button>
              <button
                onClick={clearDiagram}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Clear
              </button>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Drag tables • Ctrl+Scroll to zoom
              </p>
            </div>

            {/* Diagram */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <MemoizedDiagramEngine
                tables={tables}
                relationships={relationships}
                isDarkMode={isDarkMode()}
                onStateChange={handleStateChange}
              />
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <SqliteInput onUpload={handleFile} onError={setError} />
          </div>
        )}
      </main>

      {/* Export Modal - Only render when open */}
      {showExportModal && (
        <MemoizedExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          isDarkMode={isDarkMode()}
        />
      )}
    </div>
  );
}

// Add window type declaration
declare global {
  interface Window {
    saveTimeout: any;
  }
}

export default AppOptimized;