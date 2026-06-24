% TOP=1, RIGHT=2, BOTTOM=3, LEFT=4
predicate lines_straight(array[int, 1..4] of var int: lines) =
    forall(idx in index_set_1of2(lines))(
        lines[idx, 1] = lines[idx, 3] /\          % top = bottom (vertical pass-through)
        lines[idx, 2] = lines[idx, 4] /\          % right = left  (horizontal pass-through)
        (lines[idx, 1] = 0 \/ lines[idx, 2] = 0)  % only one axis in use
    );
