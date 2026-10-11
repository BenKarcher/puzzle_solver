predicate akari_clue(array[int,int] of var bool: lights, array[int] of int: rs, array[int] of int: cs, int: n) =
    forall(i in index_set(rs))(
        sum([bool2int(lights[rs[i]+dr, cs[i]+dc]) | dr in -1..1, dc in -1..1
             where abs(dr) + abs(dc) = 1
                /\ rs[i]+dr >= 1 /\ rs[i]+dr <= rows
                /\ cs[i]+dc >= 1 /\ cs[i]+dc <= cols]) = n
    );
