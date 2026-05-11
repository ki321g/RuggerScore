import 'server-only';
import { Pool, type PoolClient } from 'pg';
import type { Match, ScoreEvent } from './matchStore';

// ── Pool (singleton across hot reloads, lazy-initialized) ──────────────
interface GlobalScope {
	__rugbyScorePgPool?: Pool;
	__rugbyScorePgReady?: Promise<void>;
}
const g = globalThis as unknown as GlobalScope;

function getPool(): Pool {
	if (g.__rugbyScorePgPool) return g.__rugbyScorePgPool;
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error(
			'DATABASE_URL is not set. Add a Postgres connection string to .env.local',
		);
	}
	g.__rugbyScorePgPool = new Pool({
		connectionString,
		// Neon needs SSL; ignore self-signed in dev.
		ssl: /sslmode=require|neon\.tech/.test(connectionString)
			? { rejectUnauthorized: false }
			: undefined,
		max: 5,
	});
	return g.__rugbyScorePgPool;
}

async function migrate(client: PoolClient) {
	await client.query(`
		CREATE TABLE IF NOT EXISTS matches (
			id TEXT PRIMARY KEY,
			code TEXT NOT NULL UNIQUE,
			home_name TEXT NOT NULL,
			home_color TEXT NOT NULL,
			away_name TEXT NOT NULL,
			away_color TEXT NOT NULL,
			competition TEXT,
			status TEXT NOT NULL,
			started_at BIGINT,
			half_started_at BIGINT,
			half SMALLINT NOT NULL,
			elapsed_before_half BIGINT NOT NULL,
			kick_off_at BIGINT,
			venue TEXT,
			club_id TEXT,
			created_by_user_id TEXT,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_matches_updated ON matches(updated_at DESC);

		CREATE TABLE IF NOT EXISTS events (
			id TEXT PRIMARY KEY,
			match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
			ts BIGINT NOT NULL,
			match_minute INTEGER NOT NULL,
			team TEXT NOT NULL,
			type TEXT NOT NULL,
			points INTEGER NOT NULL,
			seq INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id, seq);

		CREATE TABLE IF NOT EXISTS push_subscriptions (
			endpoint TEXT NOT NULL,
			match_id TEXT NOT NULL,
			p256dh TEXT NOT NULL,
			auth TEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (endpoint, match_id)
		);
		CREATE INDEX IF NOT EXISTS idx_push_subs_match ON push_subscriptions(match_id);

		CREATE TABLE IF NOT EXISTS kv (
			k TEXT PRIMARY KEY,
			v TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			name TEXT,
			password_hash TEXT NOT NULL,
			created_at BIGINT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

		CREATE TABLE IF NOT EXISTS clubs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			slug TEXT NOT NULL UNIQUE,
			created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at BIGINT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS club_members (
			club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role TEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (club_id, user_id)
		);
		CREATE INDEX IF NOT EXISTS idx_club_members_user ON club_members(user_id);
	`);
}

export function dbReady(): Promise<void> {
	if (g.__rugbyScorePgReady) return g.__rugbyScorePgReady;
	g.__rugbyScorePgReady = (async () => {
		const client = await getPool().connect();
		try {
			await migrate(client);
		} finally {
			client.release();
		}
	})();
	return g.__rugbyScorePgReady;
}

// ── Row types ──────────────────────────────────────────────────────────
interface MatchRow {
	id: string;
	code: string;
	home_name: string;
	home_color: string;
	away_name: string;
	away_color: string;
	competition: string | null;
	status: string;
	started_at: string | null; // BIGINT → string from pg by default
	half_started_at: string | null;
	half: number;
	elapsed_before_half: string;
	kick_off_at: string | null;
	venue: string | null;
	club_id: string | null;
	created_by_user_id: string | null;
	created_at: string;
	updated_at: string;
}

interface EventRow {
	id: string;
	match_id: string;
	ts: string;
	match_minute: number;
	team: string;
	type: string;
	points: number;
	seq: number;
}

const num = (v: string | null | undefined): number | undefined =>
	v == null ? undefined : Number(v);

function rowToMatch(row: MatchRow, events: EventRow[]): Match {
	return {
		id: row.id,
		code: row.code,
		home: { name: row.home_name, color: row.home_color },
		away: { name: row.away_name, color: row.away_color },
		competition: row.competition ?? undefined,
		status: row.status as Match['status'],
		startedAt: num(row.started_at),
		halfStartedAt: num(row.half_started_at),
		half: (row.half === 2 ? 2 : 1) as 1 | 2,
		elapsedBeforeHalf: Number(row.elapsed_before_half),
		kickOffAt: num(row.kick_off_at),
		venue: row.venue ?? undefined,
		clubId: row.club_id ?? undefined,
		createdByUserId: row.created_by_user_id ?? undefined,
		createdAt: Number(row.created_at),
		updatedAt: Number(row.updated_at),
		events: events.map<ScoreEvent>((e) => ({
			id: e.id,
			ts: Number(e.ts),
			matchMinute: e.match_minute,
			team: e.team as 'home' | 'away',
			type: e.type as ScoreEvent['type'],
			points: e.points,
		})),
	};
}

