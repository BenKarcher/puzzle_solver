predicate n_shaded_per_row(array[int,int] of var bool: shaded, int: n) =
    forall(r in 1..rows)(
        sum(c in 1..cols)(bool2int(shaded[r,c])) = n
    );
