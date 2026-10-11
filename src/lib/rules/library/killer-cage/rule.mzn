include "alldifferent.mzn";
predicate killer_cage(array[int] of var int: digits, int: target) =
    sum(digits) = target /\
    alldifferent(digits);
