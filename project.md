# Puzzle Solver

This project is an app for setting and solving pencil puzzles such as sudoku, kakuro, nurimaze, slitherlink, and more. The app is a webapp using a WASM build of Minizinc as the solver. The core idea ofd the app is to provide a simple rule agnostic interface for a grid that can be edited in various ways, as well as a large library of rules which can be arbitrarily mixed and matched to create hybrid variants of puzzles. For example one could set a sudoku and aqre in the same grid where the shaded cells must contain even numbers

## The grid
When making a new puzzle the first thing the user will do is set up a grid. Grids are always rectangular and consist of square cells. The software also supports the concept of "regions" which if added to a grid give each cell a region ID. neighboring cells of different regions will be rendered with a thick border between them. Then the user selects the solution space of the puzzle, which defines what type of data entry is valid. These are listed bellow

- number placement: depending on setting the user can enter numbers into either some or all cells, the range of allowed numbers is also variable
For example a sudoku would be a 9x9 grid with each region being a 3x3 box and the solution space being number placement with the settings "all cells" and 1-9

- shading: the user can either shade or not some cells (green will be used to denote a known unshaded cell) shading is either enabled or disabled but has no other settings

- borders: The user can either draw borders between cells or not (a small x will be used to denote a known unbordered edge) borders also have no settings

- lines: the user can draw lines between the centers of orthogonally adjacent cells, potentially forming a loop or path depending on the rules of the puzzle. Lines have a setting for the number of allowed lines per cell pair, for example the common "Bridges" puzzle allows for 0, 1, or 2 lines between cell pairs while "simple loop" only allows for 0 or 1

## Rules
Once the grid and solution space are set up the user enters the UI for setting the puzzle. They can mark the value of any piece of the solution space as a "given" for example shade a cell or unshade it, or place a number or mark an edge. They can also select from a library of rules to apply to the puzzle

### Global rules
These are rules that are simply enabled or disabled and apply to the whole grid

### Local rules
Local rules are rules that have instances, like killer cages in a sudoku. Each instance of a local rule has some number of groups of cells and each group can optionally have a value field. For example killer cages have one group with a value representing the sum, while a clone rule has two (or more) groups which do not have a value field

### Rules implementation
Since rules must be easy to add they will each be implemented in their own folder. This folder must contain a config file which defines the rules name, description, categories, required solution space, and either global or local with restrictions on group counts and size and weather or not each group has a value.
The folder then has the option to either contain a minizinc file which implements the rule or a js file which exports a function that takes in the current puzzle state and returns a list of minizinc constraints to apply to the puzzle when the rule is enabled. The latter option allows for more complex rules that may be difficult to implement in pure minizinc, especially rules that rely on other constraints like "negative constraints" which search for the absence of another constraint.
Lastly the folder can optionaly contain a js file with a function that renders the rule in the gird canvas, it is passed a helper object that contains helper functions such as line(cell1,cell2, color, thickness), arrows, cages, and other common requirements for rendering rules. If this file is not provided the rule will simply not be rendered in the UI but will still be applied in the solver

## Solving mode
The user can switch between setting and solving mode, in solving mode they can edit any cells that aren't given and numbers entered are gray instead of black. Same with all other solution space markings. There is also a pencil mark feature for number placement solution spaces. The solve progress is still visible when switching back to setting mode

## Solver
The solver is a WASM build of minizinc running in the browser. The user has a few features to help them set a puzzle. They can ask the solver if the puzzle has a solution and show one ("solve") solutions are shown just like solve mode entries. They can also ask to find multiple solutions, in which case the solver will start looking for solutions returning them as it finds them keeping a live count, the user can click through the solutions. Lastly the user can also ask for "true canidates" which will check for each variable all possible values, and mark them, numbers are pencil marked, edges are either entered, marked with an x or left blank if both are possible, and shading is either applied, maked green for unshaded, or left blank if both are possible. This allows the setter to check what values are still possible.