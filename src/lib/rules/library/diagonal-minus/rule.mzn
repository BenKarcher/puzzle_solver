predicate diagonal_minus(array[int,int] of var int: digits) =
    alldifferent([digits[i, i] | i in 1..min(rows, cols)]);
