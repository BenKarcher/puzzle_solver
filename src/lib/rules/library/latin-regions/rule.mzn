constraint forall(reg in 0..max(region))(
    alldifferent([digits[r, c] | r in 1..rows, c in 1..cols where region[r, c] = reg])
);
