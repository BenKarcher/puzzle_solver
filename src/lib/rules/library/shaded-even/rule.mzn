predicate shaded_even(array[int,int] of var int: digits, array[int,int] of var bool: shaded) =
    forall(r in 1..rows, c in 1..cols)(
        shaded[r,c] -> digits[r,c] mod 2 = 0
    );
