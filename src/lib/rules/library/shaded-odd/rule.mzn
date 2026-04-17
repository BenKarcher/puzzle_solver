constraint forall(r in 1..rows, c in 1..cols)(
    shaded[r,c] -> digits[r,c] mod 2 = 1
);
