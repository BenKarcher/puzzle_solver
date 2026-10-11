predicate lines_all_connected(array[int,int] of var int: line_h, array[int,int] of var int: line_v) =
    let {
        array[1..CELL_N] of bool: ns = [true | i in 1..CELL_N];
        array[1..CELL_E] of var bool: es = array1d(1..CELL_E,
            [(line_h[r, c] > 0) | r in 1..rows,   c in 1..cols-1] ++
            [(line_v[r, c] > 0) | r in 1..rows-1, c in 1..cols]);
    } in
    connected(cell_from, cell_to, ns, es);
