predicate between_line(array[int] of var int: values)=
    forall(i in 2..length(values)-1)(
        (values[i] < values[1] /\ values[i] > values[length(values)]) \/
        (values[i] > values[1] /\ values[i] < values[length(values)])
    );