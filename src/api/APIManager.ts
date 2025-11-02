import { Notice } from 'obsidian';
import type { MediaTypeModel } from '../models/MediaTypeModel';
import type { APIModel } from './APIModel';
import type { MediaType } from '../utils/MediaType';

export class APIManager {
	apis: APIModel[];
	apiTypeMap = new Map<MediaType, APIModel>();

	constructor() {
		this.apis = [];
	}

	/**
	 * Queries the basic info for one query string and multiple APIs.
	 *
	 * @param query
	 * @param apisToQuery
	 */
	async query(query: string, apisToQuery: string[]): Promise<MediaTypeModel[]> {
		console.debug(`MDB | api manager queried with "${query}"`);

		const promises = this.apis
			.filter(api => apisToQuery.contains(api.apiName))
			.map(async api => {
				try {
					return await api.searchByTitle(query);
				} catch (e) {
					new Notice(`Error querying ${api.apiName}: ${e}`);
					console.warn(e);

					return [];
				}
			});

		return (await Promise.all(promises)).flat();
	}

	/**
	 * Queries detailed information for a MediaTypeModel.
	 *
	 * @param item
	 */
	async queryDetailedInfo(item: MediaTypeModel): Promise<MediaTypeModel | undefined> {
		return await this.queryDetailedInfoById(item.id, item.dataSource);
	}

	/**
	 * Queries detailed info for an id from an API.
	 *
	 * @param id
	 * @param apiName
	 */
	async queryDetailedInfoById(id: string, apiName: string): Promise<MediaTypeModel | undefined> {
		for (const api of this.apis) {
			if (api.apiName === apiName) {
				try {
					return api.getById(id);
				} catch (e) {
					new Notice(`Error querying ${api.apiName}: ${e}`);
					console.warn(e);

					return undefined;
				}
			}
		}

		return undefined;
	}

	getApiByName = (name: string): APIModel | undefined => this.apis.find(api => api.apiName === name);

	getApiByMediaType = (mediaType: MediaType): APIModel | undefined => this.apiTypeMap.get(mediaType);

	registerAPI(api: APIModel, mediaType?: MediaType): void {
		this.apis.push(api);
		if (mediaType) {
			this.apiTypeMap.set(mediaType, api);
		}
	}
}
