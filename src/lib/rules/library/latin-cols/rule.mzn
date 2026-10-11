predicate latin_cols(array[int,int] of var int: digits) =
    forall(c in 1..cols)(
        alldifferent([digits[r, c] | r in 1..rows])
    );
