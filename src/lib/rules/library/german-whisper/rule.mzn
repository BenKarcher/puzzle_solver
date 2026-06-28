predicate whisper(array[int] of var int: values, int: difference)=
    forall(i in 1..length(values)-1)(
        abs(values[i] - values[i + 1]) >= difference
    );