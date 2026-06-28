predicate nuri_circle(array[int] of var bool: shaded, array[int, 1..4] of var int: lines)=
    forall(i in index_set(shaded))(shaded[i] = false /\ sum(j in 1..4)(lines[i,j]) = 2);