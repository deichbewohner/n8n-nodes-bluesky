import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class BlueskyApi implements ICredentialType {
	name = 'blueskyApi';
	displayName = 'Bluesky App Password';
	properties: INodeProperties[] = [
		{
			displayName: 'Handle',
			name: 'identifier',
			type: 'string',
			default: '',
			placeholder: 'your-handle.bsky.social',
			required: true,
		},
		{
			displayName: 'App Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			hint: 'Create via Bluesky → Settings → Advanced → App Passwords',
		},
		{
			displayName: 'Service URL',
			name: 'host',
			type: 'string',
			default: 'https://bsky.social',
		},
	];
}
