predicate number_equals_edge(array[int] of var int: values, array[int, 1..4] of var bool: borders) =
    forall(idx in index_set(values))(
        values[idx] = sum(b in borders[idx])(bool2int(b))
    );