constraint forall(r in 1..rows, c in 1..cols)(
    shaded[r,c] -> grid[r,c] mod 2 = 0
);
