# IEEE Academic Export Features

## Overview

The SQLite ERD Generator now includes professional export options specifically designed for academic publications, IEEE papers, and technical reports. These features ensure your database diagrams meet the strict formatting requirements of academic journals and conferences.

## 🎓 Academic Export Features

### 1. **Transparent Background Export**
- **Purpose**: Essential for embedding diagrams in LaTeX documents, presentations, and papers
- **Benefits**: 
  - No white/dark background conflicts with document themes
  - Professional appearance in any document
  - Smaller file sizes for publications
- **Formats**: Available for both PNG and SVG exports

### 2. **IEEE Academic Style**
- **Typography**: Times New Roman serif font (standard for IEEE publications)
- **Lines**: Black lines with 1pt width (meets IEEE standards)
- **Notation**: 
  - PK/FK notation instead of emoji icons
  - Formal cardinality notation (1, N, M)
  - Sharp corners (no rounded rectangles)
- **Colors**: Monochrome palette suitable for black & white printing

### 3. **Cardinality Display**
- **Standard Notations**:
  - `1:1` - One-to-One relationships
  - `1:N` - One-to-Many relationships
  - `M:N` - Many-to-Many relationships
- **Crow's Foot Notation**: Professional relationship symbols
- **Position**: Clear labeling at relationship endpoints

### 4. **Constraint Visibility**
- **NOT NULL**: Displayed inline with column types
- **UNIQUE**: Shown as constraint annotation
- **PRIMARY KEY**: PK prefix notation
- **FOREIGN KEY**: FK prefix notation
- **Default Values**: Optional display

## 📊 Export Options Interface

### Advanced Export Modal

The new export modal provides granular control over output:

```
┌─────────────────────────────────┐
│ Export Options                   │
├─────────────────────────────────┤
│ Format:                          │
│ ○ PNG Image  ○ SVG Vector       │
│                                  │
│ ☐ Transparent Background         │
│ ☐ IEEE Academic Style            │
│ ☐ Show Cardinality              │
│ ☐ Show Constraints              │
│                                  │
│ [Cancel]  [Export]               │
└─────────────────────────────────┘
```

## 🔧 Technical Implementation

### Export Service Architecture

```typescript
interface ExportOptions {
  isDarkMode?: boolean;
  transparentBackground?: boolean;
  showCardinality?: boolean;
  showConstraints?: boolean;
  academicStyle?: boolean;
}
```

### SVG Generation

The system generates clean SVG without parsing:
- Direct string building (no DOM manipulation)
- Proper XML escaping
- IEEE-compliant styling
- Transparent background support

### PNG Export

Canvas-based rendering with:
- Optional transparent background
- High DPI support (2x resolution)
- Anti-aliasing for text clarity
- Proper font rendering

## 📐 IEEE Compliance

### Typography Standards
- **Title Font**: Times New Roman, 12pt, Bold
- **Column Names**: Times New Roman, 11pt, Regular
- **Data Types**: Times New Roman, 10pt, Italic
- **Constraints**: Times New Roman, 10pt, Regular

### Line Standards
- **Table Borders**: 1pt solid black
- **Relationships**: 1pt solid black
- **No shadows or gradients**
- **No colored elements** (monochrome only)

### Notation Standards
- **Primary Keys**: "PK" prefix
- **Foreign Keys**: "FK" prefix
- **Cardinality**: Standard mathematical notation
- **No decorative elements**

## 🎯 Use Cases

### 1. **Academic Papers**
```latex
\begin{figure}[h]
  \centering
  \includegraphics[width=\textwidth]{erd_academic.png}
  \caption{Database Schema for the Proposed System}
  \label{fig:database-schema}
\end{figure}
```

### 2. **Technical Documentation**
- Software architecture documents
- System design specifications
- Database documentation
- API documentation

### 3. **Presentations**
- Transparent backgrounds for slide templates
- High-resolution exports for projectors
- Vector formats for scaling

### 4. **Thesis & Dissertations**
- Meets university formatting requirements
- Print-ready quality
- Consistent styling throughout document

## 💡 Best Practices

### For IEEE Publications

1. **Always use Academic Style** when submitting to IEEE conferences/journals
2. **Enable Transparent Background** for LaTeX integration
3. **Show Cardinality** for complete relationship documentation
4. **Export as SVG** for vector graphics in PDF generation

### For Print Publications

1. **Disable Transparent Background** for standalone figures
2. **Use PNG at 300 DPI** for print quality
3. **Enable Constraints** for comprehensive documentation
4. **Test in grayscale** to ensure readability

### For Digital Documents

1. **Use SVG format** for scalability
2. **Enable Transparent Background** for flexibility
3. **Consider file size** - PNG may be smaller for complex diagrams
4. **Test zoom levels** for readability

## 🔍 Quality Assurance

### Export Checklist

- [ ] **Font Rendering**: All text is legible at target size
- [ ] **Line Quality**: No pixelation or artifacts
- [ ] **Transparency**: Background properly transparent (if selected)
- [ ] **Completeness**: All relationships and constraints visible
- [ ] **Standards**: Meets target publication requirements

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Fonts not rendering correctly | Ensure Times New Roman is available on system |
| PNG has white background | Enable "Transparent Background" option |
| Diagram too large for page | Use SVG and scale in document |
| Text too small | Adjust diagram layout before export |

## 📚 Citation

When using diagrams in academic publications:

```bibtex
@software{sqlite_erd_generator,
  title = {SQLite ERD Generator},
  author = {Sundberg, Edwin},
  year = {2024},
  url = {https://github.com/Edwinexd/sqlite-erd},
  license = {GPL-3.0}
}
```

## 🚀 Future Enhancements

- [ ] **Chen Notation**: Alternative ER diagram notation
- [ ] **UML Class Diagrams**: Object-oriented representation
- [ ] **IDEF1X Notation**: Information modeling standard
- [ ] **Custom Templates**: Save/load export presets
- [ ] **Batch Export**: Multiple formats at once
- [ ] **Resolution Presets**: Common publication requirements
- [ ] **Color Blind Mode**: Accessible color schemes
- [ ] **LaTeX Integration**: Direct .tex file generation

## 📖 References

1. IEEE Author Center: [Graphics and Multimedia](https://journals.ieeeauthorcenter.ieee.org/create-your-ieee-article/create-graphics-and-multimedia/)
2. IEEE PDF Specification: [PDF Requirements](https://www.ieee.org/publications/authors/transjnl/index.html)
3. ACM Digital Library: [Figure Requirements](https://www.acm.org/publications/proceedings-template)

## Summary

The academic export features transform the SQLite ERD Generator into a professional tool suitable for:
- **Research Publications**: IEEE, ACM, Springer
- **Academic Presentations**: Conferences, seminars
- **Technical Documentation**: Industry standards
- **Educational Materials**: Textbooks, tutorials

With transparent backgrounds, IEEE-compliant styling, and comprehensive notation options, your database diagrams will meet the highest academic standards.