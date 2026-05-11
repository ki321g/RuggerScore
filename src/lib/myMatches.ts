'use client';

const KEY = 'rugbyscore.myMatches';

export interface MyMatchEntry {
	id: string;
	code: string;
	addedAt: number;
}

function read(): MyMatchEntry[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function write(list: MyMatchEntry[]) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(KEY, JSON.stringify(list));
	window.dispatchEvent(new CustomEvent('rugbyscore:my-matches-changed'));
}

export const myMatches = {
	list(): MyMatchEntry[] {
		return read().sort((a, b) => b.addedAt - a.addedAt);
	},
	add(id: string, code: string) {
		const list = read().filter((m) => m.id !== id);
		list.unshift({ id, code, addedAt: Date.now() });
		write(list);
	},
	remove(id: string) {
		write(read().filter((m) => m.id !== id));
	},
	onChange(fn: () => void): () => void {
		if (typeof window === 'undefined') return () => {};
		const handler = () => fn();
		const storageHandler = (e: StorageEvent) => {
			if (e.key === KEY) fn();
		};
		window.addEventListener('rugbyscore:my-matches-changed', handler);
		window.addEventListener('storage', storageHandler);
		return () => {
			window.removeEventListener('rugbyscore:my-matches-changed', handler);
			window.removeEventListener('storage', storageHandler);
		};
	},
};
