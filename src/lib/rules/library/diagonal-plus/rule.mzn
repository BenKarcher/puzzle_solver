predicate diagonal_plus(array[int,int] of var int: digits) =
    alldifferent([digits[r, c] | r in 1..rows, c in 1..cols where r + c = rows + 1]);
