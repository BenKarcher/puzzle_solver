include "connected.mzn";

% Border intersection graph.
% Nodes are grid intersections (r, c) with r in 1..rows+1, c in 1..cols+1.
% Node index: border_node(r, c) = (r-1)*(cols+1) + c.
% Edges are ordered: horizontal segments (border_h) first, then vertical (border_v).
%   Horizontal: border_h[r, c] connects border_node(r,c) to border_node(r,c+1)
%   Vertical:   border_v[r, c] connects border_node(r,c) to border_node(r+1,c)

int: BORDER_N   = (rows + 1) * (cols + 1);
int: BORDER_H_E = (rows + 1) * cols;
int: BORDER_V_E = rows * (cols + 1);
int: BORDER_E   = BORDER_H_E + BORDER_V_E;

function int: border_node(int: r, int: c) = (r - 1) * (cols + 1) + c;

array[1..BORDER_E] of 1..BORDER_N: border_from = array1d(1..BORDER_E,
    [border_node(r, c)   | r in 1..rows+1, c in 1..cols] ++
    [border_node(r, c)   | r in 1..rows,   c in 1..cols+1]);

array[1..BORDER_E] of 1..BORDER_N: border_to = array1d(1..BORDER_E,
    [border_node(r, c+1) | r in 1..rows+1, c in 1..cols] ++
    [border_node(r+1, c) | r in 1..rows,   c in 1..cols+1]);
