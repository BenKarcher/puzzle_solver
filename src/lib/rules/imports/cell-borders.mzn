% Returns the 4 borders of cell (r, c) as [TOP, RIGHT, BOTTOM, LEFT]
% for the given border arrays (bh = horizontal edges, bv = vertical edges).
function array[1..4] of var bool: cell_borders(array[int,int] of var bool: bh, array[int,int] of var bool: bv, int: r, int: c) =
    [bh[r, c], bv[r, c+1], bh[r+1, c], bv[r, c]];

% Returns the count of active borders around cell (r, c).
function var int: cell_border_count(array[int,int] of var bool: bh, array[int,int] of var bool: bv, int: r, int: c) =
    bool2int(bh[r, c]) + bool2int(bv[r, c+1])
    + bool2int(bh[r+1, c]) + bool2int(bv[r, c]);
