predicate odd(array[int] of var int: values) =
    forall(i in index_set(values))(values[i] mod 2 = 1);
