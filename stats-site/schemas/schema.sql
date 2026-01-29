CREATE TABLE games (
  id            BIGSERIAL PRIMARY KEY,
  player_name   TEXT NOT NULL,
  result        TEXT NOT NULL CHECK (result IN ('win', 'loss')),
  deck_name     TEXT,
  battlefield   TEXT,
  legendary TEXT,
  opponent_legend TEXT,
  turn_count    SMALLINT,
  played_at     TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE game_cards (
  id        BIGSERIAL PRIMARY KEY,
  game_id   BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  side      TEXT NOT NULL CHECK (side IN ('you', 'opp')),
  card_name TEXT NOT NULL,
  count     SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_games_player_name   ON games(player_name);
CREATE INDEX idx_games_played_at     ON games(played_at);
CREATE INDEX idx_games_opponent_legend ON games(opponent_legend);
CREATE INDEX idx_games_battlefield   ON games(battlefield);
CREATE INDEX idx_games_result       ON games(result);

CREATE INDEX idx_game_cards_game_id ON game_cards(game_id);
CREATE INDEX idx_game_cards_side    ON game_cards(game_id, side);
CREATE INDEX idx_game_cards_card    ON game_cards(card_name, side);