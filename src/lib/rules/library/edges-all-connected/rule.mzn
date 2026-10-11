predicate edges_all_connected(array[int,int] of var bool: border_h, array[int,int] of var bool: border_v) =
    let {
        array[1..BORDER_N] of bool: ns = [true | i in 1..BORDER_N];
        array[1..BORDER_E] of var bool: es = array1d(1..BORDER_E,
            [border_h[r, c] | r in 1..rows+1, c in 1..cols] ++
            [border_v[r, c] | r in 1..rows,   c in 1..cols+1]);
    } in
    connected(border_from, border_to, ns, es);
