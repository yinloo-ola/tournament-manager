-- Tournaments
CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    num_tables INTEGER NOT NULL,
    start_time TEXT NOT NULL
);

-- Categories
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('Singles', 'Doubles', 'Team')),
    entries_per_grp_main INTEGER NOT NULL,
    entries_per_grp_remainder INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL,
    num_qualified_per_group INTEGER NOT NULL,
    min_players INTEGER,
    max_players INTEGER
);

-- Players
CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('M', 'F'))
);

-- Entries
CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    entry_type TEXT NOT NULL CHECK(entry_type IN ('Singles', 'Doubles', 'Team')),
    seeding INTEGER,
    club TEXT,
    team_name TEXT,
    min_players INTEGER,
    max_players INTEGER
);

-- Entry Players (for doubles and teams)
CREATE TABLE entry_players (
    entry_id INTEGER NOT NULL REFERENCES entries(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    player_order INTEGER NOT NULL,
    PRIMARY KEY (entry_id, player_id)
);

-- Groups
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    group_index INTEGER NOT NULL
);

-- Group Entries
CREATE TABLE group_entries (
    group_id INTEGER NOT NULL REFERENCES groups(id),
    entry_id INTEGER NOT NULL REFERENCES entries(id),
    PRIMARY KEY (group_id, entry_id)
);

-- Knockout Rounds
CREATE TABLE knockout_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    round_number INTEGER NOT NULL
);

-- Matches
CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    group_id INTEGER REFERENCES groups(id),
    knockout_round_id INTEGER REFERENCES knockout_rounds(id),
    entry1_id INTEGER NOT NULL REFERENCES entries(id),
    entry2_id INTEGER NOT NULL REFERENCES entries(id),
    datetime TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    table TEXT NOT NULL,
    round_idx INTEGER NOT NULL,
    match_idx INTEGER NOT NULL,
    games TEXT, -- JSON array of [score1, score2] for each game
    matches_in_team_match TEXT, -- JSON array of team match details {matchNumber, games: [[s1,s2],...]}
    winner_entry_id INTEGER REFERENCES entries(id), -- ID of the winning entry (NULL if not played/draw)
    score1 INTEGER,                 -- Final score for entry1 (games won / sub-matches won)
    score2 INTEGER                  -- Final score for entry2 (games won / sub-matches won)
);

-- Lineup Items
CREATE TABLE lineup_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    match_type TEXT NOT NULL CHECK(match_type IN ('Singles', 'Doubles')),
    gender_requirement TEXT NOT NULL CHECK(gender_requirement IN ('M', 'F', 'Mixed', 'Any')),
    age_req_type TEXT CHECK(age_req_type IN ('minimum', 'maximum')),
    age_req_value INTEGER
);