predicate disjoint_groups(array[int,int] of var int: digits) =
    forall(pos in 1..max(position))(
        all_different([digits[r, c] | r in 1..rows, c in 1..cols where position[r, c] = pos])
    );
