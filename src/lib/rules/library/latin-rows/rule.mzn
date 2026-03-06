include "alldifferent.mzn";

constraint forall(r in 1..rows)(
    alldifferent([grid[r, c] | c in 1..cols])
);
