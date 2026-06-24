predicate hashi_island(array[int, 1..4] of var int: lines, int: target) =
    forall(idx in index_set_1of2(lines))(
        sum(d in 1..4)(lines[idx, d]) = target
    );
