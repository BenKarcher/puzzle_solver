include "alldifferent.mzn";

constraint alldifferent([grid[i, i] | i in 1..min(rows, cols)]);
