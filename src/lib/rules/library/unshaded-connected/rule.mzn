array[1..CELL_N] of var bool: uc_ns = [not shaded[r, c] | r in 1..rows, c in 1..cols];
array[1..CELL_E] of var bool: uc_es = [uc_ns[cell_from[e]] /\ uc_ns[cell_to[e]] | e in 1..CELL_E];
constraint connected(cell_from, cell_to, uc_ns, uc_es);
