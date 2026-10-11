predicate no_shading_touching(array[int,int] of var bool: shaded) =
    forall(r in 1..rows-1, c in 1..cols)(
        (not shaded[r,c]) \/ (not shaded[r+1,c])
    ) /\
    forall(r in 1..rows, c in 1..cols-1)(
        (not shaded[r,c]) \/ (not shaded[r,c+1])
    );
