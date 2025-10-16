/**
 * AppProduction - Production-grade application wrapper
 * Integrates all enterprise features and services
 */

import React, { useCallback, useEffect, useState, Suspense, lazy } from 'react';
import { ErrorBoundary } from './services/ErrorBoundary';
import { ErrorLogger } from './services/ErrorLogger';
import { ValidationService } from './services/ValidationService';
import { CacheService } from './services/CacheService';
import { AnalyticsService } from './services/AnalyticsService';
import initSqlJs from 'sql.js';
import { format as formatFns } from 'date-fns';

// Lazy load heavy components for better performance
const DiagramEngine = lazy(() => import('./components/DiagramEngine'));
const ExportModal = lazy(() => import('./components/ExportModal'));

import SqliteInput from './SqliteInput';
import ThemeToggle from './ThemeToggle';
import PrivacyNoticeToggle from './PrivacyNoticeToggle';
import useTheme from './useTheme';
import { useDiagramState } from './hooks/useDiagramState';
import { SchemaConverter } from './services/SchemaConverter';
import { ExportService, ExportOptions } from './services/ExportService';

import './App.css';

// Loading component
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
);

// Performance monitoring component
const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        const memory = (performance as any).memory;
        if (memory) {
          setMetrics({
            usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2),
            totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2),
            limit: (memory.jsHeapSizeLimit / 1048576).toFixed(2)
          });
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, []);

  if (!metrics || process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white text-xs p-2 rounded">
      <div>Memory: {metrics.usedJSHeapSize}MB / {metrics.totalJSHeapSize}MB</div>
      <div>Limit: {metrics.limit}MB</div>
    </div>
  );
};

