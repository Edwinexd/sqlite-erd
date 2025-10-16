/*
A web application that generates an Entity-Relationship Diagram (ERD) from a SQLite database file
Copyright (C) 2024 Edwin Sundberg

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import React, { useCallback, useEffect, useRef, useState } from "react";

interface TablePosition {
  x: number;
  y: number;
}

interface TablePositions {
  [tableId: string]: TablePosition;
}

interface InteractiveERDProps {
  svgString: string;
  isDarkMode: boolean;
  onModifiedSVG?: (svg: string) => void;
  resetTrigger?: number;
  onExportRequest?: () => string;
}

interface TableElement {
  id: string;
  element: SVGGElement;
  initialX: number;
  initialY: number;
}

const InteractiveERD: React.FC<InteractiveERDProps> = ({ svgString, isDarkMode, onModifiedSVG, resetTrigger = 0, onExportRequest }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tables, setTables] = useState<TableElement[]>([]);
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tablePositions, setTablePositions] = useState<TablePositions>({});
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Parse and render SVG
  useEffect(() => {
    if (!svgString || !containerRef.current) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = doc.documentElement as unknown as SVGSVGElement;

    // Clear container
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(svgElement);
    svgRef.current = svgElement;

    // Make SVG responsive
    svgElement.style.width = "100%";
    svgElement.style.height = "auto";
    svgElement.style.maxWidth = "100%";
    svgElement.style.display = "block";
    svgElement.style.transformOrigin = "0 0";

    // Extract all table nodes
    const tableElements: TableElement[] = [];
    const nodeGroups = svgElement.querySelectorAll("g.node");

    nodeGroups.forEach((node) => {
      const gElement = node as SVGGElement;
      const titleElement = gElement.querySelector("title");
      
      if (titleElement) {
        const tableId = titleElement.textContent || "";
        
        // Get initial position from transform
        const transform = gElement.getAttribute("transform") || "";
        const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        
        let initialX = 0;
        let initialY = 0;
        
        if (translateMatch) {
          initialX = parseFloat(translateMatch[1]);
          initialY = parseFloat(translateMatch[2]);
        }

        // Add cursor style and visual feedback
        gElement.style.cursor = "move";
        gElement.style.userSelect = "none";
        gElement.style.transition = "filter 0.2s ease";

        tableElements.push({
          id: tableId,
          element: gElement,
          initialX,
          initialY,
        });

        // Initialize position
        if (!tablePositions[tableId]) {
          setTablePositions((prev) => ({
            ...prev,
            [tableId]: { x: initialX, y: initialY },
          }));
        }
      }
    });

    setTables(tableElements);
  }, [svgString, resetTrigger]);

  // Reset positions when resetTrigger changes
  useEffect(() => {
    if (resetTrigger > 0 && tables.length > 0) {
      const resetPositions: TablePositions = {};
      tables.forEach(table => {
        resetPositions[table.id] = { x: table.initialX, y: table.initialY };
      });
      setTablePositions(resetPositions);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [resetTrigger, tables]);

  // Apply zoom and pan
  useEffect(() => {
    if (svgRef.current) {
      svgRef.current.style.transform = `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`;
    }
  }, [zoom, pan]);

  // Setup event listeners
  useEffect(() => {
    if (!svgRef.current || tables.length === 0) return;

    const svgElement = svgRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      // Check if space key is pressed for panning
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        e.preventDefault();
        return;
      }

      const target = e.target as SVGElement;
      const nodeGroup = target.closest("g.node") as SVGGElement;
      
      if (nodeGroup) {
        const titleElement = nodeGroup.querySelector("title");
        if (titleElement && svgRef.current) {
          const tableId = titleElement.textContent || "";
          const svgPoint = svgRef.current.createSVGPoint();
          svgPoint.x = e.clientX;
          svgPoint.y = e.clientY;
          
          const ctm = svgRef.current.getScreenCTM();
          if (ctm) {
            const transformedPoint = svgPoint.matrixTransform(ctm.inverse());
            const currentPos = tablePositions[tableId] || { x: 0, y: 0 };
            
            setDraggingTable(tableId);
            setDragOffset({
              x: transformedPoint.x - currentPos.x,
              y: transformedPoint.y - currentPos.y,
            });

            // Add visual feedback
            nodeGroup.style.filter = "brightness(1.2)";
          }
          
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
        e.preventDefault();
        return;
      }

      if (draggingTable && svgRef.current) {
        const svgPoint = svgRef.current.createSVGPoint();
        svgPoint.x = e.clientX;
        svgPoint.y = e.clientY;
        
        const ctm = svgRef.current.getScreenCTM();
        if (ctm) {
          const transformedPoint = svgPoint.matrixTransform(ctm.inverse());
          const newX = transformedPoint.x - dragOffset.x;
          const newY = transformedPoint.y - dragOffset.y;
          
          setTablePositions((prev) => ({
            ...prev,
            [draggingTable]: { x: newX, y: newY },
          }));
        }
        
        e.preventDefault();
      }
    };

    const handleMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }

      if (draggingTable) {
        // Remove visual feedback
        const table = tables.find(t => t.id === draggingTable);
        if (table) {
          table.element.style.filter = "";
        }
        setDraggingTable(null);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.1, Math.min(3, prev * delta)));
      }
    };

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      const nodeGroup = target.closest("g.node") as SVGGElement;
      
      if (nodeGroup && !draggingTable && !isPanning) {
        const titleElement = nodeGroup.querySelector("title");
        if (titleElement) {
          const tableId = titleElement.textContent || "";
          setHoveredTable(tableId);
          nodeGroup.style.filter = "brightness(1.1)";
        }
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as SVGElement;
      const nodeGroup = target.closest("g.node") as SVGGElement;
      
      if (nodeGroup && !draggingTable) {
        const titleElement = nodeGroup.querySelector("title");
        if (titleElement) {
          setHoveredTable(null);
          nodeGroup.style.filter = "";
        }
      }
    };

    svgElement.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    containerRef.current?.addEventListener("wheel", handleWheel, { passive: false });
    
    // Add hover listeners to each table
    tables.forEach(table => {
      table.element.addEventListener("mouseenter", handleMouseEnter);
      table.element.addEventListener("mouseleave", handleMouseLeave);
    });

    return () => {
      svgElement.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      containerRef.current?.removeEventListener("wheel", handleWheel);
      
      tables.forEach(table => {
        table.element.removeEventListener("mouseenter", handleMouseEnter);
        table.element.removeEventListener("mouseleave", handleMouseLeave);
      });
    };
  }, [tables, draggingTable, dragOffset, tablePositions, isPanning, panStart, pan]);

  // Update table positions
  useEffect(() => {
    if (tables.length === 0) return;

    tables.forEach((table) => {
      const position = tablePositions[table.id];
      if (position) {
        table.element.setAttribute("transform", `translate(${position.x}, ${position.y})`);
      }
    });
  }, [tablePositions, tables]);

  // Function to generate clean SVG for export
  const generateExportSVG = useCallback((): string => {
    if (!svgRef.current) return "";

    try {
      // Clone the SVG to avoid modifying the displayed one
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      
      // Remove all style attributes that might cause parsing issues
      svgClone.removeAttribute("style");
      
      // Clean all child elements
      const allElements = svgClone.querySelectorAll("*");
      allElements.forEach((element) => {
        // Remove style attribute completely
        element.removeAttribute("style");
      });
      
      const serializer = new XMLSerializer();
      let svgContent = serializer.serializeToString(svgClone);
      
      // Replace non-breaking spaces properly
      svgContent = svgContent.replace(/ /g, "&#160;");
      
      // Don't add XML prolog and DOCTYPE - they can cause parsing issues
      // Just return the clean SVG content
      return svgContent;
    } catch (error) {
      console.error("Error generating export SVG:", error);
      return "";
    }
  }, []);

  // Notify parent of changes with debounce
  useEffect(() => {
    if (!onModifiedSVG || tables.length === 0) return;

    const timeoutId = setTimeout(() => {
      const svg = generateExportSVG();
      if (svg) {
        onModifiedSVG(svg);
      }
    }, 100); // Small debounce to avoid too many updates

    return () => clearTimeout(timeoutId);
  }, [tablePositions, tables, onModifiedSVG, generateExportSVG]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev * 1.2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.1, prev / 1.2));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-lg border border-gray-300 dark:border-gray-700">
        <button
          onClick={handleZoomIn}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded transition-colors"
          title="Zoom In (Ctrl + Scroll)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded transition-colors"
          title="Zoom Out (Ctrl + Scroll)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleResetView}
          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded transition-colors"
          title="Reset View"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="text-center text-sm text-gray-700 dark:text-gray-300 mt-1">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      <div 
        ref={containerRef} 
        className="w-full overflow-hidden border-2 border-gray-300 dark:border-gray-700 rounded-lg shadow-lg bg-white dark:bg-gray-800"
        style={{ 
          minHeight: "500px",
          maxHeight: "80vh",
          cursor: isPanning ? "grabbing" : "default"
        }}
      >
        {/* SVG will be inserted here */}
      </div>

      {/* Status indicators */}
      {draggingTable && (
        <div className="absolute top-2 left-2 bg-blue-500 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-2">
          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
          </svg>
          <span>Moving: {draggingTable}</span>
        </div>
      )}

      {isPanning && (
        <div className="absolute top-2 left-2 bg-purple-500 text-white px-4 py-2 rounded shadow-lg z-50 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span>Panning</span>
        </div>
      )}

      {/* Help text */}
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 text-center">
        <p>💡 Drag tables to move • Shift+Drag or Middle-click to pan • Ctrl+Scroll to zoom</p>
      </div>
    </div>
  );
};

export default InteractiveERD;
export type { TablePositions };
