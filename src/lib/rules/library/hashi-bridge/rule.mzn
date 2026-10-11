% Straight-bridge predicate for a single cell (r, c) of the bound line arrays.
predicate hashi_bridge_cell(array[int,int] of var int: lh, array[int,int] of var int: lv, int: r, int: c) =
    let {
        array[1..4] of var int: l = cell_lines(lh, lv, r, c)
    } in
    l[1] = l[3] /\           % top = bottom  (vertical pass-through)
    l[2] = l[4] /\           % right = left   (horizontal pass-through)
    (l[1] = 0 \/ l[2] = 0);  % only one axis in use
