predicate booleans_disjoint(array[int,int] of var bool: a, array[int,int] of var bool: b) =
    forall(r in 1..rows, c in 1..cols)(
        not (a[r,c] /\ b[r,c])
    );
