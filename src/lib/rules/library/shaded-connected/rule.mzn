array[1..CELL_N] of var bool: sc_ns = [shaded[r, c] | r in 1..rows, c in 1..cols];
array[1..CELL_E] of var bool: sc_es = [sc_ns[cell_from[e]] /\ sc_ns[cell_to[e]] | e in 1..CELL_E];
constraint connected(cell_from, cell_to, sc_ns, sc_es);
