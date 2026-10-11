predicate no_four_in_a_row(array[int,int] of var bool: shaded) =
    % Horizontal runs of 4
    forall(r in 1..rows, c in 1..cols-3)(
        (shaded[r,c] \/ shaded[r,c+1] \/ shaded[r,c+2] \/ shaded[r,c+3]) /\
        not(shaded[r,c] /\ shaded[r,c+1] /\ shaded[r,c+2] /\ shaded[r,c+3])
    ) /\
    % Vertical runs of 4
    forall(r in 1..rows-3, c in 1..cols)(
        (shaded[r,c] \/ shaded[r+1,c] \/ shaded[r+2,c] \/ shaded[r+3,c]) /\
        not(shaded[r,c] /\ shaded[r+1,c] /\ shaded[r+2,c] /\ shaded[r+3,c])
    );
