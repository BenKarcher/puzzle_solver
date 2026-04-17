predicate palindrome(array[int] of var int: digits)=
    forall(i in 1..length(digits) div 2)(
        digits[i] = digits[length(digits) - i + 1]
    );