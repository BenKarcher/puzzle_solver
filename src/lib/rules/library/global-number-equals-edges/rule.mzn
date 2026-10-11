predicate global_number_equals_edges(array[int,int] of var int: values, array[int,int] of var bool: border_h, array[int,int] of var bool: border_v) =
    forall(r in 1..rows, c in 1..cols)(
        values[r, c] = cell_border_count(border_h, border_v, r, c)
    );
