# Pot / Side Pot Engine

`buildSidePots` derives side pots from unique commitment levels.

- For each level band, contributors with commitment >= level fund that band.
- Contenders exclude folded players.
- Showdown settlement consumes side pots in priority order and splits by best rank among eligible contenders.

This preserves dead-chip contributions while restricting contest eligibility.
