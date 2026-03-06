include "alldifferent.mzn";

constraint forall(reg in 0..max(region))(
    alldifferent([grid[r, c] | r in 1..rows, c in 1..cols where region[r, c] = reg])
);
