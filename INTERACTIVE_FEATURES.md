# Interactive ERD Features

## Overview
This SQLite ERD generator now includes interactive features that allow you to customize the layout of your database diagrams by dragging and repositioning tables.

## Features

### 1. **Drag and Drop Tables**
- Click and hold any table in the diagram
- Drag it to your desired position
- Release to place the table
- Visual feedback shows which table is being moved

### 2. **Export with Custom Layout**
- **Export as PNG**: Downloads the diagram with your custom table positions as a PNG image
- **Export as SVG**: Downloads the diagram with your custom table positions as an SVG file
- Both export formats preserve your modifications

### 3. **Reset Positions**
- Click the "Reset Positions" button to restore all tables to their original auto-generated positions
- Useful if you want to start over with the layout

### 4. **Visual Feedback**
- Tables highlight when you hover over them
- Active table being dragged shows a label at the top of the screen
- Smooth transitions for better user experience

## Usage Instructions

1. **Upload your SQLite database file**
   - The ERD will be generated automatically

2. **Customize the layout**
   - Click and drag any table to reposition it
   - Arrange tables in a way that makes sense for your use case

3. **Export your diagram**
   - Click "Export as PNG" for a raster image (good for presentations, documents)
   - Click "Export as SVG" for a vector image (good for further editing, scalable)
   - Your custom positions will be preserved in the export

4. **Reset if needed**
   - Click "Reset Positions" to return to the original layout
   - Click "Clear ERD" to remove the diagram and start over

## Technical Details

### Implementation
- Built with React and TypeScript
- Uses native SVG manipulation for smooth performance
- No external drag-and-drop libraries required for the core functionality
- Responsive design works on various screen sizes

### Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Best experience on desktop/laptop devices

### Performance
- Optimized for diagrams with dozens of tables
- Real-time position updates
- Efficient SVG serialization for export

## Production-Level Features

1. **Error Handling**
   - Graceful handling of invalid database files
   - Clear error messages for users

2. **Accessibility**
   - Keyboard navigation support
   - Screen reader friendly
   - High contrast mode support

3. **Responsive Design**
   - Works on different screen sizes
   - Touch-friendly for tablet devices
   - Scrollable container for large diagrams

4. **State Management**
   - Preserves modifications during theme changes
   - Efficient re-rendering
   - Clean state reset functionality

## Future Enhancements (Potential)

- Save/load custom layouts
- Zoom and pan functionality
- Grid snapping for precise alignment
- Undo/redo functionality
- Export to additional formats (PDF, etc.)
- Collaborative editing features

## License

This feature is part of the SQLite ERD project and is licensed under GPL-3.0.
