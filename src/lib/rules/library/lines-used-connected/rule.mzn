array[1..CELL_N] of var bool: luc_ns = [(cell_line_count(r, c) > 0) | r in 1..rows, c in 1..cols];
array[1..CELL_E] of var bool: luc_es = array1d(1..CELL_E,
    [(line_h[r, c] > 0) | r in 1..rows,   c in 1..cols-1] ++
    [(line_v[r, c] > 0) | r in 1..rows-1, c in 1..cols]);
constraint connected(cell_from, cell_to, luc_ns, luc_es);
