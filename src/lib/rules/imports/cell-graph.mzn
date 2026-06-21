include "connected.mzn";

% Cell adjacency graph for orthogonal connectivity.
% Nodes are cells indexed row-major: cell_node(r, c) = (r-1)*cols + c.
% Edges are ordered: horizontal (right) first, then vertical (down).
%   Horizontal edge e in 1..CELL_H_E : row r=(e-1)/(cols-1)+1, col c=(e-1)%(cols-1)+1
%   Vertical   edge e in CELL_H_E+1..CELL_E : offset into rows*(cols-1) block

int: CELL_N   = rows * cols;
int: CELL_H_E = rows * (cols - 1);
int: CELL_V_E = (rows - 1) * cols;
int: CELL_E   = CELL_H_E + CELL_V_E;

function int: cell_node(int: r, int: c) = (r - 1) * cols + c;

array[1..CELL_E] of 1..CELL_N: cell_from = array1d(1..CELL_E,
    [cell_node(r, c)   | r in 1..rows,   c in 1..cols-1] ++
    [cell_node(r, c)   | r in 1..rows-1, c in 1..cols]);

array[1..CELL_E] of 1..CELL_N: cell_to = array1d(1..CELL_E,
    [cell_node(r, c+1) | r in 1..rows,   c in 1..cols-1] ++
    [cell_node(r+1, c) | r in 1..rows-1, c in 1..cols]);
