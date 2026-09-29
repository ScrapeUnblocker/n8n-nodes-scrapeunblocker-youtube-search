import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { OptionField } from './GenericFunctions';
import { applyOptions, requireString, runActorAndGetItems } from './GenericFunctions';

// ScrapeUnblocker's public "YouTube Search Scraper" Actor: https://apify.com/scrapeunblocker/youtube-search-scraper
const ACTOR_ID = 'zQfOdG1betKjKvlbc';
const INTEGRATION_APP_ID = 'scrapeunblocker-youtube-search-scraper';

// Node option name -> Actor input key.
const OPTION_FIELDS: Record<string, OptionField> = {
	type: {
		key: 'type',
	},
	sort: {
		key: 'sort',
	},
	proxyCountry: {
		key: 'proxy_country',
		kind: 'upper',
	},
};

function buildActorInput(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	options: IDataObject,
	itemIndex: number,
): IDataObject {
	const input: IDataObject = {};

	switch (`${resource}:${operation}`) {
		case 'result:search': {
			input.query = requireString.call(this, 'query', 'Search Query', itemIndex);
			input.max_results = this.getNodeParameter('maxResults', itemIndex);
			break;
		}
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported for resource "${resource}"`,
				{ itemIndex },
			);
	}

	applyOptions(input, options, OPTION_FIELDS);
	return input;
}

export class YouTubeSearchScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'YouTube Search Scraper',
		name: 'youTubeSearchScraper',
		icon: {
			light: 'file:youTubeSearchScraper.png',
			dark: 'file:youTubeSearchScraper.dark.png',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Search YouTube videos, channels and playlists by keyword with the ScrapeUnblocker Actor on Apify',
		defaults: {
			name: 'YouTube Search Scraper',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'apifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Result',
						value: 'result',
					},
				],
				default: 'result',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['result'],
					},
				},
				options: [
					{
						name: 'Search',
						value: 'search',
						description: 'Search YouTube by keyword',
						action: 'Search you tube',
					},
				],
				default: 'search',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'python tutorial',
				description: 'What to search for on YouTube',
				displayOptions: {
					show: {
						resource: ['result'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Max Results',
				name: 'maxResults',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
				default: 20,
				description: 'How many results to collect across pages (about 20 per page, 1-500)',
				displayOptions: {
					show: {
						resource: ['result'],
						operation: ['search'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Proxy Country',
						name: 'proxyCountry',
						type: 'string',
						default: '',
						placeholder: 'US',
						description:
							'Exit-IP country (ISO-2, e.g. US). Leave empty for a US exit, which works best for YouTube.',
					},
					{
						displayName: 'Result Type',
						name: 'type',
						type: 'options',
						options: [
							{
								name: 'All',
								value: 'all',
							},
							{
								name: 'Channels',
								value: 'channel',
							},
							{
								name: 'Playlists',
								value: 'playlist',
							},
							{
								name: 'Videos',
								value: 'video',
							},
						],
						default: 'video',
						description: 'Which kind of results to return',
					},
					{
						displayName: 'Sort By',
						name: 'sort',
						type: 'options',
						options: [
							{
								name: 'Rating',
								value: 'rating',
							},
							{
								name: 'Relevance',
								value: 'relevance',
							},
							{
								name: 'Upload Date',
								value: 'date',
							},
							{
								name: 'View Count',
								value: 'views',
							},
						],
						default: 'relevance',
						description: 'Order of the results',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 0,
						},
						default: 0,
						description:
							'Maximum run time of the Apify Actor run. 0 keeps the Actor default. A run that times out fails the node.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const { timeout, ...actorOptions } = options;

				const input = buildActorInput.call(this, resource, operation, actorOptions, i);
				const { items: results } = await runActorAndGetItems.call(this, {
					actorId: ACTOR_ID,
					integrationAppId: INTEGRATION_APP_ID,
					input,
					itemIndex: i,
					timeoutSecs: (timeout as number) || undefined,
				});

				for (const result of results) {
					returnData.push({ json: result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors return an error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
