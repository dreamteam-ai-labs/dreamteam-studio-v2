import React from 'react';
import { getHeaderClassName, getColumnStyle, getSortIcon, getColumnAlignment } from '../config/tableConfig';

function TableHeader({ 
  column, 
  sortBy, 
  sortOrder, 
  onSort, 
  columnWidth,
  onMouseDown 
}) {
  const alignment = getColumnAlignment(column.key);
  const alignClass = alignment === 'center' ? 'justify-center' : '';
  
  const style = getColumnStyle(column.key, columnWidth);
  
  return (
    <th 
      onClick={column.sortable ? () => onSort(column.key) : undefined}
      className={getHeaderClassName(column.key, column.sortable, sortBy, sortOrder)}
      style={style}
    >
      <div className={`flex items-center ${alignClass}`}>
        {column.label}
        {column.sortable && getSortIcon(column.key, sortBy, sortOrder)}
      </div>
      <div 
        className="column-resizer"
        onMouseDown={(e) => onMouseDown(e, column.key)}
      />
    </th>
  );
}

export default TableHeader;