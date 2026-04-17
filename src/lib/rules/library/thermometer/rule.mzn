predicate thermometer(array[int] of var int: values) =
    forall(i in 1..length(values)-1)(values[i] < values[i+1]);
