import 'server-only';
import { customAlphabet } from 'nanoid';
import { persistence } from './persistence';
import {
	pushService,
	buildEventPayload,
	buildStatusPayload,
} from './pushService';

export type ScoreEventType =
	| 'try'
	| 'conversion'
	| 'penalty'
	| 'drop'
	| 'yellow'
	| 'red';

export interface ScoreEvent {
	id: string;
	ts: number; // wall clock ms
	matchMinute: number; // computed minute in match
	team: 'home' | 'away';
	type: ScoreEventType;
	points: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'fulltime';

export interface Match {
	id: string; // canonical id
	code: string; // 6-char share code
	home: { name: string; color: string };
	away: { name: string; color: string };
	competition?: string;
	status: MatchStatus;
	startedAt?: number;
	halfStartedAt?: number;
	half: 1 | 2;
	// accumulated minutes from previous halves (when paused)
	elapsedBeforeHalf: number;
	kickOffAt?: number; // planned kick-off (ms)
	venue?: string;
	clubId?: string;
	createdByUserId?: string;
	events: ScoreEvent[];
	createdAt: number;
	updatedAt: number;
}

export const POINTS: Record<ScoreEventType, number> = {
	try: 5,
	conversion: 2,
	penalty: 3,
	drop: 3,
	yellow: 0,
	red: 0,
};

const codeGen = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const idGen = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

type Listener = (m: Match) => void;

class MatchStore {
	private matches = new Map<string, Match>();
	private byCode = new Map<string, string>();
	private listeners = new Map<string, Set<Listener>>();
	private _ready?: Promise<void>;
	get ready(): Promise<void> {
		if (!this._ready) {
			this._ready = (async () => {
				const all = await persistence.loadAll();
				for (const m of all) {
					this.matches.set(m.id, m);
					this.byCode.set(m.code, m.id);
				}
			})();
		}
		return this._ready;
	}

	constructor() {}

	list(): Match[] {
		return Array.from(this.matches.values()).sort(
			(a, b) => b.updatedAt - a.updatedAt,
		);
	}

	liveCount(): number {
		return this.list().filter(
			(m) => m.status === 'live' || m.status === 'halftime',
		).length;
	}

	get(id: string): Match | undefined {
		return this.matches.get(id);
	}

	getByCode(code: string): Match | undefined {
		const id = this.byCode.get(code.toUpperCase());
		return id ? this.matches.get(id) : undefined;
	}

	/**
	 * Reload a single match from the database into the in-memory cache.
	 * Required on serverless (Vercel) where another instance may have mutated
	 * the match since this instance last saw it. Returns the fresh Match,
	 * or undefined if the match no longer exists.
	 */
	async reload(id: string): Promise<Match | undefined> {
		const fresh = await persistence.loadOne(id);
		if (!fresh) {
			const stale = this.matches.get(id);
			if (stale) {
				this.matches.delete(id);
				this.byCode.delete(stale.code);
			}
			return undefined;
		}
		this.matches.set(fresh.id, fresh);
		this.byCode.set(fresh.code, fresh.id);
		return fresh;
	}

	async create(input: {
		homeName: string;
		awayName: string;
		homeColor?: string;
		awayColor?: string;
		competition?: string;
		kickOffAt?: number;
		venue?: string;
		clubId?: string;
		createdByUserId?: string;
	}): Promise<Match> {
		const id = idGen();
		let code = codeGen();
		while (this.byCode.has(code)) code = codeGen();
		const now = Date.now();
		const match: Match = {
			id,
			code,
			home: {
				name: input.homeName.trim() || 'Home',
				color: input.homeColor || '#0a6b3a',
			},
			away: {
				name: input.awayName.trim() || 'Away',
				color: input.awayColor || '#1e3a8a',
			},
			competition: input.competition?.trim() || undefined,
			kickOffAt:
				typeof input.kickOffAt === 'number' && Number.isFinite(input.kickOffAt)
					? input.kickOffAt
					: undefined,
			venue: input.venue?.trim() || undefined,
			clubId: input.clubId,
			createdByUserId: input.createdByUserId,
			status: 'scheduled',
			half: 1,
			elapsedBeforeHalf: 0,
			events: [],
			createdAt: now,
			updatedAt: now,
		};
		await persistence.createMatch(match);
		this.matches.set(id, match);
		this.byCode.set(code, id);
		return match;
	}

	private async touch(m: Match): Promise<void> {
		m.updatedAt = Date.now();
		await persistence.updateMatch(m);
		this.emit(m);
	}

