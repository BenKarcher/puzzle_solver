include "alldifferent.mzn";

predicate extra_region(array[int] of var int: cells) =
    alldifferent(cells);
