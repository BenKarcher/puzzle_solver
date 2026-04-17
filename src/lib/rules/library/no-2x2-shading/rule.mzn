constraint forall(r in 1..rows-1, c in 1..cols-1)(
    (shaded[r,c] \/ shaded[r,c+1] \/ shaded[r+1,c] \/ shaded[r+1,c+1]) /\
    not (shaded[r,c] /\ shaded[r,c+1] /\ shaded[r+1,c] /\ shaded[r+1,c+1])
);