	private matchMinute(m: Match): number {
		if (!m.halfStartedAt) return Math.floor(m.elapsedBeforeHalf / 60000);
		const live = (Date.now() - m.halfStartedAt) / 60000;
		return Math.floor(m.elapsedBeforeHalf / 60000 + live);
	}

	async startMatch(id: string): Promise<Match | undefined> {
		const m = this.matches.get(id);
		if (!m) return;
		if (m.status === 'scheduled') {
			m.status = 'live';
			m.startedAt = Date.now();
			m.halfStartedAt = Date.now();
			m.half = 1;
			m.elapsedBeforeHalf = 0;
		} else if (m.status === 'halftime') {
			m.status = 'live';
			m.half = 2;
			m.halfStartedAt = Date.now();
		}
		await this.touch(m);
		void pushService.sendToMatch(m.id, buildStatusPayload(m, 'live'));
		return m;
	}

	async halfTime(id: string): Promise<Match | undefined> {
		const m = this.matches.get(id);
		if (!m || m.status !== 'live') return m;
		if (m.halfStartedAt) {
			m.elapsedBeforeHalf += Date.now() - m.halfStartedAt;
			m.halfStartedAt = undefined;
		}
		m.status = 'halftime';
		await this.touch(m);
		void pushService.sendToMatch(m.id, buildStatusPayload(m, 'halftime'));
		return m;
	}

	async fullTime(id: string): Promise<Match | undefined> {
		const m = this.matches.get(id);
		if (!m) return;
		if (m.halfStartedAt) {
			m.elapsedBeforeHalf += Date.now() - m.halfStartedAt;
			m.halfStartedAt = undefined;
		}
		m.status = 'fulltime';
		await this.touch(m);
		void pushService.sendToMatch(m.id, buildStatusPayload(m, 'fulltime'));
		return m;
	}

	async addEvent(
		id: string,
		team: 'home' | 'away',
		type: ScoreEventType,
	): Promise<Match | undefined> {
		const m = this.matches.get(id);
		if (!m) return;
		const ev: ScoreEvent = {
			id: idGen(),
			ts: Date.now(),
			matchMinute: this.matchMinute(m),
			team,
			type,
			points: POINTS[type],
		};
		m.events.push(ev);
		m.updatedAt = Date.now();
		await persistence.appendEvent(m.id, ev, m.events.length, m.updatedAt);
		this.emit(m);
		void pushService.sendToMatch(m.id, buildEventPayload(m, ev));
		return m;
	}

	async undoLast(id: string): Promise<Match | undefined> {
		const m = this.matches.get(id);
		if (!m || m.events.length === 0) return m;
		m.events.pop();
		m.updatedAt = Date.now();
		await persistence.removeLastEvent(m.id, m.updatedAt);
		this.emit(m);
		return m;
	}

	scores(m: Match): { home: number; away: number } {
		return m.events.reduce(
			(acc, e) => {
				acc[e.team] += e.points;
				return acc;
			},
			{ home: 0, away: 0 },
		);
	}

	// pub/sub
	subscribe(id: string, fn: Listener): () => void {
		let set = this.listeners.get(id);
		if (!set) {
			set = new Set();
			this.listeners.set(id, set);
		}
		set.add(fn);
		return () => set!.delete(fn);
	}

	private emit(m: Match) {
		const set = this.listeners.get(m.id);
		if (!set) return;
		for (const fn of set) {
			try {
				fn(m);
			} catch {
				/* ignore */
			}
		}
	}
}

// Persist across hot reloads in dev
const g = globalThis as unknown as { __rugbyScoreStore?: MatchStore };
export const store: MatchStore =
	g.__rugbyScoreStore ?? (g.__rugbyScoreStore = new MatchStore());

export function publicMatch(m: Match) {
	const running = m.status === 'live' && !!m.halfStartedAt;
	const minute = (() => {
		if (m.status === 'scheduled') return 0;
		if (m.halfStartedAt) {
			return Math.floor(
				(m.elapsedBeforeHalf + (Date.now() - m.halfStartedAt)) / 60000,
			);
		}
		return Math.floor(m.elapsedBeforeHalf / 60000);
	})();
	return {
		id: m.id,
		code: m.code,
		home: m.home,
		away: m.away,
		competition: m.competition,
		kickOffAt: m.kickOffAt,
		venue: m.venue,
		status: m.status,
		half: m.half,
		minute,
		// clock fields so the client can tick locally between SSE updates
		clockBaseMs: m.elapsedBeforeHalf,
		clockRunningSince: running ? m.halfStartedAt! : null,
		serverNow: Date.now(),
		scores: store.scores(m),
		events: m.events,
		updatedAt: m.updatedAt,
	};
}
export type PublicMatch = ReturnType<typeof publicMatch>;
