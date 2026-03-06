include "alldifferent.mzn";

constraint alldifferent([grid[r, c] | r in 1..rows, c in 1..cols where r + c = rows + 1]);
