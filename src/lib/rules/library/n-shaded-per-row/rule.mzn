predicate n_shaded_per_row(int: n)=
    forall(r in 1..rows)(
        sum(c in 1..cols)(bool2int(shaded[r,c]))=n
    );
