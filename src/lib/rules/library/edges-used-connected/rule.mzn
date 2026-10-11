% Node selected iff the intersection (r, c) has at least one adjacent active border.
predicate edges_used_connected(array[int,int] of var bool: border_h, array[int,int] of var bool: border_v) =
    let {
        array[1..BORDER_N] of var bool: ns = array1d(1..BORDER_N, [
                (if c > 1    then border_h[r, c-1] else false endif) \/
                (if c <= cols then border_h[r, c]   else false endif) \/
                (if r > 1    then border_v[r-1, c] else false endif) \/
                (if r <= rows then border_v[r, c]   else false endif)
            | r in 1..rows+1, c in 1..cols+1]);
        array[1..BORDER_E] of var bool: es = array1d(1..BORDER_E,
            [border_h[r, c] | r in 1..rows+1, c in 1..cols] ++
            [border_v[r, c] | r in 1..rows,   c in 1..cols+1]);
    } in
    connected(border_from, border_to, ns, es);
