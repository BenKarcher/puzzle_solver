% Returns the 4 line values around cell (r, c) as [TOP, RIGHT, BOTTOM, LEFT]
% for the given line arrays (lh = horizontal connections, lv = vertical connections).
function array[1..4] of var int: cell_lines(array[int,int] of var int: lh, array[int,int] of var int: lv, int: r, int: c) =
    [if r > 1    then lv[r-1, c] else 0 endif,
     if c < cols then lh[r, c]   else 0 endif,
     if r < rows then lv[r, c]   else 0 endif,
     if c > 1    then lh[r, c-1] else 0 endif];

% Returns the total count of lines around cell (r, c).
function var int: cell_line_count(array[int,int] of var int: lh, array[int,int] of var int: lv, int: r, int: c) =
    (if c > 1    then lh[r, c-1] else 0 endif) +
    (if c < cols then lh[r, c]   else 0 endif) +
    (if r > 1    then lv[r-1, c] else 0 endif) +
    (if r < rows then lv[r, c]   else 0 endif);
