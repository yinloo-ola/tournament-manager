package internal

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
	"github.com/yinloo-ola/tournament-manager/model"
	"github.com/yinloo-ola/tournament-manager/utils/pointer"
)

func ImportFinalSchedule(ctx context.Context, tournamentXlsxReader io.Reader) (map[string][]model.Group, map[string][]model.KnockoutRound, error) {
	file, err := excelize.OpenReader(tournamentXlsxReader)
	if err != nil {
		return nil, nil, err
	}
	slog.DebugContext(ctx, "sheets", slog.Any("sheets", file.GetSheetList()))
	// TODO: read the excel file
	rows, err := file.GetRows(scheduleSheetName, excelize.Options{
		RawCellValue: true,
	})
	if err != nil {
		return nil, nil, err
	}

	// read first row and store table header into a map for later use
	headerMap := make(map[int]string)
	for i, cell := range rows[0][1:] {
		headerMap[i] = cell
	}
	slog.InfoContext(ctx, "headerMap", slog.Any("headerMap", headerMap))

	matches := make([]model.Match, 0, len(rows)*10)
	// read the rest of the rows, if the first cell is empty or not datetime, skip this row
	rowIdx := 1
	for _, row := range rows[1:] {
		rowIdx++
		if len(row) == 0 || len(strings.TrimSpace(row[0])) == 0 {
			continue
		}
		datetimeFloat, err := strconv.ParseFloat(row[0], 64)
		if err != nil {
			slog.WarnContext(ctx, "not a float", slog.Any("datetime", row[0]), slog.Any("err", err))
			continue
		}
		datetime, err := excelize.ExcelDateToTime(datetimeFloat, false)
		if err != nil {
			slog.WarnContext(ctx, "not a datetime", slog.Any("datetime", row[0]), slog.Any("err", err))
			continue
		}
		slog.DebugContext(ctx, "datetime", slog.Any("datetime", datetime))
		colIdx := 'A'
		for cellIdx, cell := range row[1:] {
			colIdx++
			cellAddr := fmt.Sprintf("%c%d", colIdx, rowIdx)
			hasLink, link, err := file.GetCellHyperLink(scheduleSheetName, cellAddr)
			if err != nil {
				slog.WarnContext(ctx, "GetCellHyperLink failed", slog.Any("cellAddr", cellAddr), slog.Any("err", err))
				continue
			}
			if !hasLink {
				continue
			}
			table := rows[0][cellIdx+1]
			slog.DebugContext(ctx, "cell link",
				slog.Any("cellAddr", cellAddr),
				slog.Any("hasLink", hasLink),
				slog.Any("link", link),
				slog.Any("cell", cell),
				slog.Any("table", table),
				slog.Any("Datetime", datetime),
			)
			match, err := getMatchFromCellAddr(link, file)
			if err != nil {
				slog.WarnContext(ctx, "getMatchFromCellAddr failed", slog.Any("cellAddr", cellAddr), slog.Any("err", err))
				continue
			}
			match.DateTime = datetime
			match.Table = table
			matches = append(matches, match)
		}
	}

	// grp matches into group matches and knockout matches.
	// if match.GroupIdx == -1, it's a knockout match.
	var knockoutMatches []model.Match = make([]model.Match, 0, len(matches))
	var groupMatches []model.Match = make([]model.Match, 0, len(matches))
	for _, match := range matches {
		if match.GroupIdx == -1 {
			knockoutMatches = append(knockoutMatches, match)
		} else {
			groupMatches = append(groupMatches, match)
		}
	}

	// Convert matches to a map of category shortName to groups
	categoryGroups := formCategoriesGroupsMap(groupMatches)
	slog.InfoContext(ctx, "group matches", slog.Any("count", len(matches)), slog.Any("categoryGroups", categoryGroups))

	// Convert matches to a map of category shortName to knockout rounds
	categoryKnockoutRounds := formCategoriesKnockoutRoundsMap(knockoutMatches)
	slog.InfoContext(ctx, "knockout matches", slog.Any("count", len(matches)), slog.Any("categoryKnockoutRounds", categoryKnockoutRounds))

	return categoryGroups, categoryKnockoutRounds, nil
}

