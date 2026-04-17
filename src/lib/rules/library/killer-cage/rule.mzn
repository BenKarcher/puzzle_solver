include "alldifferent.mzn";
predicate killer_cage(array[int] of var int: digits, array[int] of var int: values, int: target) =
    sum(values) = target /\
    alldifferent(digits);