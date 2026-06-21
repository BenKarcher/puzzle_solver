constraint forall(r in 1..rows, c in 1..cols)(
    values[r, c] = cell_line_count(r, c)
);