func formCategoriesKnockoutRoundsMap(matches []model.Match) map[string][]model.KnockoutRound {
	// Create a map to organize matches by category and round
	categoryMap := make(map[string]map[int][]model.Match)

	// Group matches by category and round
	for _, match := range matches {
		// Initialize category map if it doesn't exist
		if _, ok := categoryMap[match.CategoryShortName]; !ok {
			categoryMap[match.CategoryShortName] = make(map[int][]model.Match)
		}

		// Initialize round slice if it doesn't exist
		if _, ok := categoryMap[match.CategoryShortName][match.Round]; !ok {
			categoryMap[match.CategoryShortName][match.Round] = []model.Match{}
		}

		// Add match to the appropriate category and round
		categoryMap[match.CategoryShortName][match.Round] = append(
			categoryMap[match.CategoryShortName][match.Round], match)
	}

	// Create the result map with category shortName as key and slice of knockout rounds as value
	result := make(map[string][]model.KnockoutRound)

	for categoryName, roundMap := range categoryMap {
		// Find all the rounds for this category
		rounds := make([]int, 0, len(roundMap))
		for round := range roundMap {
			rounds = append(rounds, round)
		}

		// Sort rounds in descending order (biggest round first)
		sort.Sort(sort.Reverse(sort.IntSlice(rounds)))

		// Create knockout rounds for this category
		knockoutRounds := make([]model.KnockoutRound, 0, len(rounds))

		// Process each round
		for _, round := range rounds {
			// Get matches for this round
			matchesInRound := roundMap[round]

			// Sort matches by matchIdx
			sort.Slice(matchesInRound, func(i, j int) bool {
				return matchesInRound[i].MatchIdx < matchesInRound[j].MatchIdx
			})

			// Create a knockout round
			knockoutRound := model.KnockoutRound{
				Round:   round,
				Matches: matchesInRound,
			}

			// Add the knockout round to the slice
			knockoutRounds = append(knockoutRounds, knockoutRound)
		}

		// Add the knockout rounds to the result map
		result[categoryName] = knockoutRounds
	}

	return result
}

func formCategoriesGroupsMap(matches []model.Match) map[string][]model.Group {
	// Create a map to organize matches by category
	categoryMap := make(map[string]map[int]map[int][]model.Match)
	// Map of category name to duration minutes
	categoryDuration := make(map[string]int)

	// Group matches by category, group, and round
	for _, match := range matches {
		// Initialize category map if it doesn't exist
		if _, ok := categoryMap[match.CategoryShortName]; !ok {
			categoryMap[match.CategoryShortName] = make(map[int]map[int][]model.Match)
			categoryDuration[match.CategoryShortName] = match.DurationMinutes
		}

		// Initialize group map if it doesn't exist
		if _, ok := categoryMap[match.CategoryShortName][match.GroupIdx]; !ok {
			categoryMap[match.CategoryShortName][match.GroupIdx] = make(map[int][]model.Match)
		}

		// Initialize round slice if it doesn't exist
		if _, ok := categoryMap[match.CategoryShortName][match.GroupIdx][match.RoundIdx]; !ok {
			categoryMap[match.CategoryShortName][match.GroupIdx][match.RoundIdx] = []model.Match{}
		}

		// Add match to the appropriate category, group, and round
		categoryMap[match.CategoryShortName][match.GroupIdx][match.RoundIdx] = append(
			categoryMap[match.CategoryShortName][match.GroupIdx][match.RoundIdx], match)
	}

	// Create the result map with category shortName as key and slice of groups as value
	result := make(map[string][]model.Group)

	for categoryName, groupMap := range categoryMap {
		// Create a slice to hold all groups for this category
		groups := make([]model.Group, len(groupMap))

		// Create a map to track all players in this category
		categoryPlayerMap := make(map[string]model.Entry)

		// Process each group
		for groupIdx, roundMap := range groupMap {
			// Find the maximum round index
			maxRoundIdx := -1
			for roundIdx := range roundMap {
				if roundIdx > maxRoundIdx {
					maxRoundIdx = roundIdx
				}
			}

			// Create rounds slice with appropriate capacity
			rounds := make([][]model.Match, maxRoundIdx+1)

			// Create a map to track players in this group
			groupPlayerMap := make(map[string]model.Entry)

			// Fill in the rounds
			for roundIdx, matchesInRound := range roundMap {
				rounds[roundIdx] = matchesInRound

				// Add players to both maps
				for _, match := range matchesInRound {
					categoryPlayerMap[match.Entry1.Name()] = match.Entry1
					categoryPlayerMap[match.Entry2.Name()] = match.Entry2
					groupPlayerMap[match.Entry1.Name()] = match.Entry1
					groupPlayerMap[match.Entry2.Name()] = match.Entry2
				}
			}

			// Convert group player map to slice
			groupPlayers := make([]model.Entry, 0, len(groupPlayerMap))
			for _, player := range groupPlayerMap {
				groupPlayers = append(groupPlayers, player)
			}

			// Create a group
			group := model.Group{
				Rounds:  rounds,
				Entries: groupPlayers,
			}

			// Add the group to the slice
			groups[groupIdx] = group
		}

		// Add the groups to the result map
		result[categoryName] = groups
	}

	return result
}

