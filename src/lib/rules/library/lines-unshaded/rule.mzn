constraint forall(r in 1..rows, c in 1..cols-1)(
    line_h[r,c] > 0 -> (not shaded[r,c] /\ not shaded[r,c+1])
);
constraint forall(r in 1..rows-1, c in 1..cols)(
    line_v[r,c] > 0 -> (not shaded[r,c] /\ not shaded[r+1,c])
);
