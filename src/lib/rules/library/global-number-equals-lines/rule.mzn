predicate global_number_equals_lines(array[int,int] of var int: values, array[int,int] of var int: line_h, array[int,int] of var int: line_v) =
    forall(r in 1..rows, c in 1..cols)(
        values[r, c] = cell_line_count(line_h, line_v, r, c)
    );
