array[1..BORDER_N] of bool: eac_ns = [true | i in 1..BORDER_N];
array[1..BORDER_E] of var bool: eac_es = array1d(1..BORDER_E,
    [border_h[r, c] | r in 1..rows+1, c in 1..cols] ++
    [border_v[r, c] | r in 1..rows,   c in 1..cols+1]);
constraint connected(border_from, border_to, eac_ns, eac_es);
