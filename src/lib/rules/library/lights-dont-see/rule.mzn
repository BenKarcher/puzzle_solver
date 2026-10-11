predicate lights_dont_see(array[int,int] of var bool: walls, array[int,int] of var bool: lights) =
    % Any two lights in the same row have a wall strictly between them
    forall(r in 1..rows, c1 in 1..cols-1, c2 in c1+1..cols)(
        not (lights[r,c1] /\ lights[r,c2]) \/
        exists(c in c1+1..c2-1)(walls[r,c])
    ) /\
    % Any two lights in the same column have a wall strictly between them
    forall(c in 1..cols, r1 in 1..rows-1, r2 in r1+1..rows)(
        not (lights[r1,c] /\ lights[r2,c]) \/
        exists(r in r1+1..r2-1)(walls[r,c])
    );
