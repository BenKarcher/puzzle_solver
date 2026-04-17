predicate german_whisper(array[int] of var int: values) = 
    forall(i in 2..length(values))(
        abs(values[i] - values[i-1]) >= 5
    );