# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - Interactive Features Update

### Added
- **Interactive Table Positioning**: Tables can now be dragged and repositioned within the ERD
  - Click and drag any table to move it
  - Visual feedback shows which table is being moved
  - Hover effects on tables for better UX
  
- **Zoom and Pan Controls**:
  - Zoom in/out using Ctrl+Scroll or dedicated zoom buttons
  - Pan the diagram using Shift+Drag or middle-click
  - Visual zoom percentage indicator
  - Reset view button to restore default zoom and pan
  
- **Enhanced Export Functionality**:
  - Export as SVG: New option to export diagrams as scalable vector graphics
  - Modified layouts are preserved in both PNG and SVG exports
  - Timestamped filenames for better organization
  
- **Reset Positions Button**: Restore all tables to their original auto-generated positions
  
- **User Interface Improvements**:
  - Interactive mode banner with usage instructions
  - Status indicators for dragging and panning operations
  - Helpful tooltips and keyboard shortcuts display
  - Improved button styling with hover effects and transitions
  - Responsive design for various screen sizes
  
- **Production-Level Features**:
  - Smooth animations and transitions
  - Efficient SVG manipulation
  - Real-time position updates
  - Clean state management
  - Error handling and edge case coverage

### Changed
- Updated main container to be full-width for better diagram visibility
- Enhanced button layout with better spacing and wrapping
- Improved visual feedback for all interactive elements
- Changed button text from "Download ERD (PNG)" to "Export as PNG" for clarity

### Technical Improvements
- Added TypeScript interfaces for better type safety
- Implemented efficient event listeners with proper cleanup
- Optimized SVG serialization for export
- Added support for touch devices (tablets)
- Improved accessibility with ARIA labels and keyboard navigation

### Documentation
- Created INTERACTIVE_FEATURES.md with detailed feature documentation
- Updated README.md with new features and usage instructions
- Added inline code comments for maintainability

## Previous Versions
See git history for changes prior to this update.
