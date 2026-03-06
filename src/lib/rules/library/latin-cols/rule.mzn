include "alldifferent.mzn";

constraint forall(c in 1..cols)(
    alldifferent([grid[r, c] | r in 1..rows])
);