func getMatchFromCellAddr(cellAddr string, file *excelize.File) (model.Match, error) {
	matchesSheetName, cellAddr, found := strings.Cut(cellAddr, "!")
	if !found {
		return model.Match{}, fmt.Errorf("invalid cell addr %s", cellAddr)
	}
	_, row, err := excelize.SplitCellName(cellAddr)
	if err != nil {
		return model.Match{}, fmt.Errorf("invalid cell addr %s", cellAddr)
	}

	category, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("B%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get category: %w", err)
	}
	roundStr, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("C%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get round: %w", err)
	}
	var round int
	if len(roundStr) > 0 {
		round, err = strconv.Atoi(roundStr)
		if err != nil {
			return model.Match{}, fmt.Errorf("fail to convert round to int: %w", err)
		}
	}
	grpStr, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("D%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get group: %w", err)
	}
	var grp int
	if len(grpStr) > 0 {
		grp, err = strconv.Atoi(grpStr)
		if err != nil {
			return model.Match{}, fmt.Errorf("fail to convert group to int: %w", err)
		}
	}
	koRoundStr, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("E%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get koRound: %w", err)
	}
	var koRound int
	if len(koRoundStr) > 0 {
		koRound, err = strconv.Atoi(koRoundStr)
		if err != nil {
			return model.Match{}, fmt.Errorf("fail to convert koRound to int: %w", err)
		}
	}
	koMatchStr, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("F%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get koMatch: %w", err)
	}
	var koMatch int
	if len(koMatchStr) > 0 {
		koMatch, err = strconv.Atoi(koMatchStr)
		if err != nil {
			return model.Match{}, fmt.Errorf("fail to convert koMatch to int: %w", err)
		}
	}

	player1, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("I%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get player1: %w", err)
	}
	slog.Debug("player1", "player1", player1)
	player1Club, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("J%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get player1: %w", err)
	}
	var player1Seeding int
	player1SeedingStr, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("K%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get player1: %w", err)
	}
	if len(player1SeedingStr) > 0 {
		player1Seeding, err = strconv.Atoi(player1SeedingStr)
		if err != nil {
			return model.Match{}, fmt.Errorf("fail to convert player1 seeding: %w", err)
		}
	}
	player2, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("L%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get player2: %w", err)
	}
	slog.Debug("player2", "player2", player2)
	player2Club, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("M%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get player2: %w", err)
	}
	player2SeedingStr, err := file.GetCellValue(matchesSheetName, fmt.Sprintf("N%d", row))
	if err != nil {
		return model.Match{}, fmt.Errorf("fail to get player2: %w", err)
	}
	var player2Seeding int
	if len(player2SeedingStr) > 0 {
		player2Seeding, err = strconv.Atoi(player2SeedingStr)
		if err != nil {
			return model.Match{}, fmt.Errorf("fail to convert player2 seeding: %w", err)
		}
	}
	// TODO: support matches of different event types (singles, doubles, team)
	return model.Match{
		CategoryShortName: category,
		RoundIdx:          round - 1,
		GroupIdx:          grp - 1,
		Entry1: model.Entry{
			Club:    pointer.OrNil(player1Club),
			Seeding: pointer.OrNil(player1Seeding),
		},
		Entry2: model.Entry{
			Club:    pointer.OrNil(player2Club),
			Seeding: pointer.OrNil(player2Seeding),
		},
		Round:    koRound,
		MatchIdx: koMatch,
	}, nil
}