function AppProduction() {
  const [engine, setEngine] = useState<initSqlJs.SqlJsStatic>();
  const [database, setDatabase] = useState<initSqlJs.Database>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
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

  // Initialize SQL.js engine with caching
  useEffect(() => {
    const initEngine = async () => {
      const stopTiming = AnalyticsService.startTiming('InitSQLEngine');
      
      try {
        // Try to get from cache first
        const cached = await CacheService.cacheAsync(
          'sql-engine',
          async () => {
            const sql = await initSqlJs({
              locateFile: (file) => `/dist/sql.js/${file}`,
            });
            return sql;
          },
          { ttl: 3600000, storage: 'session' } // Cache for 1 hour
        );
        
        setEngine(cached);
        AnalyticsService.track('Engine', 'Initialized');
      } catch (err) {
        const errorMessage = 'Failed to initialize SQL engine';
        setError(errorMessage);
        ErrorLogger.logError({
          error: err as Error,
          errorId: ErrorLogger.generateErrorId(),
          context: 'InitEngine',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
      } finally {
        stopTiming();
      }
    };
    
    initEngine();
  }, []);

  // Load database file with validation
  const handleFile = useCallback(async (file: File) => {
    if (!engine) {
      setError('SQL engine not initialized');
      return;
    }

    const stopTiming = AnalyticsService.startTiming('LoadDatabase');
    setIsLoading(true);
    setError(null);
    setValidationWarnings([]);

    try {
      // Validate file first
      const validation = await ValidationService.validateDatabaseFile(file);
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        AnalyticsService.track('Database', 'ValidationFailed', file.name);
        return;
      }

      if (validation.warnings.length > 0) {
        setValidationWarnings(validation.warnings);
      }

      // Load database with performance monitoring
      const result = await ErrorLogger.measurePerformance(
        'LoadDatabase',
        async () => {
          const buffer = await file.arrayBuffer();
          const data = new Uint8Array(buffer);
          
          const db = new engine.Database(data);
          
          // Validate database
          db.exec("PRAGMA foreign_keys = ON;");
          const integrityCheck = db.exec("PRAGMA integrity_check;");
          
          if (integrityCheck[0]?.values[0][0] !== "ok") {
            throw new Error("Database integrity check failed");
          }
          
          return db;
        },
        { fileSize: file.size, fileName: file.name }
      );

      setDatabase(result);
      
      // Convert schema to diagram format with caching
      const cacheKey = `schema_${file.name}_${file.lastModified}`;
      const schemaData = CacheService.get<{ tables: any[], relationships: any[] }>(cacheKey, { storage: 'session' });
      
      let newTables, newRelationships;
      
      if (schemaData) {
        ({ tables: newTables, relationships: newRelationships } = schemaData);
        AnalyticsService.track('Cache', 'Hit', 'Schema');
      } else {
        const executor = (query: string) => {
          const res = result.exec(query);
          return res.length > 0 ? res[0] : { columns: [], values: [] };
        };
        
        ({ tables: newTables, relationships: newRelationships } = 
          SchemaConverter.convertDatabase(executor));
        
        CacheService.set(cacheKey, { tables: newTables, relationships: newRelationships }, {
          storage: 'session',
          ttl: 3600000 // 1 hour
        });
        
        AnalyticsService.track('Cache', 'Miss', 'Schema');
      }
      
      // Validate diagram
      const diagramValidation = ValidationService.validateDiagram(newTables, newRelationships);
      if (diagramValidation.warnings.length > 0) {
        setValidationWarnings(prev => [...prev, ...diagramValidation.warnings]);
      }
      
      setTables(newTables);
      setRelationships(newRelationships);
      
      AnalyticsService.trackFeature('DatabaseLoaded', {
        tables: newTables.length,
        relationships: newRelationships.length,
        fileSize: file.size
      });
      
    } catch (err) {
      const errorMessage = `Failed to load database: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMessage);
      
      ErrorLogger.logError({
        error: err as Error,
        errorId: ErrorLogger.generateErrorId(),
        context: 'LoadDatabase',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        additionalData: { fileName: file.name, fileSize: file.size }
      });
      
      AnalyticsService.trackError(err as Error, { fileName: file.name });
    } finally {
      setIsLoading(false);
      stopTiming();
    }
  }, [engine, setTables, setRelationships]);

  // Export handler with analytics
  const handleExport = useCallback(async (format: 'png' | 'svg', options: ExportOptions) => {
    const stopTiming = AnalyticsService.startTiming(`Export${format.toUpperCase()}`);
    
    // Validate export options
    const validation = ValidationService.validateExportOptions(options);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    const timestamp = formatFns(new Date(), 'yyyyMMdd_HHmm');
    const suffix = options.academicStyle ? '_academic' : '';
    const filename = `sqlite_erd_${timestamp}${suffix}.${format}`;
    
    try {
      await ErrorLogger.measurePerformance(
        `Export${format.toUpperCase()}`,
        async () => {
          if (format === 'png') {
            await ExportService.exportPNG(tables, relationships, options, filename);
          } else {
            ExportService.exportSVG(tables, relationships, options, filename);
          }
        },
        { format, options }
      );
      
      AnalyticsService.trackFeature(`Export${format.toUpperCase()}`, {
        academicStyle: options.academicStyle,
        transparentBackground: options.transparentBackground,
        tableCount: tables.length
      });
      
    } catch (err) {
      const errorMessage = `Failed to export ${format.toUpperCase()}`;
      setError(errorMessage);
      
      ErrorLogger.logError({
        error: err as Error,
        errorId: ErrorLogger.generateErrorId(),
        context: `Export${format.toUpperCase()}`,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        additionalData: { format, options }
      });
      
      AnalyticsService.trackError(err as Error, { format });
    } finally {
      stopTiming();
    }
  }, [tables, relationships]);

  // Quick export handlers
  const handleQuickExportPNG = useCallback(async () => {
    await handleExport('png', { isDarkMode: isDarkMode() });
  }, [handleExport, isDarkMode]);

  const handleQuickExportSVG = useCallback(() => {
    handleExport('svg', { isDarkMode: isDarkMode() });
  }, [handleExport, isDarkMode]);

  const handleExportJSON = useCallback(() => {
    const stopTiming = AnalyticsService.startTiming('ExportJSON');
    const timestamp = formatFns(new Date(), 'yyyyMMdd_HHmm');
    const filename = `sqlite_erd_${timestamp}.json`;
    
    try {
      ExportService.exportJSON(tables, relationships, filename);
      AnalyticsService.trackFeature('ExportJSON');
    } catch (err) {
      setError('Failed to export JSON');
      ErrorLogger.logError({
        error: err as Error,
        errorId: ErrorLogger.generateErrorId(),
        context: 'ExportJSON',
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    } finally {
      stopTiming();
    }
  }, [tables, relationships]);

  const handleClear = useCallback(() => {
    setDatabase(undefined);
    clearDiagram();
    setError(null);
    setValidationWarnings([]);
    CacheService.clear('session');
    AnalyticsService.track('Diagram', 'Cleared');
  }, [clearDiagram]);

  const handleResetPositions = useCallback(() => {
    resetPositions();
    AnalyticsService.track('Diagram', 'ResetPositions');
  }, [resetPositions]);

  // Track page view
  useEffect(() => {
    AnalyticsService.trackPageView('Main');
  }, []);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                SQLite ERD Generator
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">v2.0 Production</span>
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

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warnings:</p>
              <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Diagram or Upload */}
          {tables.length > 0 ? (
            <>
              {/* Toolbar */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setShowExportModal(true);
                    AnalyticsService.track('UI', 'OpenExportModal');
                  }}
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
                  onClick={handleResetPositions}
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
                  Ctrl+Scroll to zoom • Positions are auto-saved • 
                  <button
                    onClick={() => {
                      const logs = ErrorLogger.exportLogs();
                      const blob = new Blob([logs], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'debug_logs.json';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="underline ml-2"
                  >
                    Export Debug Logs
                  </button>
                </p>
              </div>

              {/* Diagram */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
                <Suspense fallback={<LoadingSpinner />}>
                  <DiagramEngine
                    tables={tables}
                    relationships={relationships}
                    isDarkMode={isDarkMode()}
                    onStateChange={saveState}
                  />
                </Suspense>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <SqliteInput
                onUpload={handleFile}
                onError={setError}
              />
              {isLoading && <LoadingSpinner />}
            </div>
          )}
        </main>

        {/* Export Modal */}
        <Suspense fallback={null}>
          {showExportModal && (
            <ExportModal
              isOpen={showExportModal}
              onClose={() => {
                setShowExportModal(false);
                AnalyticsService.track('UI', 'CloseExportModal');
              }}
              onExport={handleExport}
              isDarkMode={isDarkMode()}
            />
          )}
        </Suspense>

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
                onClick={() => AnalyticsService.track('Link', 'Click', 'GitHub')}
              >
                GitHub
              </a>
              <PrivacyNoticeToggle />
              <button
                onClick={() => {
                  const summary = AnalyticsService.getSummary();
                  console.log('Analytics Summary:', summary);
                  alert(`Session: ${summary.sessionId}\nEvents: ${summary.totalEvents}\nFeatures: ${summary.featuresUsed.join(', ')}`);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Analytics
              </button>
            </div>
          </div>
        </footer>

        {/* Performance Monitor (dev only) */}
        <PerformanceMonitor />
      </div>
    </ErrorBoundary>
  );
}

export default AppProduction;