/**
 * AppV2 - Redesigned SQLite ERD Application
 * Clean architecture with proper separation of concerns
 */

import React, { useCallback, useEffect, useState } from 'react';
import initSqlJs from 'sql.js';
import { format as formatFns } from 'date-fns';

import DiagramEngine from './components/DiagramEngine';
import ExportModal from './components/ExportModal';
import SqliteInput from './SqliteInput';
import ThemeToggle from './ThemeToggle';
import PrivacyNoticeToggle from './PrivacyNoticeToggle';
import useTheme from './useTheme';
import { useDiagramState } from './hooks/useDiagramState';
import { SchemaConverter } from './services/SchemaConverter';
import { ExportService, ExportOptions } from './services/ExportService';

import './App.css';

function AppV2() {
  const [engine, setEngine] = useState<initSqlJs.SqlJsStatic>();
  const [database, setDatabase] = useState<initSqlJs.Database>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  const { setTheme, isDarkMode } = useTheme();
  
  const {
    tables,
    relationships,
    isDirty,
    saveState,
    resetPositions,
    clearDiagram,
    setTables,
    setRelationships
  } = useDiagramState({
    persistKey: 'sqlite-erd-state'
  });

  // Initialize SQL.js engine
  useEffect(() => {
    const initEngine = async () => {
      try {
        const sql = await initSqlJs({
          locateFile: (file) => `/dist/sql.js/${file}`,
        });
        setEngine(sql);
      } catch (err) {
        setError('Failed to initialize SQL engine');
        console.error(err);
      }
    };
    
    initEngine();
  }, []);

  // Load database file
  const handleFile = useCallback(async (file: File) => {
    if (!engine) {
      setError('SQL engine not initialized');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      const db = new engine.Database(data);
      
      // Validate database
      db.exec("PRAGMA foreign_keys = ON;");
      const integrityCheck = db.exec("PRAGMA integrity_check;");
      
      if (integrityCheck[0]?.values[0][0] !== "ok") {
        throw new Error("Database integrity check failed");
      }
      
      setDatabase(db);
      
      // Convert schema to diagram format
      const executor = (query: string) => {
        const res = db.exec(query);
        return res.length > 0 ? res[0] : { columns: [], values: [] };
      };
      
      const { tables: newTables, relationships: newRelationships } = 
        SchemaConverter.convertDatabase(executor);
      
      setTables(newTables);
      setRelationships(newRelationships);
      
    } catch (err) {
      setError(`Failed to load database: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [engine, setTables, setRelationships]);

  // Export handler with options
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
      setError(`Failed to export ${format.toUpperCase()}`);
      console.error(err);
    }
  }, [tables, relationships]);

  // Quick export handlers (with default options)
  const handleQuickExportPNG = useCallback(async () => {
    await handleExport('png', { isDarkMode: isDarkMode() });
  }, [handleExport, isDarkMode]);

  const handleQuickExportSVG = useCallback(() => {
    handleExport('svg', { isDarkMode: isDarkMode() });
  }, [handleExport, isDarkMode]);

  const handleExportJSON = useCallback(() => {
    const timestamp = formatFns(new Date(), 'yyyyMMdd_HHmm');
    const filename = `sqlite_erd_${timestamp}.json`;
    
    try {
      ExportService.exportJSON(tables, relationships, filename);
    } catch (err) {
      setError('Failed to export JSON');
      console.error(err);
    }
  }, [tables, relationships]);

  const handleClear = useCallback(() => {
    setDatabase(undefined);
    clearDiagram();
    setError(null);
  }, [clearDiagram]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              SQLite ERD Generator
            </h1>
            <div className="flex items-center gap-4">
              {isDirty && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  ✓ Auto-saved
                </span>
              )}
              <ThemeToggle setTheme={setTheme} isDarkMode={isDarkMode} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Diagram or Upload */}
        {tables.length > 0 ? (
          <>
            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>🎨</span>
                <span>Advanced Export</span>
              </button>
              <button
                onClick={handleQuickExportPNG}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                📷 Quick PNG
              </button>
              <button
                onClick={handleQuickExportSVG}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                📐 Quick SVG
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                💾 Export Layout
              </button>
              <div className="flex-1" />
              <button
                onClick={resetPositions}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                🔄 Reset Layout
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                🗑️ Clear
              </button>
            </div>

            {/* Instructions */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Interactive Controls:</strong> Drag tables to reposition • 
                Ctrl+Scroll to zoom • Positions are auto-saved
              </p>
            </div>

            {/* Diagram */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
              <DiagramEngine
                tables={tables}
                relationships={relationships}
                isDarkMode={isDarkMode()}
                onStateChange={saveState}
              />
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <SqliteInput
              onUpload={handleFile}
              onError={setError}
            />
            {isLoading && (
              <div className="mt-4 text-center text-gray-600 dark:text-gray-400">
                Loading database...
              </div>
            )}
          </div>
        )}
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        isDarkMode={isDarkMode()}
      />

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-sm text-gray-600 dark:text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2">
            <p>
              © {new Date().getFullYear()} SQLite ERD Generator
            </p>
            <a
              href="https://github.com/Edwinexd/sqlite-erd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              GitHub
            </a>
            <PrivacyNoticeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default AppV2;