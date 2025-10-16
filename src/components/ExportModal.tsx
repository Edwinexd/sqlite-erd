/**
 * ExportModal - Advanced export options for diagrams
 * Supports transparent backgrounds and academic styling
 */

import React, { useState } from 'react';
import { ExportOptions } from '../services/ExportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'png' | 'svg', options: ExportOptions) => void;
  isDarkMode: boolean;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  isDarkMode
}) => {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [options, setOptions] = useState<ExportOptions>({
    isDarkMode,
    transparentBackground: false,
    showCardinality: true,
    showConstraints: false,
    academicStyle: false
  });

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(format, options);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Export Options
        </h2>
        
        {/* Format Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Export Format
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="png"
                checked={format === 'png'}
                onChange={(e) => setFormat(e.target.value as 'png')}
                className="mr-2"
              />
              <span className="text-gray-900 dark:text-white">PNG Image</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="svg"
                checked={format === 'svg'}
                onChange={(e) => setFormat(e.target.value as 'svg')}
                className="mr-2"
              />
              <span className="text-gray-900 dark:text-white">SVG Vector</span>
            </label>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4 mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.transparentBackground}
              onChange={(e) => setOptions({...options, transparentBackground: e.target.checked})}
              className="mr-3"
            />
            <div>
              <span className="text-gray-900 dark:text-white font-medium">
                Transparent Background
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Export without background color (useful for presentations)
              </p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.academicStyle}
              onChange={(e) => setOptions({...options, academicStyle: e.target.checked})}
              className="mr-3"
            />
            <div>
              <span className="text-gray-900 dark:text-white font-medium">
                IEEE Academic Style
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Formal styling suitable for academic papers and reports
              </p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.showCardinality}
              onChange={(e) => setOptions({...options, showCardinality: e.target.checked})}
              className="mr-3"
            />
            <div>
              <span className="text-gray-900 dark:text-white font-medium">
                Show Cardinality
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Display 1:N, 1:1, M:N relationship notations
              </p>
            </div>
          </label>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={options.showConstraints}
              onChange={(e) => setOptions({...options, showConstraints: e.target.checked})}
              className="mr-3"
            />
            <div>
              <span className="text-gray-900 dark:text-white font-medium">
                Show Constraints
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Display NOT NULL, UNIQUE constraints
              </p>
            </div>
          </label>
        </div>

        {/* Preview Note */}
        {options.academicStyle && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Academic Style:</strong> Uses Times New Roman font, black lines, 
              formal notation (PK/FK), and sharp corners suitable for IEEE publications.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Export {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;