async function q<T extends object = Record<string, unknown>>(
	text: string,
	params?: unknown[],
): Promise<T[]> {
	await dbReady();
	const res = await getPool().query<
		T extends Record<string, unknown> ? T : Record<string, unknown>
	>(text, params);
	return res.rows as unknown as T[];
}

export const persistence = {
	async loadAll(): Promise<Match[]> {
		const matches = await q<MatchRow>(
			`SELECT * FROM matches ORDER BY updated_at DESC`,
		);
		if (matches.length === 0) return [];
		const ids = matches.map((m) => m.id);
		const events = await q<EventRow>(
			`SELECT * FROM events WHERE match_id = ANY($1::text[]) ORDER BY seq ASC`,
			[ids],
		);
		const byMatch = new Map<string, EventRow[]>();
		for (const e of events) {
			const list = byMatch.get(e.match_id);
			if (list) list.push(e);
			else byMatch.set(e.match_id, [e]);
		}
		return matches.map((m) => rowToMatch(m, byMatch.get(m.id) ?? []));
	},

	async loadOne(id: string): Promise<Match | null> {
		const matches = await q<MatchRow>(
			`SELECT * FROM matches WHERE id = $1 LIMIT 1`,
			[id],
		);
		if (matches.length === 0) return null;
		const events = await q<EventRow>(
			`SELECT * FROM events WHERE match_id = $1 ORDER BY seq ASC`,
			[id],
		);
		return rowToMatch(matches[0], events);
	},

	async createMatch(m: Match): Promise<void> {
		await q(
			`INSERT INTO matches (id, code, home_name, home_color, away_name, away_color, competition,
				status, started_at, half_started_at, half, elapsed_before_half, kick_off_at, venue,
				club_id, created_by_user_id, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
			[
				m.id,
				m.code,
				m.home.name,
				m.home.color,
				m.away.name,
				m.away.color,
				m.competition ?? null,
				m.status,
				m.startedAt ?? null,
				m.halfStartedAt ?? null,
				m.half,
				m.elapsedBeforeHalf,
				m.kickOffAt ?? null,
				m.venue ?? null,
				m.clubId ?? null,
				m.createdByUserId ?? null,
				m.createdAt,
				m.updatedAt,
			],
		);
	},

	async updateMatch(m: Match): Promise<void> {
		await q(
			`UPDATE matches SET
				status = $2,
				started_at = $3,
				half_started_at = $4,
				half = $5,
				elapsed_before_half = $6,
				updated_at = $7
			 WHERE id = $1`,
			[
				m.id,
				m.status,
				m.startedAt ?? null,
				m.halfStartedAt ?? null,
				m.half,
				m.elapsedBeforeHalf,
				m.updatedAt,
			],
		);
	},

	async appendEvent(
		matchId: string,
		ev: ScoreEvent,
		seq: number,
		updatedAt: number,
	): Promise<void> {
		await dbReady();
		const client = await getPool().connect();
		try {
			await client.query('BEGIN');
			await client.query(
				`INSERT INTO events (id, match_id, ts, match_minute, team, type, points, seq)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
				[
					ev.id,
					matchId,
					ev.ts,
					ev.matchMinute,
					ev.team,
					ev.type,
					ev.points,
					seq,
				],
			);
			await client.query(`UPDATE matches SET updated_at = $1 WHERE id = $2`, [
				updatedAt,
				matchId,
			]);
			await client.query('COMMIT');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	},

	async removeLastEvent(matchId: string, updatedAt: number): Promise<void> {
		await dbReady();
		const client = await getPool().connect();
		try {
			await client.query('BEGIN');
			await client.query(
				`DELETE FROM events WHERE id = (
					SELECT id FROM events WHERE match_id = $1 ORDER BY seq DESC LIMIT 1
				)`,
				[matchId],
			);
			await client.query(`UPDATE matches SET updated_at = $1 WHERE id = $2`, [
				updatedAt,
				matchId,
			]);
			await client.query('COMMIT');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	},

	async kvGet(key: string): Promise<string | null> {
		const rows = await q<{ v: string }>(`SELECT v FROM kv WHERE k = $1`, [key]);
		return rows[0]?.v ?? null;
	},

	async kvSet(key: string, value: string): Promise<void> {
		await q(
			`INSERT INTO kv (k, v) VALUES ($1, $2)
			 ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`,
			[key, value],
		);
	},

	async addPushSubscription(
		matchId: string,
		endpoint: string,
		p256dh: string,
		auth: string,
	): Promise<void> {
		await q(
			`INSERT INTO push_subscriptions (endpoint, match_id, p256dh, auth, created_at)
			 VALUES ($1,$2,$3,$4,$5)
			 ON CONFLICT (endpoint, match_id) DO UPDATE
				 SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
			[endpoint, matchId, p256dh, auth, Date.now()],
		);
	},

	async removePushSubscription(
		endpoint: string,
		matchId?: string,
	): Promise<void> {
		if (matchId) {
			await q(
				`DELETE FROM push_subscriptions WHERE endpoint = $1 AND match_id = $2`,
				[endpoint, matchId],
			);
		} else {
			await q(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
		}
	},

	async listPushSubscriptions(
		matchId: string,
	): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
		return q<{ endpoint: string; p256dh: string; auth: string }>(
			`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE match_id = $1`,
			[matchId],
		);
	},

	// ── Users ──────────────────────────────────────────────
	async createUser(u: {
		id: string;
		email: string;
		name: string | null;
		passwordHash: string;
	}): Promise<void> {
		await q(
			`INSERT INTO users (id, email, name, password_hash, created_at)
			 VALUES ($1,$2,$3,$4,$5)`,
			[u.id, u.email.toLowerCase(), u.name, u.passwordHash, Date.now()],
		);
	},

	async getUserByEmail(email: string): Promise<UserRow | null> {
		const rows = await q<UserRow>(`SELECT * FROM users WHERE email = $1`, [
			email.toLowerCase(),
		]);
		return rows[0] ?? null;
	},

	async getUserById(id: string): Promise<UserRow | null> {
		const rows = await q<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
		return rows[0] ?? null;
	},

	// ── Clubs ──────────────────────────────────────────────
	async createClub(c: {
		id: string;
		name: string;
		slug: string;
		createdBy: string;
	}): Promise<void> {
		await dbReady();
		const client = await getPool().connect();
		const now = Date.now();
		try {
			await client.query('BEGIN');
			await client.query(
				`INSERT INTO clubs (id, name, slug, created_by, created_at) VALUES ($1,$2,$3,$4,$5)`,
				[c.id, c.name, c.slug, c.createdBy, now],
			);
			await client.query(
				`INSERT INTO club_members (club_id, user_id, role, created_at) VALUES ($1,$2,'owner',$3)`,
				[c.id, c.createdBy, now],
			);
			await client.query('COMMIT');
		} catch (err) {
			await client.query('ROLLBACK');
			throw err;
		} finally {
			client.release();
		}
	},

	async addClubMember(
		clubId: string,
		userId: string,
		role: 'owner' | 'member',
	): Promise<void> {
		await q(
			`INSERT INTO club_members (club_id, user_id, role, created_at)
			 VALUES ($1,$2,$3,$4)
			 ON CONFLICT (club_id, user_id) DO NOTHING`,
			[clubId, userId, role, Date.now()],
		);
	},

	async getClub(id: string): Promise<ClubRow | null> {
		const rows = await q<ClubRow>(`SELECT * FROM clubs WHERE id = $1`, [id]);
		return rows[0] ?? null;
	},

	async listClubsForUser(userId: string): Promise<ClubRow[]> {
		return q<ClubRow>(
			`SELECT c.* FROM clubs c
			 JOIN club_members m ON m.club_id = c.id
			 WHERE m.user_id = $1
			 ORDER BY c.created_at ASC`,
			[userId],
		);
	},

	async isClubMember(clubId: string, userId: string): Promise<boolean> {
		const rows = await q<{ x: number }>(
			`SELECT 1 AS x FROM club_members WHERE club_id = $1 AND user_id = $2 LIMIT 1`,
			[clubId, userId],
		);
		return rows.length > 0;
	},

	async listMatchesForUser(userId: string): Promise<Match[]> {
		const matches = await q<MatchRow>(
			`SELECT m.* FROM matches m
			 JOIN club_members cm ON cm.club_id = m.club_id
			 WHERE cm.user_id = $1
			 ORDER BY m.updated_at DESC`,
			[userId],
		);
		if (matches.length === 0) return [];
		const ids = matches.map((m) => m.id);
		const events = await q<EventRow>(
			`SELECT * FROM events WHERE match_id = ANY($1::text[]) ORDER BY seq ASC`,
			[ids],
		);
		const byMatch = new Map<string, EventRow[]>();
		for (const e of events) {
			const list = byMatch.get(e.match_id);
			if (list) list.push(e);
			else byMatch.set(e.match_id, [e]);
		}
		return matches.map((m) => rowToMatch(m, byMatch.get(m.id) ?? []));
	},
};

export interface UserRow {
	id: string;
	email: string;
	name: string | null;
	password_hash: string;
	created_at: string;
}

export interface ClubRow {
	id: string;
	name: string;
	slug: string;
	created_by: string;
	created_at: string;
}
