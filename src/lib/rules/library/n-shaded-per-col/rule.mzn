predicate n_shaded_per_row(int: n)=
    forall(c in 1..cols)(
        sum(r in 1..rows)(bool2int(shaded[r,c]))=n
    );
