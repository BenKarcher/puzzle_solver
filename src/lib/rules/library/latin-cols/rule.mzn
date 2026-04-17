constraint forall(c in 1..cols)(
    alldifferent([digits[r, c] | r in 1..rows])
);
