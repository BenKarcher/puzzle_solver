constraint forall(r in 1..rows, c in 1..cols)(
    not shaded[r,c] -> digits[r,c] mod 2 = 0
);
