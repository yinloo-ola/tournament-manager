package internal

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"testing"

	"github.com/yinloo-ola/tournament-manager/model"
)

func Test_getRoundPlayersIndices(t *testing.T) {
	for i := 4; i < 100; i += 2 {
		indices := make([]int, i)
		indices2 := make([]int, i)
		for r := 0; r < i-1; r++ {
			sliceForRotation := generateSlice(i - 1)
			getRoundPlayersIndices(r, i, indices)
			getRoundPlayersIndicesWithRotation(r, i, sliceForRotation, indices2)
			if !reflect.DeepEqual(indices, indices2) {
				t.Errorf("numPlayer:%d round:%d res1:%v res2:%v", i, r, indices, indices2)
			}
		}
	}

}

func Benchmark_getRoundPlayersIndices(b *testing.B) {
	numPlayers := 100
	for i := 0; i < b.N; i++ {
		indices := make([]int, numPlayers)
		for r := 0; r < numPlayers-1; r++ {
			getRoundPlayersIndices(r, numPlayers, indices)
		}
	}
}
func Benchmark_getRoundPlayersIndicesWithRotation(b *testing.B) {
	numPlayers := 100
	sliceForRotation := generateSlice(numPlayers - 1)
	for i := 0; i < b.N; i++ {
		indices := make([]int, numPlayers)
		for r := 0; r < numPlayers-1; r++ {
			getRoundPlayersIndicesWithRotation(r, numPlayers, sliceForRotation, indices)
		}
	}
}

func Test_getRoundMatches(t *testing.T) {
	players := []model.Entry{
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "A",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "B",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "C",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "D",
				},
			},
		},
	}
	type args struct {
		round   int
		players []model.Entry
	}
	tests := []struct {
		args args
		want []model.Match
	}{
		{
			args: args{
				round:   0,
				players: players,
			},
			want: []model.Match{
				{
					Entry1: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "A",
							},
						},
					},
					Entry2: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "B",
							},
						},
					},
					DurationMinutes: 30,
				},
				{
					Entry1: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "C",
							},
						},
					},
					Entry2: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "D",
							},
						},
					},
					DurationMinutes: 30,
				},
			},
		},
		{
			args: args{
				round:   1,
				players: players,
			},
			want: []model.Match{
				{
					Entry1: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "A",
							},
						},
					},
					Entry2: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "C",
							},
						},
					},
					DurationMinutes: 30,
				},
				{
					Entry1: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "B",
							},
						},
					},
					Entry2: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "D",
							},
						},
					},
					DurationMinutes: 30,
				},
			},
		},
		{
			args: args{
				round:   2,
				players: players,
			},
			want: []model.Match{
				{
					Entry1: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "A",
							},
						},
					},
					Entry2: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "D",
							},
						},
					},
					DurationMinutes: 30,
				},
				{
					Entry1: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "B",
							},
						},
					},
					Entry2: model.Entry{

						SinglesEntry: &model.SinglesEntry{
							Player: model.Player{
								Name: "C",
							},
						},
					},
					DurationMinutes: 30,
				},
			},
		},
	}

	for i, tt := range tests {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			indices := make([]int, len(tt.args.players))
			if got := getRoundMatches(tt.args.round, tt.args.players, 30, indices); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("%d:getRoundMatches() = %v, want %v", i, got, tt.want)
			}
		})
	}
}

func Benchmark_getRoundMatches(b *testing.B) {
	players := []model.Entry{
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "A",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "B",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "C",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "D",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "E",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "F",
				},
			},
		},
	}
	var res []model.Match

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		indices := make([]int, len(players))
		for r := 0; r < len(players)-1; r++ {
			res = getRoundMatches(r, players, 30, indices)
		}
	}
	b.StopTimer()
	fmt.Println(res)
}

func Test_generateRounds(t *testing.T) {
	players := []model.Entry{
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "A",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "B",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "C",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "D",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "E",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "F",
				},
			},
		},
	}
	type args struct {
		players              []model.Entry
		matchDurationMinutes int
	}
	tests := []struct {
		name string
		args args
		want [][]model.Match
	}{
		{
			name: "6 players",
			args: args{
				players:              players,
				matchDurationMinutes: 30,
			},
			want: [][]model.Match{
				{
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "A",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "B",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "C",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "D",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "E",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "F",
								},
							},
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "A",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "C",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "B",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "E",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "D",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "F",
								},
							},
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "A",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "E",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "C",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "F",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "B",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "D",
								},
							},
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "A",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "D",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "B",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "F",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "C",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "E",
								},
							},
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "A",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "F",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "D",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "E",
								},
							},
						},
						DurationMinutes: 30,
					},
					{
						Entry1: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "B",
								},
							},
						},
						Entry2: model.Entry{

							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "C",
								},
							},
						},
						DurationMinutes: 30,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := generateRounds(tt.args.players, tt.args.matchDurationMinutes); !reflect.DeepEqual(got, tt.want) {
				gotJson, _ := json.Marshal(got)
				wantJson, _ := json.Marshal(tt.want)
				t.Errorf("generateRounds()\n%s\nwant\n%s\n", gotJson, wantJson)
			}
		})
	}
}

