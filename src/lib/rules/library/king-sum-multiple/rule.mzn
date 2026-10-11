predicate king_sum_multiple(array[int,int] of var int: values) =
    forall(r in 1..rows, c in 1..cols)(
        sum(king_neighbors(values, r, c)) mod values[r, c] = 0
    );
