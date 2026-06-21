% Returns the 4 borders of cell (r, c) as [TOP, RIGHT, BOTTOM, LEFT],
% matching the shape of the `borders` parameter in the number_equals_edge predicate.
function array[1..4] of var bool: cell_borders(int: r, int: c) =
    [border_h[r, c], border_v[r, c+1], border_h[r+1, c], border_v[r, c]];

% Returns the count of active borders around cell (r, c).
function var int: cell_border_count(int: r, int: c) =
    bool2int(border_h[r, c]) + bool2int(border_v[r, c+1])
    + bool2int(border_h[r+1, c]) + bool2int(border_v[r, c]);