var out [][]model.Match

func Benchmark_generateRounds(b *testing.B) {
	players := []model.Entry{
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "A",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "B",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "C",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "D",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "E",
				},
			},
		},
		{

			SinglesEntry: &model.SinglesEntry{
				Player: model.Player{
					Name: "F",
				},
			},
		},
	}

	for i := 0; i < b.N; i++ {
		out = generateRounds(players, 30)
	}

}

func Test_generateKnockoutRounds(t *testing.T) {
	tests := []struct {
		name                 string
		groups               []model.Group
		numQualifiedPerGroup int
		want                 []model.KnockoutRound
		wantErr              bool
	}{
		{
			name: "not enough players",
			groups: []model.Group{
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Player1"},
							},
						},
					},
				},
			},
			numQualifiedPerGroup: 2,
			want:                 nil,
			wantErr:              true,
		},
		{
			name: "2 groups, 2 qualified per group",
			groups: []model.Group{
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player3"},
							},
						},
					},
				},
			},
			numQualifiedPerGroup: 2,
			want: []model.KnockoutRound{
				{
					Round:   4,
					Matches: make([]model.Match, 2),
				},
				{
					Round:   2,
					Matches: make([]model.Match, 1),
				},
			},
			wantErr: false,
		},
		{
			name: "4 groups, 1 qualified per group",
			groups: []model.Group{
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player2"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group3Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group3Player2"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group4Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group4Player2"},
							},
						},
					},
				},
			},
			numQualifiedPerGroup: 1,
			want: []model.KnockoutRound{
				{
					Round:   4,
					Matches: make([]model.Match, 2),
				},
				{
					Round:   2,
					Matches: make([]model.Match, 1),
				},
			},
			wantErr: false,
		},
		{
			name: "3 groups, 2 qualified per group",
			groups: []model.Group{
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group2Player3"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group3Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group3Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group3Player3"},
							},
						},
					},
				},
			},
			numQualifiedPerGroup: 2,
			want: []model.KnockoutRound{
				{
					Round:   8,
					Matches: make([]model.Match, 2),
				},
				{
					Round:   4,
					Matches: make([]model.Match, 2),
				},
				{
					Round:   2,
					Matches: make([]model.Match, 1),
				},
			},
			wantErr: false,
		},
		{
			name: "5 groups, 5 qualified per group",
			groups: []model.Group{
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player4"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player5"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player4"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player5"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player4"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player5"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player4"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player5"},
							},
						},
					},
				},
				{
					Entries: []model.Entry{
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player1"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player2"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player3"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player4"},
							},
						},
						{
							SinglesEntry: &model.SinglesEntry{
								Player: model.Player{
									Name: "Group1Player5"},
							},
						},
					},
				},
			},
			numQualifiedPerGroup: 5,
			want: []model.KnockoutRound{
				{
					Round:   32,
					Matches: make([]model.Match, 9),
				},
				{
					Round:   16,
					Matches: make([]model.Match, 8),
				},
				{
					Round:   8,
					Matches: make([]model.Match, 4),
				},
				{
					Round:   4,
					Matches: make([]model.Match, 2),
				},
				{
					Round:   2,
					Matches: make([]model.Match, 1),
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := generateKnockoutRounds(tt.groups, tt.numQualifiedPerGroup)
			if (err != nil) != tt.wantErr {
				t.Errorf("generateKnockoutRounds() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				if len(got) != len(tt.want) {
					t.Errorf("generateKnockoutRounds() returned %d rounds, want %d rounds", len(got), len(tt.want))
					return
				}

				for i := range got {
					if got[i].Round != tt.want[i].Round {
						t.Errorf("generateKnockoutRounds() round[%d].Round = %d, want %d", i, got[i].Round, tt.want[i].Round)
					}
					if len(got[i].Matches) != len(tt.want[i].Matches) {
						t.Errorf("generateKnockoutRounds() round[%d] has %d matches, want %d matches", i, len(got[i].Matches), len(tt.want[i].Matches))
					}
				}
			}
		})
	}
}

func TestNextPowerOfTwo(t *testing.T) {
	tests := []struct {
		input  int
		expect int
	}{
		{0, 1},
		{1, 1},
		{2, 2},
		{3, 4},
		{4, 4},
		{5, 8},
		{7, 8},
		{8, 8},
		{9, 16},
		{15, 16},
		{16, 16},
		{63, 64},
		{127, 128},
		{129, 256},
		{1025, 2048},
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("Input%d", tt.input), func(t *testing.T) {
			if got := nextPowerOfTwo(tt.input); got != tt.expect {
				t.Errorf("nextPowerOfTwo(%d) = %d, want %d", tt.input, got, tt.expect)
			}
		})
	}
}
