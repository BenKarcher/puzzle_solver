predicate anti_king(array[int,int] of var int: digits) =
    forall(r in 2..rows, c in 1..cols-1)(
        digits[r, c] != digits[r - 1, c + 1]
    ) /\
    forall(r in 1..rows, c in 1..cols-1)(
        digits[r, c] != digits[r, c + 1]
    ) /\
    forall(r in 1..rows-1, c in 1..cols-1)(
        digits[r, c] != digits[r + 1, c + 1]
    ) /\
    forall(r in 1..rows-1, c in 1..cols)(
        digits[r, c] != digits[r + 1, c]
    );
