% Returns the 4 line values around cell (r, c) as [TOP, RIGHT, BOTTOM, LEFT],
% matching the shape of the `lines` parameter in the number_equals_lines predicate.
function array[1..4] of var int: cell_lines(int: r, int: c) =
    [if r > 1    then line_v[r-1, c] else 0 endif,
     if c < cols then line_h[r, c]   else 0 endif,
     if r < rows then line_v[r, c]   else 0 endif,
     if c > 1    then line_h[r, c-1] else 0 endif];

% Returns the total count of lines around cell (r, c).
function var int: cell_line_count(int: r, int: c) =
    (if c > 1    then line_h[r, c-1] else 0 endif) +
    (if c < cols then line_h[r, c]   else 0 endif) +
    (if r > 1    then line_v[r-1, c] else 0 endif) +
    (if r < rows then line_v[r, c]   else 0 endif);
