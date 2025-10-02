/**
 * Standalone test script to validate Bluesky search API
 * Run with: npm test (or ts-node tests/api-test.ts)
 *
 * Set credentials via env vars:
 * BLUESKY_HANDLE=your-handle.bsky.social
 * BLUESKY_PASSWORD=your-app-password
 */

import * as https from 'https';
import * as http from 'http';

interface BlueskySession {
	accessJwt: string;
	refreshJwt: string;
	did: string;
}

interface SearchPostsResponse {
	posts: any[];
	cursor?: string;
	hitsTotal?: number;
}

// Simple HTTP(S) request helper
function httpRequest(url: string, options: any = {}): Promise<any> {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url);
		const isHttps = parsedUrl.protocol === 'https:';
		const lib = isHttps ? https : http;

		const reqOptions = {
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.pathname + parsedUrl.search,
			method: options.method || 'GET',
			headers: options.headers || {},
		};

		const req = lib.request(reqOptions, (res) => {
			let data = '';
			res.on('data', (chunk) => data += chunk);
			res.on('end', () => {
				try {
					const parsed = JSON.parse(data);
					if (res.statusCode && res.statusCode >= 400) {
						reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
					} else {
						resolve(parsed);
					}
				} catch (err) {
					reject(new Error(`Failed to parse response: ${data}`));
				}
			});
		});

		req.on('error', reject);

		if (options.body) {
			req.write(JSON.stringify(options.body));
		}

		req.end();
	});
}

async function createSession(host: string, identifier: string, password: string): Promise<BlueskySession> {
	console.log(`🔑 Creating session for ${identifier}...`);
	const url = `${host}/xrpc/com.atproto.server.createSession`;
	const session = await httpRequest(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: { identifier, password },
	});

	if (!session.accessJwt) {
		throw new Error('Failed to obtain access token');
	}

	console.log(`✅ Session created. DID: ${session.did}`);
	return session;
}

async function searchPosts(
	host: string,
	token: string,
	query: string,
	limit: number = 10,
	additionalParams: Record<string, any> = {}
): Promise<SearchPostsResponse> {
	console.log(`🔍 Searching for: "${query}" (limit: ${limit})...`);

	// Build query string
	const params = new URLSearchParams({
		q: query,
		limit: String(limit),
		...additionalParams,
	});

	const url = `${host}/xrpc/app.bsky.feed.searchPosts?${params.toString()}`;
	const result = await httpRequest(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${token}` },
	});

	console.log(`✅ Found ${result.posts?.length || 0} posts (total hits: ${result.hitsTotal || 'unknown'})`);
	return result;
}

async function main() {
	const host = process.env.BLUESKY_HOST || 'https://bsky.social';
	const identifier = process.env.BLUESKY_HANDLE;
	const password = process.env.BLUESKY_PASSWORD;

	if (!identifier || !password) {
		console.error('❌ Error: Set BLUESKY_HANDLE and BLUESKY_PASSWORD environment variables');
		console.log('\nExample:');
		console.log('  BLUESKY_HANDLE=your.handle.bsky.social BLUESKY_PASSWORD=your-app-password npm test');
		process.exit(1);
	}

	try {
		// Create session
		const session = await createSession(host, identifier, password);

		// Test 1: Basic search
		console.log('\n--- Test 1: Basic search ---');
		const results1 = await searchPosts(host, session.accessJwt, 'bluesky', 5);
		results1.posts.slice(0, 2).forEach((post: any, idx: number) => {
			console.log(`  ${idx + 1}. @${post.author?.handle}: ${post.record?.text?.substring(0, 80)}...`);
		});

		// Test 2: Search with sort
		console.log('\n--- Test 2: Search with sort=top ---');
		const results2 = await searchPosts(host, session.accessJwt, 'typescript', 3, { sort: 'top' });
		results2.posts.slice(0, 2).forEach((post: any, idx: number) => {
			console.log(`  ${idx + 1}. @${post.author?.handle} (likes: ${post.likeCount})`);
		});

		// Test 3: Search with date filter
		console.log('\n--- Test 3: Search with date filter (last 7 days) ---');
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const results3 = await searchPosts(host, session.accessJwt, 'n8n', 5, {
			since: sevenDaysAgo.toISOString(),
		});
		console.log(`  Found ${results3.posts.length} posts about "n8n" in the last 7 days`);

		console.log('\n✅ All tests passed!');
		console.log('\n📊 Summary:');
		console.log(`  - Basic search: ${results1.posts.length} results`);
		console.log(`  - Sort by top: ${results2.posts.length} results`);
		console.log(`  - Date filtered: ${results3.posts.length} results`);
		console.log('\nReady to integrate with n8n! 🚀');

	} catch (error: any) {
		console.error('❌ Test failed:', error.message);
		process.exit(1);
	}
}

main();
