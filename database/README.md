# Database foundation

The first deployment may use one PostgreSQL cluster, but logical schemas preserve domain ownership. Application modules must not treat shared database access as permission to mutate another domain's state.

`0001_foundation.sql` establishes only the first build foundation. It intentionally does **not** claim that the complete v0.4 logical model is implemented.
