# sudoku variants
- palindrome (grey line (careful about even and odd length working))
- sum (not rendered) just gives the sum of a certain set of cells, like killer cage but without the all different
- ratio dot (black dot between two cells means one is double the other)
- negative constraint for ratio dots
- negative constraint for kropki (if no white or black dot is present between two cells, then they cannot be consecutive or double, but note that 1,2 satisfy both dots so this is different from both seperate negative constraints since a white dot may have a 12 pair even though they have ratio 2 and their is no black dot)
- clone the two groups are the same values in the same order (rendered as a light blue background)
- between line (the numbers on the line must be between the first and last digit in the line (either may be the upper one))(rendered as a grey line with a grey hollow circle at either end (kind of like an arrow bulb))
- X The two cells with an x between them must sum to 10
- V The two cells with a v between them must sum to 5
- XV negative constraint for X and V (if there is no X or V between two cells, then they cannot sum to 10 or 5)
- german whisper line consecutive numbers on the line must differ by at least 5, (rendered as a green line)

# edge constraints
- each node has exactly two edges comming out of it
- each node has either 0 or 2 edges coming out of it
- all nodes are connected via edges
- all nodes that have an edge coming out of them are connected via edges (see implementation of the shaded cells are connectected for inspiration)

# line constraints
- all cells are connected via lines (a cell counts as connected to its neighbor if it has >=1 line)
- all cells that have a line coming out of them are connected via lines

# combo constraints
- the number (variable from number mode) in a selected cell says how many lines are coming out of it (rendered as a circle)
- the number in a selected cell says how many edges are adjacent to it (rendered as a square)
- global versions of each of the two constraints above (all numbers satisfy the constraint)