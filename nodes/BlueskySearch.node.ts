import type {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

export class BlueskySearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bluesky Search',
		name: 'blueskySearch',
		group: ['transform'],
		version: 1,
		description: 'Search Bluesky posts using the AT Protocol',
		defaults: { name: 'Bluesky Search' },
		icon: 'file:bluesky.svg',
		credentials: [
			{ name: 'blueskyApi', required: true },
		],
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'search terms',
				description: 'Search query (supports Lucene syntax)',
				required: true,
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 25,
				description: 'Maximum number of results to return',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Latest', value: 'latest' },
					{ name: 'Top', value: 'top' },
				],
				default: 'latest',
				description: 'Sort order for results',
			},
			{
				displayName: 'Additional Filters',
				name: 'additionalFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'Author',
						name: 'author',
						type: 'string',
						default: '',
						placeholder: 'handle.bsky.social',
						description: 'Filter to posts by specific author',
					},
					{
						displayName: 'Domain',
						name: 'domain',
						type: 'string',
						default: '',
						placeholder: 'example.com',
						description: 'Filter to posts linking to domain',
					},
					{
						displayName: 'Language',
						name: 'lang',
						type: 'string',
						default: '',
						placeholder: 'en',
						description: 'Filter by language code',
					},
					{
						displayName: 'Since',
						name: 'since',
						type: 'string',
						default: '',
						placeholder: '2025-01-01T00:00:00Z',
						description: 'Posts after this datetime (ISO 8601)',
					},
					{
						displayName: 'Until',
						name: 'until',
						type: 'string',
						default: '',
						placeholder: '2025-12-31T23:59:59Z',
						description: 'Posts before this datetime (ISO 8601)',
					},
					{
						displayName: 'Mentions',
						name: 'mentions',
						type: 'string',
						default: '',
						placeholder: 'handle.bsky.social',
						description: 'Filter by mentioned account',
					},
					{
						displayName: 'Tags',
						name: 'tag',
						type: 'string',
						default: '',
						placeholder: 'hashtag1,hashtag2',
						description: 'Comma-separated hashtags (without #)',
					},
				],
			},
			{
				displayName: 'Return Format',
				name: 'returnFormat',
				type: 'options',
				options: [
					{ name: 'Individual Posts', value: 'items' },
					{ name: 'Summary', value: 'summary' },
				],
				default: 'items',
				description: 'How to format the output',
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const creds = await this.getCredentials('blueskyApi');
		const identifier = String(creds.identifier);
		const password = String(creds.password);
		const host = (creds.host as string) || 'https://bsky.social';

		// Get node parameters
		const query = this.getNodeParameter('query', 0) as string;
		const limit = this.getNodeParameter('limit', 0) as number;
		const sort = this.getNodeParameter('sort', 0) as string;
		const additionalFilters = this.getNodeParameter('additionalFilters', 0) as any;
		const returnFormat = this.getNodeParameter('returnFormat', 0) as string;

		if (!query.trim()) {
			throw new Error('Search query is required.');
		}

		// 1) Create session (Bearer token)
		const session = await this.helpers.httpRequest({
			method: 'POST',
			url: `${host}/xrpc/com.atproto.server.createSession`,
			body: { identifier, password },
			json: true,
		});
		const token = session?.accessJwt as string;
		if (!token) throw new Error('Failed to obtain Bluesky access token');

		// 2) Build query params for searchPosts
		const queryParams: any = {
			q: query,
			limit,
			sort,
		};

		// Add optional filters
		if (additionalFilters.author) queryParams.author = additionalFilters.author;
		if (additionalFilters.domain) queryParams.domain = additionalFilters.domain;
		if (additionalFilters.lang) queryParams.lang = additionalFilters.lang;
		if (additionalFilters.since) queryParams.since = additionalFilters.since;
		if (additionalFilters.until) queryParams.until = additionalFilters.until;
		if (additionalFilters.mentions) queryParams.mentions = additionalFilters.mentions;
		if (additionalFilters.tag) {
			// Convert comma-separated tags to array
			queryParams.tag = additionalFilters.tag.split(',').map((t: string) => t.trim());
		}

		// 3) Call searchPosts
		const res = await this.helpers.httpRequest({
			method: 'GET',
			url: `${host}/xrpc/app.bsky.feed.searchPosts`,
			qs: queryParams,
			headers: { Authorization: `Bearer ${token}` },
			json: true,
		});

		const posts = (res?.posts as any[]) || [];
		const hitsTotal = res?.hitsTotal || posts.length;
		const cursor = res?.cursor || null;

		// 4) Format output
		if (returnFormat === 'summary') {
			// Return summary
			returnData.push({
				json: {
					query,
					hits_total: hitsTotal,
					returned: posts.length,
					cursor,
					posts: posts.map((p: any) => ({
						uri: p.uri,
						author: p.author?.handle || 'unknown',
						text: p.record?.text || '',
						indexedAt: p.indexedAt,
						createdAt: p.record?.createdAt || '',
					})),
				},
			});
		} else {
			// Return individual posts as items
			for (const p of posts) {
				const postId = p.uri.split('/').pop();
				const handle = p.author?.handle || 'unknown';
				const webLink = `https://bsky.app/profile/${handle}/post/${postId}`;

				returnData.push({
					json: {
						uri: p.uri,
						cid: p.cid,
						author: {
							did: p.author?.did,
							handle: p.author?.handle,
							displayName: p.author?.displayName,
							avatar: p.author?.avatar,
						},
						text: p.record?.text || '',
						createdAt: p.record?.createdAt,
						indexedAt: p.indexedAt,
						replyCount: p.replyCount || 0,
						repostCount: p.repostCount || 0,
						likeCount: p.likeCount || 0,
						quoteCount: p.quoteCount || 0,
						webLink,
						rawPost: p,
					},
				});
			}
		}

		return [returnData];
	}
}
