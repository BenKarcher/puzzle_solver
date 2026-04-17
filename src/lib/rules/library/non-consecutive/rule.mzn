constraint forall(r in 1..rows, c in 1..cols-1)(
    abs(digits[r, c] - digits[r, c+1]) != 1
);

constraint forall(r in 1..rows-1, c in 1..cols)(
    abs(digits[r, c] - digits[r+1, c]) != 1
);
