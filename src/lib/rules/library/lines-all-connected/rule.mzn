array[1..CELL_N] of bool: lac_ns = [true | i in 1..CELL_N];
array[1..CELL_E] of var bool: lac_es = array1d(1..CELL_E,
    [(line_h[r, c] > 0) | r in 1..rows,   c in 1..cols-1] ++
    [(line_v[r, c] > 0) | r in 1..rows-1, c in 1..cols]);
constraint connected(cell_from, cell_to, lac_ns, lac_es);
