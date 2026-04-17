predicate arrow(array[int] of var int: values_1, array[int] of var int: values_2)=
    sum([pow(10,length(values_1)-i) * values_1[i] | i in index_set(values_1)]) = sum(values_2);