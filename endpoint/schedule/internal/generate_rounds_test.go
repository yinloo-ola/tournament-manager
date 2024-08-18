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
	players := []model.Player{
		{
			Name: "A",
		},
		{
			Name: "B",
		},
		{
			Name: "C",
		},
		{
			Name: "D",
		},
	}
	type args struct {
		round   int
		players []model.Player
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
					Player1: model.Player{
						Name: "A",
					},
					Player2: model.Player{
						Name: "B",
					},
					DurationMinutes: 30,
				},
				{
					Player1: model.Player{
						Name: "C",
					},
					Player2: model.Player{
						Name: "D",
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
					Player1: model.Player{
						Name: "A",
					},
					Player2: model.Player{
						Name: "C",
					},
					DurationMinutes: 30,
				},
				{
					Player1: model.Player{
						Name: "B",
					},
					Player2: model.Player{
						Name: "D",
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
					Player1: model.Player{
						Name: "A",
					},
					Player2: model.Player{
						Name: "D",
					},
					DurationMinutes: 30,
				},
				{
					Player1: model.Player{
						Name: "B",
					},
					Player2: model.Player{
						Name: "C",
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
	players := []model.Player{
		{
			Name: "A",
		},
		{
			Name: "B",
		},
		{
			Name: "C",
		},
		{
			Name: "D",
		},
		{
			Name: "E",
		},
		{
			Name: "F",
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
	players := []model.Player{
		{
			Name: "A",
		},
		{
			Name: "B",
		},
		{
			Name: "C",
		},
		{
			Name: "D",
		},
		{
			Name: "E",
		},
		{
			Name: "F",
		},
	}
	type args struct {
		players              []model.Player
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
						Player1: model.Player{
							Name: "A",
						},
						Player2: model.Player{
							Name: "B",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "C",
						},
						Player2: model.Player{
							Name: "D",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "E",
						},
						Player2: model.Player{
							Name: "F",
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Player1: model.Player{
							Name: "A",
						},
						Player2: model.Player{
							Name: "C",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "B",
						},
						Player2: model.Player{
							Name: "E",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "D",
						},
						Player2: model.Player{
							Name: "F",
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Player1: model.Player{
							Name: "A",
						},
						Player2: model.Player{
							Name: "E",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "C",
						},
						Player2: model.Player{
							Name: "F",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "B",
						},
						Player2: model.Player{
							Name: "D",
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Player1: model.Player{
							Name: "A",
						},
						Player2: model.Player{
							Name: "D",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "B",
						},
						Player2: model.Player{
							Name: "F",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "C",
						},
						Player2: model.Player{
							Name: "E",
						},
						DurationMinutes: 30,
					},
				},
				{
					{
						Player1: model.Player{
							Name: "A",
						},
						Player2: model.Player{
							Name: "F",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "D",
						},
						Player2: model.Player{
							Name: "E",
						},
						DurationMinutes: 30,
					},
					{
						Player1: model.Player{
							Name: "B",
						},
						Player2: model.Player{
							Name: "C",
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
	players := []model.Player{
		{
			Name: "A",
		},
		{
			Name: "B",
		},
		{
			Name: "C",
		},
		{
			Name: "D",
		},
		{
			Name: "E",
		},
		{
			Name: "F",
		},
	}

	for i := 0; i < b.N; i++ {
		out = generateRounds(players, 30)
	}

}

func Benchmark_generateRoundsOld(b *testing.B) {
	players := []model.Player{
		{
			Name: "A",
		},
		{
			Name: "B",
		},
		{
			Name: "C",
		},
		{
			Name: "D",
		},
		{
			Name: "E",
		},
		{
			Name: "F",
		},
	}
	for i := 0; i < b.N; i++ {
		out = generateRoundsOld(players, 30)
	}
}
