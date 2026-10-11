predicate unshaded_see_light(array[int,int] of var bool: walls, array[int,int] of var bool: lights) =
    forall(r in 1..rows, c in 1..cols)(
        walls[r,c] \/
        % A light somewhere in the same row with no wall strictly between
        exists(c2 in 1..cols)(
            lights[r,c2] /\
            forall(cm in min(c,c2)+1..max(c,c2)-1)(not walls[r,cm])
        ) \/
        % A light somewhere in the same column with no wall strictly between
        exists(r2 in 1..rows)(
            lights[r2,c] /\
            forall(rm in min(r,r2)+1..max(r,r2)-1)(not walls[rm,c])
        )
    );
