% No 2x2 block is fully shaded
constraint forall(r in 1..rows-1, c in 1..cols-1)(
    not (shaded[r,c] /\ shaded[r,c+1] /\ shaded[r+1,c] /\ shaded[r+1,c+1])
);

% No 2x2 block is fully unshaded
constraint forall(r in 1..rows-1, c in 1..cols-1)(
    not (not shaded[r,c] /\ not shaded[r,c+1] /\ not shaded[r+1,c] /\ not shaded[r+1,c+1])
);
