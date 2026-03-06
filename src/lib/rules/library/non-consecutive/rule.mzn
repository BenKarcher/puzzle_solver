constraint forall(r in 1..rows, c in 1..cols-1)(
    abs(grid[r, c] - grid[r, c+1]) != 1
);

constraint forall(r in 1..rows-1, c in 1..cols)(
    abs(grid[r, c] - grid[r+1, c]) != 1
);
