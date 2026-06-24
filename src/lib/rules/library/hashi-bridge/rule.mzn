% Straight-bridge predicate for a single cell (r, c).
% cell_lines() returns [TOP, RIGHT, BOTTOM, LEFT] — provided by the cell-lines import.
predicate hashi_bridge_cell(int: r, int: c) =
    let {
        array[1..4] of var int: l = cell_lines(r, c)
    } in
    l[1] = l[3] /\           % top = bottom  (vertical pass-through)
    l[2] = l[4] /\           % right = left   (horizontal pass-through)
    (l[1] = 0 \/ l[2] = 0);  % only one axis in use
