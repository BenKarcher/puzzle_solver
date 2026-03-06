include "alldifferent.mzn";

predicate killer_cage(array[int] of var int: cells, int: target) =
    sum(cells) = target /\
    alldifferent(cells);
