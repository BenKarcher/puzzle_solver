predicate latin_rows(array[int,int] of var int: digits) =
    forall(r in 1..rows)(
        alldifferent([digits[r, c] | c in 1..cols])
    );
