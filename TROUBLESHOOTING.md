# Troubleshooting Guide

## Common Issues and Solutions

### Export Issues

#### "Failed to parse SVG" Error
**Problem**: When trying to export as PNG, you get a "Failed to parse SVG" error.

**Solutions**:
1. **Try exporting as SVG instead**: The SVG export is more reliable and doesn't require parsing
2. **Reset positions first**: Click "Reset Positions" then try exporting again
3. **Clear and reload**: Click "Clear ERD" and upload your database again
4. **Check browser console**: Open developer tools (F12) and check for specific error messages

**Why it happens**: 
- The interactive modifications might create SVG structures that are harder to parse
- Some browsers handle SVG serialization differently

**Workaround**:
- Export as SVG (which always works)
- If you need PNG, you can convert the SVG to PNG using external tools or online converters

#### PNG Export Shows Blank or Incorrect Image
**Problem**: The exported PNG is blank or doesn't show the diagram correctly.

**Solutions**:
1. Try a different browser (Chrome, Firefox, or Edge recommended)
2. Ensure your browser is up to date
3. Try exporting without moving tables first
4. Use SVG export instead and convert to PNG externally

### Interactive Features Issues

#### Tables Won't Move
**Problem**: Clicking and dragging tables doesn't work.

**Solutions**:
1. Make sure you're clicking directly on the table (not the background)
2. Try refreshing the page
3. Check if JavaScript is enabled in your browser
4. Try a different browser

#### Zoom/Pan Not Working
**Problem**: Ctrl+Scroll or Shift+Drag doesn't zoom/pan.

**Solutions**:
1. **For Zoom**: Make sure you're holding Ctrl (or Cmd on Mac) while scrolling
2. **For Pan**: Make sure you're holding Shift while dragging, or use middle-click
3. Try using the zoom buttons on the right side instead
4. Check if your browser has any extensions that might interfere with keyboard shortcuts

#### Performance Issues with Large Diagrams
**Problem**: The diagram is slow or laggy when moving tables.

**Solutions**:
1. Try zooming out first before moving tables
2. Close other browser tabs to free up memory
3. Use a more powerful computer if available
4. Consider simplifying your database schema if possible

### Database Upload Issues

#### "Error reading database file"
**Problem**: Can't upload your SQLite database.

**Solutions**:
1. Ensure the file is a valid SQLite database (not corrupted)
2. Check that foreign key constraints are properly defined
3. Try opening the database in a SQLite browser first to verify it's valid
4. Make sure the file isn't too large (browser memory limitations)

#### "Semantic errors generating ERD"
**Problem**: Database uploads but shows semantic errors.

**Solutions**:
1. Check your foreign key definitions in the database
2. Ensure all foreign keys reference primary keys or unique indexes
3. Verify that column types match between related tables
4. You can disable semantic checks by adding `?semantics=false` to the URL

### Browser Compatibility

#### Recommended Browsers
- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Edge (latest)
- ✅ Safari (latest)

#### Known Issues
- **Internet Explorer**: Not supported (use Edge instead)
- **Older browsers**: May have issues with SVG manipulation

### General Tips

#### Best Practices
1. **Start with original layout**: View the auto-generated layout before making changes
2. **Save your work**: Export your diagram regularly (SVG format recommended)
3. **Use SVG for editing**: SVG files can be opened in vector graphics editors for further customization
4. **Test with small databases first**: Verify functionality with a simple database before using complex ones

#### Keyboard Shortcuts
- **Ctrl/Cmd + Scroll**: Zoom in/out
- **Shift + Drag**: Pan the diagram
- **Middle-click + Drag**: Pan the diagram (alternative)

#### Performance Tips
- Close unnecessary browser tabs
- Use the latest browser version
- Disable browser extensions that might interfere
- For very large diagrams, consider splitting your database

### Getting Help

If you continue to experience issues:

1. **Check the browser console** (F12 → Console tab) for error messages
2. **Try a different browser** to isolate browser-specific issues
3. **Report the issue** on GitHub with:
   - Browser name and version
   - Operating system
   - Steps to reproduce the problem
   - Any error messages from the console
   - Screenshot if applicable

### Workarounds

#### If PNG Export Fails
1. Export as SVG
2. Use an online converter (e.g., CloudConvert, Convertio)
3. Use a graphics editor (Inkscape, Adobe Illustrator)
4. Use command-line tools (ImageMagick, rsvg-convert)

Example with ImageMagick:
```bash
magick convert input.svg output.png
```

#### If Interactive Features Don't Work
1. Use the original static view (refresh the page)
2. Take a screenshot of the diagram
3. Export as SVG and edit in a vector graphics editor

### Debug Mode

To enable debug mode, add `?debug=true` to the URL:
```
http://localhost:3000/?debug=true
```

This will log additional information to the browser console.

### URL Parameters

Available URL parameters:
- `?semantics=false` - Disable semantic checks
- `?debug=true` - Enable debug logging
- `?actions=true` - Show foreign key actions in diagram
- `?includeViews=true` - Include database views
- `?includeDataCounts=true` - Show row counts

Example:
```
http://localhost:3000/?semantics=false&debug=true
```

## Still Having Issues?

If none of these solutions work:
1. Clear your browser cache and cookies
2. Try incognito/private browsing mode
3. Restart your browser
4. Restart your computer
5. Report the issue on GitHub with detailed information
