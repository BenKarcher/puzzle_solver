predicate odd(array[int] of var int: cells) =
    forall(i in index_set(cells))(cells[i] mod 2 = 1);
