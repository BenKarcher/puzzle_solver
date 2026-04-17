predicate clone(array[int] of var int: digits_1, array[int] of var int: digits_2) =
    assert(length(digits_1) = length(digits_2),"Clones groupsmust have same length") /\
    forall(i in index_set(digits_1))(
        digits_1[i] = digits_2[i]
    );