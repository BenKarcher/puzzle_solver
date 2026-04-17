predicate number_equals_lines(array[int] of var int: values, array[int, 1..4] of var int: lines) =
    forall(idx in index_set(values))(
        values[idx] = sum(l in lines[idx])(l)
    );