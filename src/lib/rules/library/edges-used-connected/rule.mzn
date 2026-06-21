% Node selected iff the intersection (r, c) has at least one adjacent active border.
array[1..BORDER_N] of var bool: euc_ns = array1d(1..BORDER_N, [
        (if c > 1    then border_h[r, c-1] else false endif) \/
        (if c <= cols then border_h[r, c]   else false endif) \/
        (if r > 1    then border_v[r-1, c] else false endif) \/
        (if r <= rows then border_v[r, c]   else false endif)
    | r in 1..rows+1, c in 1..cols+1]);
array[1..BORDER_E] of var bool: euc_es = array1d(1..BORDER_E,
    [border_h[r, c] | r in 1..rows+1, c in 1..cols] ++
    [border_v[r, c] | r in 1..rows,   c in 1..cols+1]);
constraint connected(border_from, border_to, euc_ns, euc_es);
