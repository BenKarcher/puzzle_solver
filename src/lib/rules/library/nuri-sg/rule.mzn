predicate nuri_sg(array[int] of var bool: shaded, array[int, 1..4] of var int: lines) =
    shaded[1] = false /\ shaded[2] = false /\
    sum(j in 1..4)(lines[1,j]) = 1 /\
    sum(j in 1..4)(lines[2,j]) = 1;
