predicate unshaded_connected(array[int,int] of var bool: shaded) =
    let {
        array[1..CELL_N] of var bool: ns = [not shaded[r, c] | r in 1..rows, c in 1..cols];
        array[1..CELL_E] of var bool: es = [ns[cell_from[e]] /\ ns[cell_to[e]] | e in 1..CELL_E];
    } in
    connected(cell_from, cell_to, ns, es);
