package excelhelper

import (
	"errors"
	"strings"
)

// split a string like "AC21" into row 21 and col AC
func SplitRowCol(cellAddr string) (row int, col string, err error) {
	if len(cellAddr) == 0 {
		return 0, "", errors.New("empty cell address")
	}

	cellAddr = strings.ToUpper(cellAddr)
	
	// Check if the first character is a number (invalid)
	if cellAddr[0] >= '0' && cellAddr[0] <= '9' {
		return 0, "", errors.New("invalid cell address: must start with letters")
	}
	
	colStr := ""
	rowStr := ""
	
	// Flag to track if we've started seeing numbers
	seenNumber := false
	
	// Iterate through the cell address to separate column letters from row numbers
	for _, char := range cellAddr {
		if char >= 'A' && char <= 'Z' {
			// If we've already seen a number and now we're seeing a letter, that's invalid
			if seenNumber {
				return 0, "", errors.New("invalid cell address: letters must come before numbers")
			}
			colStr += string(char)
		} else if char >= '0' && char <= '9' {
			seenNumber = true
			rowStr += string(char)
		} else {
			// If we encounter any other character, it's invalid
			return 0, "", errors.New("invalid cell address: contains invalid characters")
		}
	}
	
	// Ensure we have both column and row parts
	if colStr == "" {
		return 0, "", errors.New("invalid cell address: missing column letters")
	}
	
	if rowStr == "" {
		return 0, "", errors.New("invalid cell address: missing row numbers")
	}
	
	// Convert row string to integer
	rowVal := 0
	for _, digit := range rowStr {
		rowVal = rowVal*10 + int(digit-'0')
	}
	row = rowVal
	col = colStr
	
	return row, col, nil
}
