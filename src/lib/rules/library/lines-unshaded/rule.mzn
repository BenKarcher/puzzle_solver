predicate lines_unshaded(array[int,int] of var int: line_h, array[int,int] of var int: line_v, array[int,int] of var bool: shaded) =
    forall(r in 1..rows, c in 1..cols-1)(
        line_h[r,c] > 0 -> (not shaded[r,c] /\ not shaded[r,c+1])
    ) /\
    forall(r in 1..rows-1, c in 1..cols)(
        line_v[r,c] > 0 -> (not shaded[r,c] /\ not shaded[r+1,c])
    );
