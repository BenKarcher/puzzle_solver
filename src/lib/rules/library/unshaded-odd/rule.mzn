constraint forall(r in 1..rows, c in 1..cols)(
    not shaded[r,c] -> grid[r,c] mod 2 = 1
);
